
// ... (keep imports)
import React, { useState, useEffect } from 'react';
import { UserProfile, MacroPlan, PersonalizedPlan, DailyMealPlanDB, DietMeal, ProgressEntry, WeightPrediction } from '../types';
import { calculatePlan } from './Calculator';
import { supabase } from '../services/supabaseClient';
import { generateDailyMealPlan, handleDietDeviation, addFoodItem } from '../services/geminiService';
import { predictWeightTrajectory } from '../services/analyticsService';
import BarcodeScanner from './BarcodeScanner';

interface Props {
  userId: string;
  profile: UserProfile;
  workoutPlan: PersonalizedPlan | null;
  logs?: ProgressEntry[]; 
  onSignOut: () => void;
  onNavigate: (tab: 'dashboard' | 'library' | 'progress' | 'profile') => void;
}

type DietType = 'veg' | 'egg' | 'non-veg';

interface SmartAlert {
    id: string;
    type: 'info' | 'warning' | 'critical' | 'success';
    title: string;
    message: string;
    icon: string;
}

const Dashboard: React.FC<Props> = ({ userId, profile, workoutPlan, logs = [], onSignOut, onNavigate }) => {
  // Use stored calories from DB if available to maintain "Weekly Budget" consistency
  const plan: MacroPlan = profile.daily_calories 
    ? { ...calculatePlan(profile), calories: profile.daily_calories } 
    : calculatePlan(profile);
    
  // --- STATE ---
  const [activeTab, setActiveTab] = useState<'overview' | 'diet' | 'workout'>('diet');
  const [todayPlan, setTodayPlan] = useState<DailyMealPlanDB | null>(null);
  const [recentPlans, setRecentPlans] = useState<DailyMealPlanDB[]>([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState('');
  const [showRegenInput, setShowRegenInput] = useState(false);
  
  // Initialize dietType from profile preference or default to non-veg
  const [dietType, setDietType] = useState<DietType>((profile.dietary_preference as DietType) || 'non-veg');
  
  // New Feature States
  const [streak, setStreak] = useState(0);
  const [smartAlerts, setSmartAlerts] = useState<SmartAlert[]>([]); // Typed Alerts
  const [showScanner, setShowScanner] = useState(false);
  
  // Analytics State
  const [prediction, setPrediction] = useState<WeightPrediction | null>(null);

  // Deviation Modal State
  const [deviationModal, setDeviationModal] = useState<{
      isOpen: boolean;
      type: 'diet' | 'workout';
      itemIndex: number; 
      itemData: any;
  }>({ isOpen: false, type: 'diet', itemIndex: -1, itemData: null });
  const [deviationInput, setDeviationInput] = useState('');
  const [isProcessingDeviation, setIsProcessingDeviation] = useState(false);

  // Add Food Modal State
  const [addFoodModal, setAddFoodModal] = useState(false);
  const [addFoodMethod, setAddFoodMethod] = useState<'ai' | 'manual'>('ai');
  const [addFoodInput, setAddFoodInput] = useState('');
  const [manualEntry, setManualEntry] = useState({ name: '', cal: '', p: '', c: '', f: '' });
  const [isAddingFood, setIsAddingFood] = useState(false);

  // --- HELPER: SAFE ERROR MESSAGE ---
  const getErrorMessage = (error: any) => {
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    return error?.message || 'An unexpected error occurred';
  };

  // --- DERIVED STATE (REAL-TIME TRACKING) ---
  const getConsumedMacros = (currentPlan: DailyMealPlanDB | null) => {
    if (!currentPlan) return { p: 0, c: 0, f: 0, cal: 0 };
    return currentPlan.meals.reduce((acc, meal) => {
      if (meal.isCompleted) {
        return {
          p: acc.p + meal.macros.p,
          c: acc.c + meal.macros.c,
          f: acc.f + meal.macros.f,
          cal: acc.cal + meal.macros.cal,
        };
      }
      return acc;
    }, { p: 0, c: 0, f: 0, cal: 0 });
  };

  const consumed = getConsumedMacros(todayPlan);

  const totalCalTarget = plan.calories || 2000;
  const calPct = totalCalTarget > 0 ? Math.min(100, Math.round((consumed.cal / totalCalTarget) * 100)) : 0;
  const pPct = plan.protein > 0 ? Math.min(100, Math.round((consumed.p / plan.protein) * 100)) : 0;
  const cPct = plan.carbs > 0 ? Math.min(100, Math.round((consumed.c / plan.carbs) * 100)) : 0;
  const fPct = plan.fats > 0 ? Math.min(100, Math.round((consumed.f / plan.fats) * 100)) : 0;

  // --- HELPERS ---
  const getTodayDate = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getTimeGreeting = () => {
    const hours = new Date().getHours();
    if (hours < 12) return 'Good Morning';
    if (hours < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  // --- DATA FETCHING & ANALYTICS ---
  useEffect(() => {
    fetchDailyPlans();
  }, [userId]); 

  // Run Analytics when logs change
  useEffect(() => {
      if (logs.length > 0) {
          const pred = predictWeightTrajectory(logs, plan, undefined); 
          setPrediction(pred);
      }
  }, [logs, plan]);

  // --- SMART NOTIFICATION ENGINE ---
  useEffect(() => {
      const alerts: SmartAlert[] = [];
      const now = new Date();
      const currentHour = now.getHours();

      if (todayPlan) {
          const checkMeal = (nameKeywords: string[], startHour: number, endHour: number, label: string) => {
              if (currentHour >= startHour && currentHour < endHour) {
                  const meal = todayPlan.meals.find(m => nameKeywords.some(k => m.name.toLowerCase().includes(k)));
                  if (meal && !meal.isCompleted) {
                      alerts.push({
                          id: 'meal-reminder',
                          type: 'info',
                          title: `${label} Time`,
                          message: `Don't forget to track your ${label.toLowerCase()}.`,
                          icon: 'fa-utensils'
                      });
                  }
              }
          };
          checkMeal(['break'], 8, 11, 'Breakfast');
          checkMeal(['lunch'], 12, 15, 'Lunch');
          checkMeal(['dinner'], 19, 22, 'Dinner');
      }

      if (logs.length > 0) {
          const lastLogDate = new Date(logs[logs.length - 1].created_at || logs[logs.length - 1].date);
          const diffTime = Math.abs(now.getTime() - lastLogDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays > 3) {
              alerts.push({
                  id: 'log-inactivity',
                  type: 'warning',
                  title: 'Update Stats',
                  message: `It's been ${diffDays} days since your last weigh-in. Log now to keep AI accurate.`,
                  icon: 'fa-weight'
              });
          }
      } else {
           alerts.push({
              id: 'no-logs',
              type: 'info',
              title: 'Start Tracking',
              message: 'Log your first weight entry to unlock AI predictions.',
              icon: 'fa-flag-checkered'
          });
      }

      if (currentHour >= 20 && todayPlan) {
          const remainingCalories = totalCalTarget - consumed.cal;
          if (remainingCalories > 800) {
              alerts.push({
                  id: 'high-deficit',
                  type: 'critical',
                  title: 'High Deficit Warning',
                  message: `You are ${remainingCalories} kcal under budget. This may cause muscle loss. Consider a protein snack.`,
                  icon: 'fa-battery-quarter'
              });
          }
      }

      if (recentPlans.length >= 3) {
          const last3Days = recentPlans.slice(0, 3);
          const avgIntake = last3Days.reduce((acc, p) => {
              const dayCals = p.meals.reduce((mAcc, m) => m.isCompleted ? mAcc + m.macros.cal : mAcc, 0);
              return acc + dayCals;
          }, 0) / 3;

          const bmrApprox = plan.bmr || 1500;
          
          if (avgIntake < bmrApprox && avgIntake > 0) {
               alerts.push({
                  id: 'refeed-rec',
                  type: 'warning',
                  title: 'Metabolism Alert',
                  message: 'Consistent low intake detected. AI recommends a "Refeed Day" (Maintenance Calories) tomorrow.',
                  icon: 'fa-pizza-slice'
              });
          }
      }

      let streakCount = 0;
      if (recentPlans.length > 0) {
          for (let i = 0; i < recentPlans.length; i++) {
             const historicalPlan = recentPlans[i]; 
             const hasActivity = historicalPlan.meals.some(m => m.isCompleted);
             if (hasActivity) {
                 streakCount++;
             } else {
                 if (historicalPlan.date !== getTodayDate()) break;
             }
          }
          setStreak(streakCount);
      }

      setSmartAlerts(alerts);
  }, [recentPlans, todayPlan, logs, consumed.cal, totalCalTarget, plan.bmr]);

  const fetchDailyPlans = async () => {
    setLoading(true);
    const today = getTodayDate();
    
    try {
        const { data, error } = await supabase
          .from('daily_meal_plans')
          .select('*')
          .eq('user_id', userId) 
          .order('date', { ascending: false })
          .limit(10); 

        if (error) throw error;

        if (data) {
            const validData = data.filter((p: any) => p && p.meals && Array.isArray(p.meals));
            setRecentPlans(validData);
            
            const todayEntry = validData.find((p: any) => p.date === today);
            setTodayPlan(todayEntry || null);
        }
    } catch (err: any) {
        console.error("Failed to fetch plans:", getErrorMessage(err));
    }
    setLoading(false);
  };

  const toggleMealCompletion = async (index: number) => {
    if (!todayPlan) return;
    const updatedMeals = [...todayPlan.meals];
    updatedMeals[index] = {
        ...updatedMeals[index],
        isCompleted: !updatedMeals[index].isCompleted
    };
    const updatedPlan = { ...todayPlan, meals: updatedMeals };
    setTodayPlan(updatedPlan);

    try {
        const { error } = await supabase
            .from('daily_meal_plans')
            .update({ meals: updatedMeals })
            .eq('id', todayPlan.id);
        if (error) throw error;
        setRecentPlans(prev => [updatedPlan, ...prev.filter(p => p.date !== todayPlan.date)]);
    } catch (err) {
        console.error("Failed to update meal status", err);
        setTodayPlan(todayPlan); 
        alert("Failed to save progress. Check connection.");
    }
  };

  const handleScanSuccess = (foodData: any) => {
      setShowScanner(false);
      setAddFoodMethod('ai');
      setAddFoodModal(true);
      setAddFoodInput(`${foodData.name} - ${foodData.calories} calories (${foodData.protein}g protein, ${foodData.carbs}g carbs). 1 Serving.`);
  };

  const calculateZigzagTarget = (todayStr: string) => {
    const today = new Date();
    const dayOfWeek = today.getDay(); 
    const daysSinceMonday = (dayOfWeek + 6) % 7; 
    
    const weekHistory = recentPlans.filter(p => {
        if (p.date === todayStr) return false;
        const pDate = new Date(p.date);
        const tDate = new Date(todayStr);
        pDate.setHours(0,0,0,0);
        tDate.setHours(0,0,0,0);
        const diffTime = Math.abs(tDate.getTime() - pDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= daysSinceMonday;
    });

    let totalConsumed = 0;
    const standardDailyTarget = profile.daily_calories || plan.calories;
    let expectedTotal = weekHistory.length * standardDailyTarget;
    
    weekHistory.forEach(day => {
        const dayConsumed = day.meals.reduce((sum, m) => m.isCompleted ? sum + m.macros.cal : sum, 0);
        totalConsumed += dayConsumed;
    });

    const netSurplus = totalConsumed - expectedTotal;
    const daysLeftInWeek = 7 - daysSinceMonday;

    let adjustmentPerDay = 0;
    if (daysLeftInWeek > 0) {
        adjustmentPerDay = Math.round(netSurplus / daysLeftInWeek);
    }

    const newTarget = standardDailyTarget - adjustmentPerDay;
    let contextNote = "";
    if (Math.abs(adjustmentPerDay) > 30) {
         if (adjustmentPerDay > 0) {
             contextNote = `ALERT: User is currently ${netSurplus} kcal OVER weekly budget. \nSTRATEGY: Reduce daily target by ${adjustmentPerDay} kcal.`;
         } else {
             contextNote = `NOTICE: User is ${Math.abs(netSurplus)} kcal UNDER weekly budget. \nSTRATEGY: Increase daily target (Refeed).`;
         }
    }
    return { newTarget, contextNote };
  };

  const handleGenerateToday = async () => {
    setGenerating(true);
    setShowRegenInput(false); 
    try {
        const today = getTodayDate();
        const historyForAI = recentPlans.filter(p => p.date !== today);
        const { newTarget, contextNote } = calculateZigzagTarget(today);

        const newPlan = await generateDailyMealPlan(
            profile, plan, today, historyForAI, preferences, dietType, newTarget, contextNote
        );
        
        if (!newPlan || !newPlan.meals || newPlan.meals.length === 0) throw new Error("Invalid plan");

        const { error: upsertError } = await supabase
          .from('daily_meal_plans')
          .upsert({
            user_id: userId,
            date: today,
            meals: newPlan.meals,
            macros: newPlan.macros
          }, { onConflict: 'user_id, date' });

        if (upsertError) throw upsertError;
        
        const { data: refreshedData } = await supabase.from('daily_meal_plans').select('*').eq('user_id', userId).eq('date', today).single();
        
        setTodayPlan(refreshedData || newPlan);
        setRecentPlans(prev => [refreshedData || newPlan, ...prev.filter(p => p.date !== today)]);
        setPreferences(''); 
    } catch (err: any) {
        alert(`Failed to generate plan: ${getErrorMessage(err)}`);
        setShowRegenInput(true);
    } finally {
        setGenerating(false);
    }
  };

  const handleSubmitDeviation = async () => {
    if (!deviationInput.trim() || !todayPlan) return;
    setIsProcessingDeviation(true);
    try {
        if (deviationModal.type === 'diet') {
            const indexToUpdate = deviationModal.itemIndex === -1 ? todayPlan.meals.length - 1 : deviationModal.itemIndex;
            
            let targetIndex = deviationModal.itemIndex;
            if (targetIndex === -1) {
                targetIndex = todayPlan.meals.length - 1;
            }

            const updatedPlan = await handleDietDeviation(todayPlan, plan, targetIndex, deviationInput);
            
            if(updatedPlan.meals[targetIndex]) {
                 updatedPlan.meals[targetIndex].isCompleted = true;
            }

            const { error: upsertError } = await supabase
              .from('daily_meal_plans')
              .upsert({
                user_id: userId,
                date: todayPlan.date,
                meals: updatedPlan.meals,
                macros: updatedPlan.macros
              }, { onConflict: 'user_id, date' });

            if (upsertError) throw upsertError;

            setTodayPlan(updatedPlan);
            setRecentPlans(prev => [updatedPlan, ...prev.filter(p => p.date !== todayPlan.date)]);
            setDeviationModal(prev => ({ ...prev, isOpen: false }));
            setDeviationInput('');
        }
    } catch (err: any) {
        alert(`Could not adjust plan: ${getErrorMessage(err)}`);
    } finally {
        setIsProcessingDeviation(false);
    }
  };

  const handleSubmitAddFood = async () => {
    if (!todayPlan) return;
    setIsAddingFood(true);
    
    try {
        let updatedPlan: DailyMealPlanDB;

        if (addFoodMethod === 'ai') {
             if (!addFoodInput.trim()) return;
             updatedPlan = await addFoodItem(todayPlan, addFoodInput);
        } else {
             // Manual
             if (!manualEntry.name || !manualEntry.cal) {
                 alert("Name and Calories are required.");
                 setIsAddingFood(false);
                 return;
             }
             
             const newMeal: DietMeal = {
                 name: manualEntry.name,
                 time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                 items: ['Manual Entry'],
                 macros: {
                     p: Number(manualEntry.p) || 0,
                     c: Number(manualEntry.c) || 0,
                     f: Number(manualEntry.f) || 0,
                     cal: Number(manualEntry.cal) || 0
                 },
                 isCompleted: true
             };
             
             const newMeals = [...todayPlan.meals, newMeal];
             const newTotals = {
                 p: todayPlan.macros.p + newMeal.macros.p,
                 c: todayPlan.macros.c + newMeal.macros.c,
                 f: todayPlan.macros.f + newMeal.macros.f,
                 cal: todayPlan.macros.cal + newMeal.macros.cal
             };
             
             updatedPlan = {
                 ...todayPlan,
                 meals: newMeals,
                 macros: newTotals
             };
        }
        
        const { error: upsertError } = await supabase
          .from('daily_meal_plans')
          .upsert({
            user_id: userId,
            date: todayPlan.date,
            meals: updatedPlan.meals,
            macros: updatedPlan.macros
          }, { onConflict: 'user_id, date' });

        if (upsertError) throw upsertError;

        setTodayPlan(updatedPlan);
        setRecentPlans(prev => [updatedPlan, ...prev.filter(p => p.date !== todayPlan.date)]);
        setAddFoodModal(false);
        setAddFoodInput('');
        setManualEntry({ name: '', cal: '', p: '', c: '', f: '' }); 
    } catch (err: any) {
        alert(`Could not add food: ${getErrorMessage(err)}`);
    } finally {
        setIsAddingFood(false);
    }
  };

  return (
    <div className="p-4 space-y-6 pb-28 max-w-2xl mx-auto relative">
      {/* Scanner Modal */}
      {showScanner && <BarcodeScanner onScanSuccess={handleScanSuccess} onClose={() => setShowScanner(false)} />}
        
      {/* Header Section */}
      <div className="flex justify-between items-center animate-fade-in">
        <div>
          <p className="text-gray-400 text-sm font-medium">{getTimeGreeting()},</p>
          <div 
            onClick={() => onNavigate('profile')}
            className="flex items-center gap-2 group cursor-pointer active:scale-95 transition-transform origin-left"
          >
            <h1 className="text-3xl font-black text-white tracking-tight group-hover:text-primary transition-colors">{profile.name}</h1>
            
            <button 
                className="w-6 h-6 rounded-full bg-white/5 group-hover:bg-primary group-hover:text-dark border border-white/10 flex items-center justify-center transition-all text-gray-400"
                aria-label="Edit Profile"
            >
                <i className="fas fa-pencil-alt text-[10px]"></i>
            </button>

            {streak > 1 && (
                <div className="flex items-center gap-1 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full ml-1" onClick={(e) => e.stopPropagation()}>
                    <i className="fas fa-fire text-orange-500 text-xs animate-pulse"></i>
                    <span className="text-orange-500 font-bold text-xs">{streak} Days</span>
                </div>
            )}
          </div>
        </div>
        <div className="w-10"></div> 
      </div>

      {/* Smart Notifications Area */}
      {smartAlerts.length > 0 && (
          <div className="space-y-3 animate-slide-up">
              {smartAlerts.map((alert) => (
                  <div 
                    key={alert.id} 
                    className={`p-3 rounded-xl flex items-start gap-3 border ${
                        alert.type === 'critical' ? 'bg-red-500/10 border-red-500/30' :
                        alert.type === 'warning' ? 'bg-orange-500/10 border-orange-500/30' :
                        alert.type === 'info' ? 'bg-blue-500/10 border-blue-500/30' :
                        'bg-green-500/10 border-green-500/30'
                    }`}
                  >
                      <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          alert.type === 'critical' ? 'bg-red-500 text-white' :
                          alert.type === 'warning' ? 'bg-orange-500 text-white' :
                          alert.type === 'info' ? 'bg-blue-500 text-white' :
                          'bg-green-500 text-white'
                      }`}>
                          <i className={`fas ${alert.icon} text-xs`}></i>
                      </div>
                      <div>
                          <h4 className={`text-xs font-bold uppercase tracking-wider ${
                              alert.type === 'critical' ? 'text-red-400' :
                              alert.type === 'warning' ? 'text-orange-400' :
                              alert.type === 'info' ? 'text-blue-400' :
                              'text-green-400'
                          }`}>{alert.title}</h4>
                          <p className="text-sm text-gray-200 leading-tight mt-0.5">{alert.message}</p>
                      </div>
                  </div>
              ))}
          </div>
      )}

      {/* Hero Macro Card */}
      <div className="relative overflow-hidden rounded-3xl p-6 shadow-2xl animate-slide-up bg-[#0f121e] border border-white/5">
        <div className="absolute top-[-10px] right-[-10px] bg-[#3f2e22] text-[#f97316] text-[10px] font-bold px-6 py-4 rounded-full border border-white/5 flex items-end justify-center">
            <span className="translate-y-[-2px] translate-x-[-5px]">{profile.goal}</span>
        </div>
        
        <div className="relative z-10 mt-2">
            <div className="mb-6">
                <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">Consumed / Daily Target</p>
                <div className="flex items-baseline gap-2">
                    <span className={`text-4xl font-black transition-colors duration-500 ${consumed.cal > totalCalTarget ? 'text-red-500' : 'text-white'}`}>
                        {consumed.cal}
                    </span>
                    <span className="text-xl text-gray-500 font-medium">/</span>
                    <span className="text-xl text-gray-400 font-bold">{totalCalTarget}</span>
                    <span className="text-xs font-bold text-orange-500 uppercase ml-1">KCAL</span>
                </div>
                <div className="w-full bg-gray-800 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div 
                        className={`h-full rounded-full transition-all duration-700 ease-out ${consumed.cal > totalCalTarget ? 'bg-red-500' : 'bg-primary'}`} 
                        style={{ width: `${calPct}%` }}
                    ></div>
                </div>
            </div>

            <div className="flex gap-4">
                <div className="flex-1 bg-[#161b2c] p-3 rounded-xl border border-white/5 relative overflow-hidden group">
                    <div className="flex justify-between items-end mb-1">
                        <p className="text-[9px] text-gray-500 uppercase font-bold">Protein</p>
                        <p className="text-[9px] text-gray-500 font-mono">{Math.round(consumed.p)} / {plan.protein}g</p>
                    </div>
                    <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden mt-1">
                        <div className="h-full bg-blue-600 rounded-full transition-all duration-1000 ease-out" style={{ width: `${pPct}%` }}></div>
                    </div>
                </div>

                <div className="flex-1 bg-[#161b2c] p-3 rounded-xl border border-white/5 relative overflow-hidden group">
                     <div className="flex justify-between items-end mb-1">
                        <p className="text-[9px] text-gray-500 uppercase font-bold">Carbs</p>
                        <p className="text-[9px] text-gray-500 font-mono">{Math.round(consumed.c)} / {plan.carbs}g</p>
                    </div>
                    <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden mt-1">
                         <div className="h-full bg-green-600 rounded-full transition-all duration-1000 ease-out" style={{ width: `${cPct}%` }}></div>
                    </div>
                </div>

                <div className="flex-1 bg-[#161b2c] p-3 rounded-xl border border-white/5 relative overflow-hidden group">
                     <div className="flex justify-between items-end mb-1">
                        <p className="text-[9px] text-gray-500 uppercase font-bold">Fats</p>
                        <p className="text-[9px] text-gray-500 font-mono">{Math.round(consumed.f)} / {plan.fats}g</p>
                    </div>
                    <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden mt-1">
                         <div className="h-full bg-yellow-500 rounded-full transition-all duration-1000 ease-out" style={{ width: `${fPct}%` }}></div>
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-black/40 p-1.5 rounded-2xl border border-white/5 flex relative backdrop-blur-sm">
        {['diet', 'workout', 'overview'].map((tab) => (
            <button 
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide rounded-xl transition-all duration-300 relative z-10 ${
                    activeTab === tab 
                    ? 'text-white shadow-lg bg-white/10 border border-white/5' 
                    : 'text-gray-500 hover:text-gray-300'
                }`}
            >
                {tab === 'diet' && "Daily Fuel"}
                {tab === 'workout' && "Training"}
                {tab === 'overview' && "Stats"}
            </button>
        ))}
      </div>
      
      <div className="min-h-[400px]">
        {activeTab === 'diet' && (
            <div className="space-y-4 animate-slide-up">
                <div className="flex justify-between items-center px-1">
                    <span className="text-white font-bold text-lg">{getTodayDate()}</span>
                    <div className="flex gap-2">
                        {todayPlan && (
                            <button 
                                onClick={() => setShowScanner(true)}
                                className="bg-white/10 hover:bg-white/20 text-white w-8 h-8 rounded-full flex items-center justify-center transition-all border border-white/10"
                            >
                                <i className="fas fa-barcode text-xs"></i>
                            </button>
                        )}
                        {todayPlan && !showRegenInput && (
                            <div className="text-xs text-gray-500 italic flex items-center gap-2">
                                <i className="fas fa-check-square text-primary"></i> Track
                            </div>
                        )}
                    </div>
                </div>

                {(!todayPlan || showRegenInput) && (
                    <div className="glass-card p-1 rounded-2xl mb-4 relative overflow-hidden">
                        <div className="p-3 text-center text-gray-400 text-xs italic">
                            Diet Preference: <span className="text-primary font-bold uppercase">{dietType}</span>
                        </div>
                    </div>
                )}

                {todayPlan && showRegenInput && (
                    <div className="glass-card p-4 rounded-2xl animate-fade-in">
                        <div className="flex justify-between items-center mb-3">
                            <label className="text-xs font-bold text-primary uppercase tracking-wider">Adjustment / Request</label>
                            <button onClick={() => setShowRegenInput(false)} className="text-xs text-gray-400 hover:text-white"><i className="fas fa-times"></i></button>
                        </div>
                        <p className="text-[10px] text-gray-400 mb-2">Did you overeat? Tell the AI to fix the rest of the day.</p>
                        <textarea 
                            value={preferences}
                            onChange={(e) => setPreferences(e.target.value)}
                            placeholder="e.g. 'I ate 500g Chicken Biryani for lunch, adjust my dinner'..."
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary outline-none h-24 resize-none mb-3 placeholder-gray-600"
                        />
                        <button 
                            onClick={handleGenerateToday}
                            disabled={generating}
                            className="w-full bg-gradient-to-r from-primary to-orange-600 hover:to-orange-500 text-white font-bold py-3 rounded-xl shadow-lg transition-all flex justify-center items-center gap-2"
                        >
                                {generating ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-magic"></i>} Regenerate Plan
                        </button>
                    </div>
                )}

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-50">
                        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                        <span className="text-xs text-primary font-bold tracking-widest uppercase">Syncing Data</span>
                    </div>
                ) : !todayPlan ? (
                    <div className="glass-card p-8 rounded-3xl text-center border-dashed border-2 border-white/10 flex flex-col items-center justify-center min-h-[350px]">
                        <div className="w-24 h-24 bg-gradient-to-tr from-gray-800 to-gray-900 rounded-full flex items-center justify-center mb-6 shadow-xl border border-white/5">
                            <i className="fas fa-utensils text-4xl text-gray-600"></i>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Kitchen Closed</h3>
                        <p className="text-gray-500 text-sm mb-6 max-w-xs">No meal plan generated for today yet. Using your {dietType} preference.</p>
                        
                        <div className="w-full mb-4">
                            <input 
                                type="text"
                                value={preferences}
                                onChange={(e) => setPreferences(e.target.value)}
                                placeholder="Any specific cravings? (Optional)"
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-primary outline-none placeholder-gray-600 text-center"
                            />
                        </div>

                        <button 
                            onClick={handleGenerateToday}
                            disabled={generating}
                            className="bg-white text-black hover:bg-gray-200 font-bold py-4 px-10 rounded-full shadow-lg shadow-white/10 transition-transform active:scale-95 flex items-center gap-2"
                        >
                            {generating ? <><i className="fas fa-spinner fa-spin"></i> Cooking...</> : <><i className="fas fa-fire"></i> Create Plan</>}
                        </button>
                    </div>
                ) : (
                    <div className={`space-y-4 ${generating ? 'opacity-50 blur-sm pointer-events-none transition-all' : ''}`}>
                         {todayPlan.meals && Array.isArray(todayPlan.meals) ? todayPlan.meals.map((meal, idx) => (
                            <div 
                                key={idx}
                                className={`glass-card rounded-2xl overflow-hidden group transition-all duration-300 relative ${
                                    meal.isCompleted ? 'border-green-500/30 bg-green-900/10' : ''
                                }`}
                            >
                                <div className={`p-4 border-b flex justify-between items-center ${meal.isCompleted ? 'bg-green-500/10 border-green-500/20' : 'bg-white/5 border-white/5'}`}>
                                    <h3 className={`font-bold text-lg flex items-center gap-3 ${meal.isCompleted ? 'text-green-100' : 'text-white'}`}>
                                        <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${
                                            meal.isCompleted ? 'bg-green-500 text-white' : 'bg-primary text-black'
                                        }`}>
                                            {idx + 1}
                                        </div>
                                        <span className={meal.isCompleted ? 'line-through decoration-green-500/50 opacity-70' : ''}>
                                            {meal.name}
                                        </span>
                                    </h3>
                                    
                                    <div className="flex items-center gap-3">
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDeviationModal({ isOpen: true, type: 'diet', itemIndex: idx, itemData: meal });
                                            }}
                                            className="w-8 h-8 rounded-full border border-gray-600/50 flex items-center justify-center text-gray-400 hover:text-primary hover:border-primary hover:bg-white/5 transition-all active:scale-95 cursor-pointer"
                                        >
                                            <i className="fas fa-magic text-xs"></i>
                                        </button>

                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation(); 
                                                toggleMealCompletion(idx);
                                            }}
                                            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-300 cursor-pointer ${
                                                meal.isCompleted 
                                                ? 'bg-green-500 border-green-500 scale-110 shadow-[0_0_15px_rgba(34,197,94,0.5)]' 
                                                : 'border-gray-500 hover:border-primary hover:bg-white/5'
                                            }`}
                                        >
                                            {meal.isCompleted && <i className="fas fa-check text-white text-sm"></i>}
                                        </button>
                                    </div>
                                </div>
                                <div className={`p-5 transition-opacity duration-300 ${meal.isCompleted ? 'opacity-60 grayscale-[0.3]' : 'opacity-100'}`}>
                                    <div className="flex justify-between items-start mb-4">
                                         <ul className="space-y-2 flex-1">
                                            {meal.items.map((item: string, i: number) => (
                                                <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                                                    <i className="fas fa-caret-right text-gray-500 mt-1 shrink-0"></i>
                                                    <span className="leading-tight">{item}</span>
                                                </li>
                                            ))}
                                        </ul>
                                        <span className="text-xs font-mono bg-black/40 px-2 py-1 rounded text-gray-400 whitespace-nowrap ml-2 mt-1">
                                            {meal.time}
                                        </span>
                                    </div>
                                    <div className="flex gap-2 pt-3 border-t border-white/5">
                                        <div className="flex-1 grid grid-cols-3 gap-1">
                                            <div className="bg-black/20 rounded p-1 text-center">
                                                <div className="text-[9px] text-gray-500 uppercase">Pro</div>
                                                <div className="text-blue-400 font-bold text-xs">{meal.macros.p}</div>
                                            </div>
                                            <div className="bg-black/20 rounded p-1 text-center">
                                                <div className="text-[9px] text-gray-500 uppercase">Carb</div>
                                                <div className="text-green-400 font-bold text-xs">{meal.macros.c}</div>
                                            </div>
                                            <div className="bg-black/20 rounded p-1 text-center">
                                                <div className="text-[9px] text-gray-500 uppercase">Fat</div>
                                                <div className="text-yellow-400 font-bold text-xs">{meal.macros.f}</div>
                                            </div>
                                        </div>
                                        <div className="bg-primary/10 px-3 rounded-lg flex flex-col justify-center items-center min-w-[60px]">
                                            <div className="text-[9px] text-primary font-bold uppercase">Cal</div>
                                            <div className="text-primary font-bold text-sm">{meal.macros.cal}</div>
                                        </div>
                                    </div>
                                </div>
                                {meal.isCompleted && (
                                    <div className="absolute inset-0 pointer-events-none bg-green-500/5 mix-blend-overlay"></div>
                                )}
                            </div>
                         )) : (
                            <div className="glass-card p-6 text-center text-red-400 flex flex-col items-center">
                                <i className="fas fa-exclamation-triangle mb-2 text-2xl"></i>
                                <p className="text-sm font-bold mb-1">Data Corrupted</p>
                                <button onClick={handleGenerateToday} className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 px-4 py-2 rounded-lg text-xs font-bold transition-colors">
                                   Regenerate Plan
                                </button>
                            </div>
                         )}

                         {/* ADD FOOD BUTTON (IN-LIST) */}
                         <button 
                             onClick={() => {
                                 setAddFoodModal(true);
                                 setAddFoodMethod('ai');
                             }}
                             className="w-full py-4 rounded-xl border-2 border-dashed border-white/10 hover:border-primary/50 text-gray-500 hover:text-white transition-all flex items-center justify-center gap-2 group bg-black/20"
                         >
                             <div className="w-8 h-8 rounded-full bg-white/5 group-hover:bg-primary group-hover:text-black flex items-center justify-center transition-colors">
                                 <i className="fas fa-plus text-xs"></i>
                             </div>
                             <span className="font-bold text-sm">Add Extra Food / Snack</span>
                         </button>
                    </div>
                )}
            </div>
        )}
        
        {/* ... (Workout and Overview tabs remain the same) */}
        {activeTab === 'workout' && (
            <div className="space-y-4 animate-slide-up">
                {!workoutPlan || !workoutPlan.workout ? (
                    <div className="glass-card p-10 rounded-2xl text-center text-gray-400">
                        <i className="fas fa-dumbbell text-4xl mb-4 opacity-50"></i>
                        <p>No workout plan found.</p>
                    </div>
                ) : (
                    workoutPlan.workout.map((day, idx) => (
                        <div key={idx} className="glass-card rounded-2xl overflow-hidden mb-4">
                            <div className="bg-gradient-to-r from-gray-900 to-slate-900 p-4 border-b border-white/5 flex justify-between items-center">
                                <h3 className="font-bold text-white text-lg">{day.day}</h3>
                                <span className="text-xs font-bold bg-white/10 text-white px-3 py-1 rounded-full uppercase tracking-wider">{day.focus}</span>
                            </div>
                            <div className="p-2">
                                {day.exercises.map((ex, i) => (
                                    <div key={i} className="flex justify-between items-center p-3 border-b border-white/5 last:border-0 hover:bg-white/5 rounded-lg transition-colors">
                                        <div>
                                            <div className="text-white font-medium text-sm">{ex.name}</div>
                                            {ex.notes && <div className="text-xs text-gray-500 mt-0.5">{ex.notes}</div>}
                                        </div>
                                        <div className="text-right flex gap-3">
                                            <div className="bg-black/40 px-3 py-1.5 rounded-lg min-w-[60px] text-center">
                                                <div className="text-[10px] text-gray-500 uppercase">Sets</div>
                                                <div className="text-primary font-bold text-sm">{ex.sets}</div>
                                            </div>
                                            <div className="bg-black/40 px-3 py-1.5 rounded-lg min-w-[60px] text-center">
                                                <div className="text-[10px] text-gray-500 uppercase">Reps</div>
                                                <div className="text-white font-bold text-sm">{ex.reps}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        )}

        {/* Overview & Analytics Tab (Abbreviated to keep file valid, ensuring full logic is retained) */}
        {activeTab === 'overview' && (
             <div className="animate-slide-up space-y-6">
                 {/* Predictive Analytics Card */}
                 <div className="glass-card p-6 rounded-2xl border border-primary/20 bg-gradient-to-br from-secondary to-dark relative overflow-hidden">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <i className="fas fa-brain text-primary animate-pulse"></i> AI Prediction
                        </h3>
                        {prediction && (
                            <span className={`text-xs px-2 py-1 rounded border ${prediction.confidenceScore > 70 ? 'border-green-500 text-green-400 bg-green-900/20' : 'border-yellow-500 text-yellow-400 bg-yellow-900/20'}`}>
                                {prediction.confidenceScore}% Confidence
                            </span>
                        )}
                    </div>
                    
                    {!prediction || prediction.confidenceScore < 10 ? (
                        <div className="text-center py-6 text-gray-500">
                            <i className="fas fa-chart-line text-4xl mb-3 opacity-30"></i>
                            <p className="text-xs">Log at least 2 weight entries to unlock predictions.</p>
                        </div>
                    ) : (
                        <div>
                             <div className="grid grid-cols-2 gap-4 mb-6">
                                 <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                                     <div className="text-xs text-gray-400 mb-1">In 4 Weeks</div>
                                     <div className="text-2xl font-black text-white">{prediction.projectedWeightIn4Weeks} <span className="text-xs font-medium text-gray-500">kg</span></div>
                                 </div>
                                 <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                                     <div className="text-xs text-gray-400 mb-1">Weekly Trend</div>
                                     <div className={`text-2xl font-black ${prediction.trendAnalysis.weeklyRateOfChange < 0 ? 'text-green-400' : 'text-yellow-400'}`}>
                                         {prediction.trendAnalysis.weeklyRateOfChange > 0 ? '+' : ''}{prediction.trendAnalysis.weeklyRateOfChange} <span className="text-xs font-medium text-gray-500">kg</span>
                                     </div>
                                 </div>
                             </div>

                             {/* SVG Trend Graph Logic maintained */}
                             <div className="h-32 w-full mb-4 relative">
                                {(() => {
                                    const data = prediction.graphData;
                                    const maxW = Math.max(...data.map(d => d.weight)) + 1;
                                    const minW = Math.min(...data.map(d => d.weight)) - 1;
                                    const range = maxW - minW;
                                    const stepX = 100 / (data.length - 1);
                                    
                                    const points = data.map((d, i) => {
                                        const x = i * stepX;
                                        const y = 100 - ((d.weight - minW) / range) * 100;
                                        return `${x},${y}`;
                                    }).join(' ');

                                    return (
                                        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                                            <line x1="0" y1="25" x2="100" y2="25" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
                                            <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
                                            <line x1="0" y1="75" x2="100" y2="75" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
                                            
                                            <polyline 
                                                points={points} 
                                                fill="none" 
                                                stroke="#FFD700" 
                                                strokeWidth="2" 
                                                strokeDasharray="4,1"
                                                className="drop-shadow-lg"
                                            />
                                            
                                            {data.map((d, i) => {
                                                const x = i * stepX;
                                                const y = 100 - ((d.weight - minW) / range) * 100;
                                                return (
                                                    <g key={i}>
                                                        <circle cx={x} cy={y} r={d.isProjection ? "2" : "3"} fill={d.isProjection ? "#fff" : "#FFD700"} opacity={d.isProjection ? 0.5 : 1} />
                                                        {(i === 0 || i === data.length - 1 || (!d.isProjection && data[i+1]?.isProjection)) && (
                                                            <text x={x} y={y - 8} fontSize="5" fill="white" textAnchor="middle">{d.weight}</text>
                                                        )}
                                                    </g>
                                                )
                                            })}
                                        </svg>
                                    );
                                })()}
                             </div>

                             <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                                 <p className="text-xs text-gray-300 leading-relaxed">
                                     <i className={`fas fa-info-circle mr-2 ${prediction.trendAnalysis.isHealthyPace ? 'text-green-400' : 'text-red-400'}`}></i>
                                     {prediction.trendAnalysis.recommendation}
                                 </p>
                             </div>
                        </div>
                    )}
                 </div>

                 {/* Weekly Budget Summary */}
                 <div className="glass-card p-4 rounded-xl mb-6 border border-primary/20 bg-primary/5">
                    <h3 className="text-primary font-bold mb-3 text-sm uppercase tracking-wider flex items-center gap-2">
                        <i className="fas fa-wallet"></i> Weekly Budget (Checked Meals)
                    </h3>
                    
                    {(() => {
                        const weeklyLimit = profile.weekly_calories || (plan.calories * 7);
                        const weeklyConsumed = recentPlans.reduce((acc, p) => 
                            acc + p.meals.reduce((mAcc, m) => m.isCompleted ? mAcc + m.macros.cal : mAcc, 0), 
                        0);
                        const weeklyPct = weeklyLimit > 0 ? Math.min(100, (weeklyConsumed / weeklyLimit) * 100) : 0;

                        return (
                            <>
                                <div className="flex justify-between items-end mb-2">
                                    <div>
                                        <span className="text-2xl font-black text-white">{weeklyConsumed}</span>
                                        <span className="text-[10px] text-gray-400 font-bold uppercase ml-1">/ {weeklyLimit} kcal</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xs text-gray-400 block">Status</span>
                                        <span className={`font-bold ${weeklyConsumed > weeklyLimit ? 'text-red-500' : 'text-green-500'}`}>
                                            {weeklyConsumed > weeklyLimit ? 'Over Budget' : 'On Track'}
                                        </span>
                                    </div>
                                </div>
                                <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full ${weeklyConsumed > weeklyLimit ? 'bg-red-500' : 'bg-primary'}`}
                                        style={{ width: `${weeklyPct}%` }}
                                    ></div>
                                </div>
                            </>
                        );
                    })()}
                 </div>

                 <h3 className="text-white font-bold mb-4 text-sm uppercase tracking-wider opacity-70">Recent History</h3>
                 <div className="space-y-3">
                    {recentPlans.length === 0 ? (
                        <div className="text-center text-gray-500 py-10">No history available yet.</div>
                    ) : (
                        recentPlans.map((p, idx) => {
                            const completedCals = p.meals.reduce((acc, m) => m.isCompleted ? acc + m.macros.cal : acc, 0);
                            return (
                                <div key={idx} className="glass-card p-4 rounded-xl flex justify-between items-center">
                                    <div>
                                        <div className="text-white font-bold text-sm">{p.date}</div>
                                        <div className="text-xs text-gray-400 mt-1">Consumed: {completedCals} kcal</div>
                                    </div>
                                    <div className="flex gap-3 text-xs font-mono">
                                        <span className={`px-2 py-1 rounded ${completedCals > 0 ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-500'}`}>
                                            {completedCals > 0 ? 'Tracked' : 'Empty'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                 </div>
             </div>
        )}
      </div>

      {/* FLOATING ACTION BUTTON FOR DIET TAB */}
      {activeTab === 'diet' && todayPlan && (
          <button 
              onClick={() => {
                  setAddFoodMethod('ai');
                  setAddFoodModal(true);
              }}
              className="fixed bottom-24 right-4 w-12 h-12 bg-primary hover:bg-orange-500 text-black rounded-full shadow-xl shadow-primary/30 flex items-center justify-center z-40 transition-transform active:scale-95 border-2 border-white/20 animate-slide-up"
          >
              <i className="fas fa-plus text-lg"></i>
          </button>
      )}

      {/* DEVIATION MODAL (Existing logic preserved) */}
      {deviationModal.isOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[70] p-4 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl relative border-primary/30">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-orange-600"></div>
            
            <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <i className="fas fa-exclamation-triangle text-orange-500"></i> Report Deviation
                        </h2>
                        <p className="text-xs text-gray-400 mt-1">Editing: <span className="text-primary">{deviationModal.itemData?.name}</span></p>
                    </div>
                    <button onClick={() => setDeviationModal(prev => ({...prev, isOpen: false}))} className="text-gray-500 hover:text-white">
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className="bg-white/5 p-3 rounded-xl mb-4 border border-white/5">
                    <p className="text-[11px] text-gray-300 leading-relaxed">
                        Did you eat something else? Or miss a meal?
                        <br/>
                        <span className="text-primary font-bold">The AI will adjust the rest of your day (Zigzag) to keep you on track.</span>
                    </p>
                </div>
                <textarea
                    value={deviationInput}
                    onChange={(e) => setDeviationInput(e.target.value)}
                    placeholder="e.g. Ate 2 slices of Pizza instead..."
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary outline-none h-24 resize-none mb-4"
                    autoFocus
                />
                <button 
                    onClick={handleSubmitDeviation}
                    disabled={isProcessingDeviation || !deviationInput.trim()}
                    className="w-full bg-primary hover:bg-orange-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isProcessingDeviation ? (
                        <>
                            <i className="fas fa-circle-notch fa-spin"></i> Balancing Calories...
                        </>
                    ) : (
                        <>
                            <i className="fas fa-calculator"></i> Update & Balance
                        </>
                    )}
                </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD FOOD MODAL */}
      {addFoodModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[70] p-4 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl relative border-primary/30">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-orange-600"></div>
            
            <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <i className="fas fa-plus-circle text-primary"></i> Add Food
                        </h2>
                        <p className="text-xs text-gray-400 mt-1">Track extra calories</p>
                    </div>
                    <button onClick={() => { setAddFoodModal(false); setAddFoodInput(''); setManualEntry({ name: '', cal: '', p: '', c: '', f: '' }); }} className="text-gray-500 hover:text-white">
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                {/* TABS FOR ADD FOOD */}
                <div className="flex bg-black/40 p-1 rounded-xl mb-4 border border-white/5">
                    <button 
                        onClick={() => setAddFoodMethod('ai')}
                        className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${addFoodMethod === 'ai' ? 'bg-primary text-black' : 'text-gray-400 hover:text-white'}`}
                    >
                        AI Auto-Track
                    </button>
                    <button 
                        onClick={() => setAddFoodMethod('manual')}
                        className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${addFoodMethod === 'manual' ? 'bg-primary text-black' : 'text-gray-400 hover:text-white'}`}
                    >
                        Manual Entry
                    </button>
                </div>

                {addFoodMethod === 'ai' ? (
                    <textarea
                        value={addFoodInput}
                        onChange={(e) => setAddFoodInput(e.target.value)}
                        placeholder="e.g. '1 Banana and a protein shake'..."
                        className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary outline-none h-28 resize-none mb-4"
                        autoFocus
                    />
                ) : (
                    <div className="space-y-3 mb-4">
                        <div>
                             <input 
                                type="text"
                                value={manualEntry.name}
                                onChange={(e) => setManualEntry(prev => ({...prev, name: e.target.value}))}
                                placeholder="Food Name (e.g. Apple)"
                                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary outline-none"
                             />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                             <input 
                                type="number"
                                value={manualEntry.cal}
                                onChange={(e) => setManualEntry(prev => ({...prev, cal: e.target.value}))}
                                placeholder="Calories"
                                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary outline-none"
                             />
                             <input 
                                type="number"
                                value={manualEntry.p}
                                onChange={(e) => setManualEntry(prev => ({...prev, p: e.target.value}))}
                                placeholder="Protein (g)"
                                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary outline-none"
                             />
                        </div>
                         <div className="grid grid-cols-2 gap-3">
                             <input 
                                type="number"
                                value={manualEntry.c}
                                onChange={(e) => setManualEntry(prev => ({...prev, c: e.target.value}))}
                                placeholder="Carbs (g)"
                                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary outline-none"
                             />
                             <input 
                                type="number"
                                value={manualEntry.f}
                                onChange={(e) => setManualEntry(prev => ({...prev, f: e.target.value}))}
                                placeholder="Fat (g)"
                                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary outline-none"
                             />
                        </div>
                    </div>
                )}

                <button 
                    onClick={handleSubmitAddFood}
                    disabled={isAddingFood || (addFoodMethod === 'ai' ? !addFoodInput.trim() : (!manualEntry.name || !manualEntry.cal))}
                    className="w-full bg-white text-black hover:bg-gray-200 font-bold py-3 rounded-xl transition-all shadow-lg flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isAddingFood ? (
                        <>
                            <i className="fas fa-circle-notch fa-spin"></i> Processing...
                        </>
                    ) : (
                        <>
                            <i className="fas fa-check"></i> Add to Log
                        </>
                    )}
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
