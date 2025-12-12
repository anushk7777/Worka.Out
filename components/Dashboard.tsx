// ... (imports remain the same)
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UserProfile, MacroPlan, PersonalizedPlan, DailyMealPlanDB, DietMeal } from '../types';
import { calculatePlan } from './Calculator';
import { supabase } from '../services/supabaseClient';
import { generateDailyMealPlan, handleDietDeviation } from '../services/geminiService';

interface Props {
  userId: string;
  profile: UserProfile;
  workoutPlan: PersonalizedPlan | null;
  onSignOut: () => void;
}

type DietType = 'veg' | 'egg' | 'non-veg';

// ... (useLongPress hook remains the same)
const useLongPress = (callback: (e: any) => void, ms = 600) => {
    const timerRef = useRef<any>(null); 

    const start = useCallback(() => {
        timerRef.current = setTimeout(() => {
            callback({});
            if (navigator.vibrate) navigator.vibrate(50);
        }, ms);
    }, [callback, ms]);

    const stop = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    return {
        onMouseDown: start,
        onMouseUp: stop,
        onMouseLeave: stop,
        onTouchStart: start,
        onTouchEnd: stop,
        onTouchMove: stop, 
        className: "select-none touch-pan-y" 
    };
};

const Dashboard: React.FC<Props> = ({ userId, profile, workoutPlan, onSignOut }) => {
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
  const [dietType, setDietType] = useState<DietType>('non-veg');

  // Deviation Modal State
  const [deviationModal, setDeviationModal] = useState<{
      isOpen: boolean;
      type: 'diet' | 'workout';
      itemIndex: number; 
      itemData: any;
  }>({ isOpen: false, type: 'diet', itemIndex: -1, itemData: null });
  const [deviationInput, setDeviationInput] = useState('');
  const [isProcessingDeviation, setIsProcessingDeviation] = useState(false);

  // --- DERIVED STATE (REAL-TIME TRACKING) ---
  // Calculate consumed macros based on CHECKED meals only
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

  // Calculate Macro Percentages for Visuals (Consumed vs Target)
  const totalCalTarget = plan.calories || 2000;
  
  // Progress percentages (capped at 100 for bar width, but value text can go higher)
  const calPct = Math.min(100, Math.round((consumed.cal / totalCalTarget) * 100));
  const pPct = Math.min(100, Math.round((consumed.p / plan.protein) * 100));
  const cPct = Math.min(100, Math.round((consumed.c / plan.carbs) * 100));
  const fPct = Math.min(100, Math.round((consumed.f / plan.fats) * 100));

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

  // --- DATA FETCHING ---
  useEffect(() => {
    fetchDailyPlans();
  }, [userId]); 

  const fetchDailyPlans = async () => {
    setLoading(true);
    const today = getTodayDate();
    
    try {
        const { data, error } = await supabase
          .from('daily_meal_plans')
          .select('*')
          .eq('user_id', userId) 
          .order('date', { ascending: false })
          .limit(7);

        if (error) throw error;

        if (data) {
            const validData = data.filter((p: any) => p && p.meals && Array.isArray(p.meals));
            setRecentPlans(validData);
            
            const todayEntry = validData.find((p: any) => p.date === today);
            setTodayPlan(todayEntry || null);
        }
    } catch (err) {
        console.error("Failed to fetch plans", err);
    }
    setLoading(false);
  };

  // --- ACTIONS ---

  // CHECKLIST TOGGLE Logic
  const toggleMealCompletion = async (index: number) => {
    if (!todayPlan) return;

    // 1. Optimistic Update
    const updatedMeals = [...todayPlan.meals];
    updatedMeals[index] = {
        ...updatedMeals[index],
        isCompleted: !updatedMeals[index].isCompleted
    };

    const updatedPlan = { ...todayPlan, meals: updatedMeals };
    setTodayPlan(updatedPlan);

    // 2. Persist to DB
    try {
        const { error } = await supabase
            .from('daily_meal_plans')
            .update({ meals: updatedMeals })
            .eq('id', todayPlan.id);

        if (error) throw error;

        // Update history cache for stats
        setRecentPlans(prev => [updatedPlan, ...prev.filter(p => p.date !== todayPlan.date)]);

    } catch (err) {
        console.error("Failed to update meal status", err);
        // Revert on error
        setTodayPlan(todayPlan); 
        alert("Failed to save progress. Check connection.");
    }
  };

  // ... (Zigzag Logic - Unchanged)
  const calculateZigzagTarget = (todayStr: string) => {
    const today = new Date();
    const dayOfWeek = today.getDay(); 
    const daysSinceMonday = (dayOfWeek + 6) % 7; 
    
    // ZIGZAG CALCULATION: Sum ONLY COMPLETED calories from history
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
    
    // Summing only checked meals for accuracy
    weekHistory.forEach(day => {
        const dayConsumed = day.meals.reduce((sum, m) => m.isCompleted ? sum + m.macros.cal : sum, 0);
        // Fallback: If no meals are marked completed (old data), maybe assume full day? 
        // For now, strict adherence: if not checked, not eaten.
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
             contextNote = `ALERT: User is currently ${netSurplus} kcal OVER weekly budget (based on checked meals). \nSTRATEGY: Reduce daily target by ${adjustmentPerDay} kcal.`;
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
        
        // Refetch to get ID
        const { data: refreshedData } = await supabase.from('daily_meal_plans').select('*').eq('user_id', userId).eq('date', today).single();
        
        setTodayPlan(refreshedData || newPlan);
        setRecentPlans(prev => [refreshedData || newPlan, ...prev.filter(p => p.date !== today)]);
        setPreferences(''); 
    } catch (err: any) {
        alert(`Failed to generate plan: ${err.message}`);
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
            const updatedPlan = await handleDietDeviation(todayPlan, plan, deviationModal.itemIndex, deviationInput);
            
            // Auto-check the meal being deviated/reported
            updatedPlan.meals[deviationModal.itemIndex].isCompleted = true;

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
    } catch (err) {
        alert("Could not adjust plan.");
    } finally {
        setIsProcessingDeviation(false);
    }
  };

  // --- COMPONENT: CHECKLIST MEAL CARD ---
  const DietMealCard: React.FC<{ meal: DietMeal, index: number }> = ({ meal, index }) => {
      const longPressProps = useLongPress(() => {
          setDeviationModal({ isOpen: true, type: 'diet', itemIndex: index, itemData: meal });
      });

      return (
        <div 
            {...longPressProps}
            className={`glass-card rounded-2xl overflow-hidden group transition-all duration-300 relative ${
                meal.isCompleted ? 'border-green-500/30 bg-green-900/10' : ''
            } ${longPressProps.className}`}
        >
            {/* Header / Checkbox Area */}
            <div className={`p-4 border-b flex justify-between items-center ${meal.isCompleted ? 'bg-green-500/10 border-green-500/20' : 'bg-white/5 border-white/5'}`}>
                <h3 className={`font-bold text-lg flex items-center gap-3 ${meal.isCompleted ? 'text-green-100' : 'text-white'}`}>
                    <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${
                        meal.isCompleted ? 'bg-green-500 text-white' : 'bg-primary text-black'
                    }`}>
                        {index + 1}
                    </div>
                    <span className={meal.isCompleted ? 'line-through decoration-green-500/50 opacity-70' : ''}>
                        {meal.name}
                    </span>
                </h3>
                
                {/* Custom Checkbox */}
                <button 
                    onClick={(e) => {
                        e.stopPropagation(); // Prevent Long Press trigger
                        toggleMealCompletion(index);
                    }}
                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                        meal.isCompleted 
                        ? 'bg-green-500 border-green-500 scale-110 shadow-[0_0_15px_rgba(34,197,94,0.5)]' 
                        : 'border-gray-500 hover:border-primary hover:bg-white/5'
                    }`}
                >
                    {meal.isCompleted && <i className="fas fa-check text-white text-sm"></i>}
                </button>
            </div>

            {/* Content */}
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
                    {/* Compact Macros */}
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
            
            {/* Completion Overlay Flash (Optional, nice touch) */}
            {meal.isCompleted && (
                <div className="absolute inset-0 pointer-events-none bg-green-500/5 mix-blend-overlay"></div>
            )}
        </div>
      );
  };

  // --- RENDER ---
  return (
    <div className="p-4 space-y-6 pb-28 max-w-2xl mx-auto">
      {/* Header Section */}
      <div className="flex justify-between items-center animate-fade-in">
        <div>
          <p className="text-gray-400 text-sm font-medium">{getTimeGreeting()},</p>
          <h1 className="text-3xl font-black text-white tracking-tight">{profile.name}</h1>
        </div>
        <button 
          onClick={onSignOut}
          className="bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 w-10 h-10 rounded-full flex items-center justify-center transition-all backdrop-blur-md border border-white/5"
        >
          <i className="fas fa-power-off text-sm"></i>
        </button>
      </div>

      {/* Hero Macro Card - UPDATED TO SHOW CONSUMED vs TARGET */}
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
                {/* Daily Progress Bar */}
                <div className="w-full bg-gray-800 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div 
                        className={`h-full rounded-full transition-all duration-700 ease-out ${consumed.cal > totalCalTarget ? 'bg-red-500' : 'bg-primary'}`} 
                        style={{ width: `${calPct}%` }}
                    ></div>
                </div>
            </div>

            {/* Macro Bars */}
            <div className="flex gap-4">
                {/* Protein */}
                <div className="flex-1 bg-[#161b2c] p-3 rounded-xl border border-white/5 relative overflow-hidden group">
                    <div className="flex justify-between items-end mb-1">
                        <p className="text-[9px] text-gray-500 uppercase font-bold">Protein</p>
                        <p className="text-[9px] text-gray-500 font-mono">{Math.round(consumed.p)} / {plan.protein}g</p>
                    </div>
                    <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden mt-1">
                        <div className="h-full bg-blue-600 rounded-full transition-all duration-1000 ease-out" style={{ width: `${pPct}%` }}></div>
                    </div>
                </div>

                {/* Carbs */}
                <div className="flex-1 bg-[#161b2c] p-3 rounded-xl border border-white/5 relative overflow-hidden group">
                     <div className="flex justify-between items-end mb-1">
                        <p className="text-[9px] text-gray-500 uppercase font-bold">Carbs</p>
                        <p className="text-[9px] text-gray-500 font-mono">{Math.round(consumed.c)} / {plan.carbs}g</p>
                    </div>
                    <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden mt-1">
                         <div className="h-full bg-green-600 rounded-full transition-all duration-1000 ease-out" style={{ width: `${cPct}%` }}></div>
                    </div>
                </div>

                {/* Fats */}
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

      {/* Modern Tabs */}
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
                {/* Date & Actions */}
                <div className="flex justify-between items-center px-1">
                    <span className="text-white font-bold text-lg">{getTodayDate()}</span>
                    {todayPlan && !showRegenInput && (
                        <div className="text-xs text-gray-500 italic flex items-center gap-2">
                             <i className="fas fa-check-square text-primary"></i> Check meals to track calories
                        </div>
                    )}
                </div>

                {/* Diet Selection Slider - Visible when no plan or editing */}
                {(!todayPlan || showRegenInput) && (
                    <div className="glass-card p-1 rounded-2xl mb-4 relative overflow-hidden">
                        <div className="relative flex justify-between z-10">
                            {/* Veg Option */}
                            <button 
                                onClick={() => setDietType('veg')}
                                className={`flex-1 py-4 flex flex-col items-center gap-1 transition-all duration-300 ${dietType === 'veg' ? 'text-green-900' : 'text-gray-500'}`}
                            >
                                <div className={`text-2xl transition-transform duration-300 ${dietType === 'veg' ? 'scale-125 animate-bounce' : ''}`}>
                                    <i className="fas fa-carrot"></i>
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-wider">Veg</span>
                            </button>

                            {/* Egg Option */}
                            <button 
                                onClick={() => setDietType('egg')}
                                className={`flex-1 py-4 flex flex-col items-center gap-1 transition-all duration-300 ${dietType === 'egg' ? 'text-yellow-900' : 'text-gray-500'}`}
                            >
                                <div className={`text-2xl transition-transform duration-300 ${dietType === 'egg' ? 'scale-125 rotate-12' : ''}`}>
                                    <i className="fas fa-egg"></i>
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-wider">Egg</span>
                            </button>

                            {/* Non-Veg Option */}
                            <button 
                                onClick={() => setDietType('non-veg')}
                                className={`flex-1 py-4 flex flex-col items-center gap-1 transition-all duration-300 ${dietType === 'non-veg' ? 'text-red-900' : 'text-gray-500'}`}
                            >
                                <div className={`text-2xl transition-transform duration-300 ${dietType === 'non-veg' ? 'scale-125 pulse' : ''}`}>
                                    <i className="fas fa-drumstick-bite"></i>
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-wider">Non-Veg</span>
                            </button>
                        </div>

                        {/* Sliding Background */}
                        <div 
                            className="absolute top-1 bottom-1 w-[32%] bg-gradient-to-br rounded-xl transition-all duration-300 ease-out z-0 shadow-lg"
                            style={{
                                left: dietType === 'veg' ? '1%' : dietType === 'egg' ? '34%' : '67%',
                                background: dietType === 'veg' 
                                    ? 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)' 
                                    : dietType === 'egg' 
                                    ? 'linear-gradient(135deg, #facc15 0%, #eab308 100%)' 
                                    : 'linear-gradient(135deg, #f87171 0%, #dc2626 100%)'
                            }}
                        >
                            <div className="absolute top-0 right-0 w-8 h-8 bg-white/20 rounded-full blur-sm -mr-2 -mt-2"></div>
                            <div className="absolute bottom-0 left-0 w-6 h-6 bg-white/10 rounded-full blur-sm -ml-1 -mb-1"></div>
                        </div>
                    </div>
                )}

                {/* Regeneration Input Panel */}
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
                            placeholder="e.g. 'I ate 500g Chicken Biryani for lunch, adjust my dinner' OR 'Suggest Vegetarian dinner'..."
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
                        <p className="text-gray-500 text-sm mb-6 max-w-xs">No meal plan generated for today yet. Select your diet type and let the AI Chef cook.</p>
                        
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
                            <DietMealCard key={idx} meal={meal} index={idx} />
                         )) : (
                            <div className="glass-card p-6 text-center text-red-400 flex flex-col items-center">
                                <i className="fas fa-exclamation-triangle mb-2 text-2xl"></i>
                                <p className="text-sm font-bold mb-1">Data Corrupted</p>
                                <button onClick={handleGenerateToday} className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 px-4 py-2 rounded-lg text-xs font-bold transition-colors">
                                   Regenerate Plan
                                </button>
                            </div>
                         )}
                    </div>
                )}
            </div>
        )}

        {/* ... (Workout and Overview tabs remain similar) ... */}
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

        {activeTab === 'overview' && (
             <div className="animate-slide-up">
                 {/* Weekly Budget Summary */}
                 <div className="glass-card p-4 rounded-xl mb-6 border border-primary/20 bg-primary/5">
                    <h3 className="text-primary font-bold mb-3 text-sm uppercase tracking-wider flex items-center gap-2">
                        <i className="fas fa-wallet"></i> Weekly Budget (Checked Meals)
                    </h3>
                    
                    {(() => {
                        // Calculate total consumed from completed meals in history
                        const weeklyLimit = profile.weekly_calories || (plan.calories * 7);
                        const weeklyConsumed = recentPlans.reduce((acc, p) => 
                            acc + p.meals.reduce((mAcc, m) => m.isCompleted ? mAcc + m.macros.cal : mAcc, 0), 
                        0);
                        const weeklyPct = Math.min(100, (weeklyConsumed / weeklyLimit) * 100);

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

                    <p className="text-[10px] text-gray-500 mt-2 text-center">
                        Tracks only meals marked as checked. Adjustments (Zigzag) are automatic.
                    </p>
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

      {/* --- DEVIATION MODAL --- */}
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
    </div>
  );
};

export default Dashboard;
