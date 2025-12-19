
import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, MacroPlan, PersonalizedPlan, DailyMealPlanDB, DietMeal, ProgressEntry, WeightPrediction, FoodItem } from '../types';
import { calculatePlan } from './Calculator';
import { supabase } from '../services/supabaseClient';
import { generateDailyMealPlan, handleDietDeviation } from '../services/geminiService';
import { predictWeightTrajectory } from '../services/analyticsService';
import BarcodeScanner from './BarcodeScanner';
import { FOOD_DATABASE, MOTIVATIONAL_QUOTES } from '../constants'; 

interface Props {
  userId: string;
  profile: UserProfile;
  workoutPlan: PersonalizedPlan | null;
  logs?: ProgressEntry[]; 
  onSignOut: () => void;
  onNavigate: (tab: 'dashboard' | 'supplements' | 'progress' | 'profile') => void;
  refreshTrigger?: number; 
}

type DietType = 'veg' | 'egg' | 'non-veg';
type TimePhase = 'morning' | 'noon' | 'evening' | 'night';

// --- SUB-COMPONENTS FOR CONTEXTUAL ANIMATIONS ---
const MorningComponent = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-[32px] z-0 bg-[#0F172A]">
    <div className="absolute inset-0 bg-gradient-to-b from-[#0f172a] via-[#1e3a8a] to-[#7c2d12] opacity-90"></div>
    <div className="absolute -bottom-16 -left-10 w-72 h-72 bg-gradient-to-tr from-orange-500 via-yellow-500 to-transparent rounded-full blur-[70px] animate-sunrise opacity-70"></div>
    <div className="absolute bottom-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-yellow-200/10 via-transparent to-transparent animate-pulse-slow"></div>
    <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/20"></div>
  </div>
);

const NoonComponent = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-[32px] z-0 bg-[#0ea5e9]">
    <div className="absolute inset-0 bg-gradient-to-br from-[#0284c7] via-[#38bdf8] to-[#bae6fd]"></div>
    <div className="absolute -top-10 -right-10 w-64 h-64 bg-yellow-300 rounded-full blur-[50px] opacity-60 animate-pulse-slow"></div>
    <div className="absolute top-[-20px] right-[-20px] w-40 h-40 bg-gradient-to-br from-yellow-100 to-yellow-400 rounded-full shadow-[0_0_60px_rgba(253,224,71,0.6)]"></div>
    <div className="absolute top-1/2 left-1/4 w-32 h-32 bg-white/10 rounded-full blur-[40px] mix-blend-overlay"></div>
    <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/10 to-transparent"></div>
  </div>
);

const EveningComponent = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-[32px] z-0 bg-[#4c1d95]">
    <div className="absolute inset-0 bg-gradient-to-br from-[#312e81] via-[#701a75] to-[#ea580c]"></div>
    <div className="absolute bottom-10 -right-10 w-56 h-56 bg-gradient-to-t from-orange-600 via-red-500 to-transparent rounded-full blur-[50px] opacity-80 animate-pulse-slow"></div>
    <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent"></div>
    <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/20"></div>
  </div>
);

const NightComponent = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-[32px] z-0 bg-[#020617]">
    <div className="absolute inset-0 bg-gradient-to-br from-[#020617] via-[#0f172a] to-[#1e1b4b]"></div>
    <div className="absolute top-8 right-8 w-24 h-24 bg-gray-200 rounded-full shadow-[0_0_40px_rgba(255,255,255,0.1)] animate-moonrise opacity-90">
       <div className="absolute inset-0 rounded-full bg-gradient-to-br from-transparent to-black/30"></div>
       <div className="absolute top-4 left-3 w-4 h-4 bg-[#94a3b8] rounded-full opacity-30"></div>
       <div className="absolute top-10 left-10 w-6 h-6 bg-[#94a3b8] rounded-full opacity-20"></div>
    </div>
    <div className="absolute top-10 left-10 w-0.5 h-0.5 bg-white rounded-full animate-twinkle shadow-[0_0_4px_white]"></div>
    <div className="absolute top-24 left-1/3 w-1 h-1 bg-white/70 rounded-full animate-twinkle delay-75"></div>
    <div className="absolute bottom-1/3 right-1/2 w-0.5 h-0.5 bg-white/50 rounded-full animate-twinkle delay-150"></div>
    <div className="absolute top-1/2 left-10 w-1 h-1 bg-white/80 rounded-full animate-twinkle delay-300"></div>
    <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent"></div>
  </div>
);

const TypewriterText = ({ text }: { text: string }) => {
  const [displayedText, setDisplayedText] = useState('');
  const index = useRef(0);

  useEffect(() => {
    index.current = 0;
    setDisplayedText('');
    const intervalId = setInterval(() => {
      if (index.current < text.length) {
        setDisplayedText((prev) => prev + text.charAt(index.current));
        index.current++;
      } else {
        clearInterval(intervalId);
      }
    }, 40);
    return () => clearInterval(intervalId);
  }, [text]);

  return (
    <div className="mt-5 relative pl-4 border-l-[3px] border-primary/50 min-h-[3.5rem] bg-black/10 rounded-r-xl py-1 backdrop-blur-[2px]">
      <p className="text-[13px] text-gray-100 font-medium leading-relaxed tracking-wide drop-shadow-sm font-sans">
        {displayedText}
        <span className="inline-block w-1.5 h-4 bg-primary ml-1 animate-blink align-sub shadow-[0_0_8px_rgba(255,215,0,0.6)]"></span>
      </p>
    </div>
  );
};

const FadeInItem: React.FC<{ children: React.ReactNode, delay?: number }> = ({ children, delay = 0 }) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '50px' }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div 
        ref={ref} 
        className={`transition-all duration-700 ease-spring transform will-change-transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`} 
        style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

export const Dashboard: React.FC<Props> = ({ userId, profile, workoutPlan, logs = [], onSignOut, onNavigate, refreshTrigger }) => {
  // 1. Calculate Plan Source of Truth with ULTRA-ELITE ENGINE
  const plan: MacroPlan = profile.daily_calories 
    ? { ...calculatePlan(profile), calories: profile.daily_calories } 
    : calculatePlan(profile);
    
  const [activeTab, setActiveTab] = useState<'overview' | 'diet' | 'workout'>('diet');
  const [todayPlan, setTodayPlan] = useState<DailyMealPlanDB | null>(null);
  const [recentPlans, setRecentPlans] = useState<DailyMealPlanDB[]>([]);
  
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showRegenModal, setShowRegenModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [visualHaptic, setVisualHaptic] = useState<{type: 'success' | 'error', id: string} | null>(null);
  
  const [motivationalQuote, setMotivationalQuote] = useState('');
  
  const [pullY, setPullY] = useState(0);
  const [pullUpY, setPullUpY] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const [showQuickStats, setShowQuickStats] = useState(false);

  const [regenPreferences, setRegenPreferences] = useState('');
  const [regenDietType, setRegenDietType] = useState<DietType>((profile.dietary_preference as DietType) || 'non-veg');
  const [regenCalories, setRegenCalories] = useState<number>(plan.calories);

  const [editingMeal, setEditingMeal] = useState<{index: number, name: string} | null>(null);
  const [editInstruction, setEditInstruction] = useState('');
  const [isEditingMeal, setIsEditingMeal] = useState(false);

  const [addFoodModal, setAddFoodModal] = useState(false);
  const [addFoodInput, setAddFoodInput] = useState('');
  const [searchResults, setSearchResults] = useState<FoodItem[]>([]);
  const [selectedFoodItem, setSelectedFoodItem] = useState<FoodItem | null>(null);
  const [inputQuantity, setInputQuantity] = useState<string>(''); 
  const [prediction, setPrediction] = useState<WeightPrediction | null>(null);

  useEffect(() => {
    const random = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
    setMotivationalQuote(random);
  }, []);

  useEffect(() => {
      setRegenDietType((profile.dietary_preference as DietType) || 'non-veg');
      setRegenCalories(profile.daily_calories || calculatePlan(profile).calories);
  }, [profile]);

  const getErrorMessage = (error: any) => {
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    return error?.message || 'An unexpected error occurred';
  };

  useEffect(() => {
      if (addFoodInput.length > 1 && !selectedFoodItem) {
          const term = addFoodInput.toLowerCase();
          const results = FOOD_DATABASE.filter(f => f.name.toLowerCase().includes(term)).slice(0, 8);
          setSearchResults(results);
      } else {
          setSearchResults([]);
      }
  }, [addFoodInput, selectedFoodItem]);

  const getConsumedMacros = (currentPlan: DailyMealPlanDB | null) => {
    if (!currentPlan || !currentPlan.meals || !Array.isArray(currentPlan.meals)) return { p: 0, c: 0, f: 0, cal: 0 };
    return currentPlan.meals.reduce((acc, meal) => {
      if (meal.isCompleted) {
        return {
          p: acc.p + (meal.macros?.p || 0),
          c: acc.c + (meal.macros?.c || 0),
          f: acc.f + (meal.macros?.f || 0),
          cal: acc.cal + (meal.macros?.cal || 0),
        };
      }
      return acc;
    }, { p: 0, c: 0, f: 0, cal: 0 });
  };

  const consumed = getConsumedMacros(todayPlan);
  const totalCalTarget = plan.calories || 2000;
  const calPct = totalCalTarget > 0 ? Math.min(100, Math.round((consumed.cal / totalCalTarget) * 100)) : 0;

  // CHECK FOR PLAN MISMATCH
  const currentPlanCalories = todayPlan?.macros?.cal || 0;
  const isPlanMismatch = todayPlan && Math.abs(currentPlanCalories - plan.calories) > 150;

  const getTodayDate = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const currentHour = new Date().getHours();
  
  let timePhase: TimePhase = 'night';
  let greetingText = 'Good Evening';
  let PhaseIcon = <i className="fas fa-moon text-indigo-300"></i>;

  if (currentHour >= 5 && currentHour < 11) {
      timePhase = 'morning';
      greetingText = 'Good Morning';
      PhaseIcon = <i className="fas fa-sun text-orange-300"></i>;
  } else if (currentHour >= 11 && currentHour < 16) {
      timePhase = 'noon';
      greetingText = 'Good Afternoon';
      PhaseIcon = <i className="fas fa-sun text-yellow-300"></i>;
  } else if (currentHour >= 16 && currentHour < 20) {
      timePhase = 'evening';
      greetingText = 'Good Evening';
      PhaseIcon = <i className="fas fa-cloud-sun text-orange-400"></i>;
  } else {
      timePhase = 'night';
      greetingText = 'Good Night';
      PhaseIcon = <i className="fas fa-moon text-indigo-300"></i>;
  }

  useEffect(() => { 
      if (refreshTrigger && refreshTrigger > 0) {
          setIsSyncing(true);
          setTodayPlan(null);
      }
      fetchDailyPlans(); 
  }, [userId, refreshTrigger]); 

  useEffect(() => {
      if (Array.isArray(logs) && logs.length > 0) {
          const pred = predictWeightTrajectory(logs, plan, undefined); 
          setPrediction(pred);
      }
  }, [logs, plan]);

  const triggerVisualHaptic = (type: 'success' | 'error', id: string) => {
      setVisualHaptic({ type, id });
      setTimeout(() => setVisualHaptic(null), 600);
  };

  const fetchDailyPlans = async () => {
    setLoading(true);
    const today = getTodayDate();
    try {
        const { data, error } = await supabase.from('daily_meal_plans').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(10); 
        if (error) throw error;
        if (Array.isArray(data)) {
            const validData = data.filter((p: any) => p && p.meals && Array.isArray(p.meals));
            setRecentPlans(validData);
            setTodayPlan(validData.find((p: any) => p.date === today) || null);
        }
    } catch (err: any) { console.error("Failed to fetch plans:", getErrorMessage(err)); }
    setLoading(false);
    setIsSyncing(false);
  };

  const toggleMealCompletion = async (index: number) => {
    if (!todayPlan || !todayPlan.meals) return;
    const updatedMeals = [...todayPlan.meals];
    const isNowCompleted = !updatedMeals[index].isCompleted;
    updatedMeals[index] = { ...updatedMeals[index], isCompleted: isNowCompleted };
    const updatedPlan = { ...todayPlan, meals: updatedMeals };
    setTodayPlan(updatedPlan);
    if (isNowCompleted) {
        triggerVisualHaptic('success', `meal-${index}`);
    }
    try {
        await supabase.from('daily_meal_plans').update({ meals: updatedMeals }).eq('id', todayPlan.id);
        setRecentPlans(prev => [updatedPlan, ...(prev || []).filter(p => p.date !== todayPlan.date)]);
    } catch (err) { 
        setTodayPlan(todayPlan); 
        triggerVisualHaptic('error', `meal-${index}`);
        alert("Failed to save progress."); 
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
      touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      const touchY = e.touches[0].clientY;
      const diff = touchY - touchStartY.current;
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      if (scrollTop <= 0 && diff > 0) {
          setPullY(Math.min(diff * 0.4, 120));
      }
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = document.documentElement.clientHeight;
      if (scrollTop + clientHeight >= scrollHeight - 20 && diff < 0) {
          setPullUpY(Math.min(Math.abs(diff) * 0.4, 150));
      }
  };

  const handleTouchEnd = () => {
      if (pullY > 80) {
          setIsSyncing(true);
          fetchDailyPlans();
      }
      if (pullUpY > 100) {
          setShowQuickStats(true);
      }
      setPullY(0);
      setPullUpY(0);
  };

  const handleGenerateToday = async () => {
    setGenerating(true);
    setShowRegenModal(false);
    try {
        const today = getTodayDate();
        const historyForAI = (recentPlans || []).filter(p => p.date !== today);
        const effectiveMacros = { ...plan, calories: regenCalories };
        const newPlan = await generateDailyMealPlan(
            profile, 
            effectiveMacros, 
            today, 
            historyForAI, 
            regenPreferences, 
            regenDietType,    
            regenCalories     
        );
        if (!newPlan || !newPlan.meals || !Array.isArray(newPlan.meals)) throw new Error("Invalid plan generated");
        const { error: upsertError } = await supabase.from('daily_meal_plans').upsert({ 
            user_id: userId, 
            date: today, 
            meals: newPlan.meals, 
            macros: newPlan.macros 
        }, { onConflict: 'user_id, date' });
        if (upsertError) throw upsertError;
        setTodayPlan(newPlan);
        setRecentPlans(prev => [newPlan, ...(prev || []).filter(p => p.date !== today)]);
        setRegenPreferences('');
        triggerVisualHaptic('success', 'regen-btn');
    } catch (err: any) { 
        triggerVisualHaptic('error', 'regen-btn');
        alert(`Failed: ${getErrorMessage(err)}`); 
    } finally { 
        setGenerating(false); 
    }
  };

  const handleSubmitEdit = async () => {
    if (!editingMeal || !todayPlan || !editInstruction.trim()) return;
    setIsEditingMeal(true);
    try {
        const updatedPlan = await handleDietDeviation(todayPlan, plan, editingMeal.index, editInstruction);
        if (!updatedPlan || !updatedPlan.meals) throw new Error("Failed to edit meal");
        await supabase.from('daily_meal_plans').upsert({ 
             user_id: userId, 
             date: todayPlan.date, 
             meals: updatedPlan.meals, 
             macros: updatedPlan.macros 
        }, { onConflict: 'user_id, date' });
        setTodayPlan(updatedPlan);
        setRecentPlans(prev => [updatedPlan, ...(prev || []).filter(p => p.date !== todayPlan.date)]);
        setEditingMeal(null);
        setEditInstruction('');
        triggerVisualHaptic('success', `meal-${editingMeal.index}`);
    } catch (e: any) {
        triggerVisualHaptic('error', 'edit-modal');
        alert("Failed to edit meal: " + getErrorMessage(e));
    } finally {
        setIsEditingMeal(false);
    }
  };

  const handleScanSuccess = (foodData: any) => {
      setShowScanner(false);
      setAddFoodInput(foodData.name);
      setAddFoodModal(true);
  };
  
  const handleSelectFood = (item: FoodItem) => { setSelectedFoodItem(item); setInputQuantity(item.base_amount.toString()); };

  const handleConfirmQuantity = async () => {
      if (!todayPlan || !selectedFoodItem || !todayPlan.meals) return;
      const qty = parseFloat(inputQuantity);
      if (isNaN(qty) || qty <= 0) { 
          triggerVisualHaptic('error', 'add-food');
          alert("Invalid quantity."); 
          return; 
      }
      try {
          const ratio = qty / selectedFoodItem.base_amount;
          const newMeal: DietMeal = {
              name: selectedFoodItem.name,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              items: [`${qty}${selectedFoodItem.type === 'unit' ? 'pcs' : selectedFoodItem.type === 'liquid' ? 'ml' : 'g'} ${selectedFoodItem.name}`],
              macros: {
                  p: Math.round(selectedFoodItem.protein * ratio), c: Math.round(selectedFoodItem.carbs * ratio),
                  f: Math.round(selectedFoodItem.fats * ratio), cal: Math.round(selectedFoodItem.calories * ratio)
              }, isCompleted: true
          };
          const newMeals = [...todayPlan.meals, newMeal];
          const newTotals = {
              p: (todayPlan.macros?.p || 0) + newMeal.macros.p, 
              c: (todayPlan.macros?.c || 0) + newMeal.macros.c,
              f: (todayPlan.macros?.f || 0) + newMeal.macros.f, 
              cal: (todayPlan.macros?.cal || 0) + newMeal.macros.cal
          };
          const updatedPlan = { ...todayPlan, meals: newMeals, macros: newTotals };
          await supabase.from('daily_meal_plans').upsert({ user_id: userId, date: todayPlan.date, meals: updatedPlan.meals, macros: updatedPlan.macros }, { onConflict: 'user_id, date' });
          setTodayPlan(updatedPlan);
          setRecentPlans(prev => [updatedPlan, ...(prev || []).filter(p => p.date !== todayPlan.date)]);
          setAddFoodModal(false); setAddFoodInput(''); setSearchResults([]); setSelectedFoodItem(null);
          triggerVisualHaptic('success', 'add-btn');
      } catch (err: any) { alert(`Failed: ${getErrorMessage(err)}`); } 
  };

  return (
    <div 
        ref={containerRef} 
        className="space-y-8" 
        onTouchStart={handleTouchStart} 
        onTouchMove={handleTouchMove} 
        onTouchEnd={handleTouchEnd}
    >
      <div 
        className="fixed top-0 left-0 right-0 flex justify-center z-50 pointer-events-none transition-transform duration-75 ease-out"
        style={{ transform: `translateY(${pullY - 60}px)`, opacity: pullY > 10 ? 1 : 0 }}
      >
        <div className="bg-primary text-black w-10 h-10 rounded-full flex items-center justify-center shadow-lg shadow-primary/30">
            <i className={`fas fa-sync-alt ${pullY > 80 ? 'animate-spin' : ''}`} style={{ transform: `rotate(${pullY * 3}deg)` }}></i>
        </div>
      </div>

      <div className={`fixed bottom-0 left-0 right-0 bg-secondary border-t border-white/10 rounded-t-[40px] z-[60] transition-all duration-500 p-8 shadow-2xl ${showQuickStats ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}>
         <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black text-white">Daily Summary</h3>
            <button onClick={() => setShowQuickStats(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><i className="fas fa-chevron-down"></i></button>
         </div>
         <div className="grid grid-cols-2 gap-4">
            <div className="bg-dark p-4 rounded-2xl">
                <p className="text-[10px] text-gray-400 uppercase tracking-widest">Goal</p>
                <p className="text-2xl font-black text-white">{totalCalTarget} <span className="text-sm text-gray-600">kcal</span></p>
            </div>
            <div className="bg-dark p-4 rounded-2xl">
                <p className="text-[10px] text-gray-400 uppercase tracking-widest">Done</p>
                <p className={`text-2xl font-black ${consumed.cal > totalCalTarget ? 'text-red-400' : 'text-green-400'}`}>{consumed.cal} <span className="text-sm text-gray-600">kcal</span></p>
            </div>
         </div>
         {/* ULTRA-ELITE METRICS DISPLAY IN QUICK STATS */}
         <div className="mt-4 bg-primary/10 p-4 rounded-2xl border border-primary/20">
             <div className="flex justify-between items-center">
                 <span className="text-[10px] text-primary font-black uppercase tracking-widest">Engine Confidence</span>
                 <span className="text-white font-bold">{plan.confidenceScore}%</span>
             </div>
             <div className="h-1 bg-white/10 rounded-full mt-2 overflow-hidden">
                 <div className="h-full bg-primary transition-all duration-1000" style={{width: `${plan.confidenceScore}%`}}></div>
             </div>
             <p className="text-[10px] text-gray-400 mt-2">
                 True BMR: <span className="text-white">{plan.trueBmr}</span> ± {plan.uncertaintyBand} kcal
             </p>
         </div>
      </div>

      {showScanner && <BarcodeScanner onScanSuccess={handleScanSuccess} onClose={() => setShowScanner(false)} />}
      
      {showRegenModal && (
        <div className="fixed inset-0 bg-dark/95 backdrop-blur-3xl z-[80] flex items-center justify-center p-6 animate-fade-in">
             <div id="regen-modal" className={`glass-card w-full max-w-sm rounded-[40px] p-8 border-primary/20 relative z-10 animate-scale-in ${visualHaptic?.id === 'regen-btn' && visualHaptic.type === 'error' ? 'animate-shake' : ''}`}>
                 <div className="flex justify-between items-center mb-6">
                    <h3 className="text-white font-black text-lg tracking-tight">Regenerate Protocol</h3>
                    <button onClick={() => setShowRegenModal(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white"><i className="fas fa-times"></i></button>
                 </div>

                 <div className="space-y-6">
                    <div>
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Day's Preference</label>
                        <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                            {['veg', 'egg', 'non-veg'].map((type) => (
                                <button
                                    key={type}
                                    onClick={() => setRegenDietType(type as DietType)}
                                    className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${regenDietType === type ? 'bg-primary text-dark shadow-lg' : 'text-gray-500 hover:text-white'}`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                         <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Calorie Target</label>
                         <input 
                            type="number"
                            value={regenCalories}
                            onChange={(e) => setRegenCalories(parseInt(e.target.value))}
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white font-bold text-center focus:border-primary outline-none tabular-nums"
                         />
                    </div>

                    <div>
                         <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Custom Instructions</label>
                         <textarea 
                             value={regenPreferences}
                             onChange={(e) => setRegenPreferences(e.target.value)}
                             placeholder="E.g. No mushroom, High fiber lunch..."
                             className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-white focus:border-primary outline-none h-24 placeholder-gray-600 font-medium" 
                         />
                    </div>

                    <button 
                         onClick={handleGenerateToday}
                         disabled={generating}
                         className={`w-full bg-white text-dark font-black py-5 rounded-2xl text-[11px] uppercase tracking-[0.3em] shadow-xl haptic-press active:scale-95 transition-transform flex items-center justify-center gap-3 ${visualHaptic?.id === 'regen-btn' && visualHaptic.type === 'success' ? 'animate-pulse-double ring-4 ring-green-500/50' : ''}`}
                    >
                        {generating ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-bolt"></i>}
                        Generate New Plan
                    </button>
                 </div>
             </div>
        </div>
      )}

      {editingMeal && (
          <div className="fixed inset-0 bg-dark/95 backdrop-blur-3xl z-[90] flex items-center justify-center p-6 animate-fade-in">
              <div id="edit-modal" className={`glass-card w-full max-w-sm rounded-[40px] p-8 border-white/10 relative z-10 animate-scale-in shadow-2xl ${visualHaptic?.id === 'edit-modal' && visualHaptic.type === 'error' ? 'animate-shake' : ''}`}>
                 <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-white font-black text-lg tracking-tight">Modify Segment</h3>
                        <p className="text-[10px] text-primary font-black uppercase tracking-widest">{editingMeal.name}</p>
                    </div>
                    <button onClick={() => { setEditingMeal(null); setEditInstruction(''); }} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white"><i className="fas fa-times"></i></button>
                 </div>

                 <div className="space-y-6">
                    <div className="bg-primary/5 p-4 rounded-2xl border border-primary/20">
                        <p className="text-[10px] text-gray-300 leading-relaxed italic">
                            <i className="fas fa-info-circle text-primary mr-1"></i>
                            Describe your change. The AI will recalculate macros and balance the rest of the day if needed.
                        </p>
                    </div>

                    <div>
                         <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Modification</label>
                         <textarea 
                             value={editInstruction}
                             onChange={(e) => setEditInstruction(e.target.value)}
                             placeholder="E.g. I ate 2 boiled eggs instead. OR Swap this for a vegetarian option."
                             className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm text-white focus:border-primary outline-none h-32 placeholder-gray-600 font-medium" 
                             autoFocus
                         />
                    </div>

                    <button 
                         onClick={handleSubmitEdit}
                         disabled={isEditingMeal || !editInstruction.trim()}
                         className="w-full bg-white text-dark font-black py-5 rounded-2xl text-[11px] uppercase tracking-[0.3em] shadow-xl haptic-press active:scale-95 transition-transform flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        {isEditingMeal ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-check"></i>}
                        Apply Modification
                    </button>
                 </div>
              </div>
          </div>
      )}

      <header className="relative mb-8 p-6 overflow-hidden rounded-[32px] glass-card border border-white/10 group">
        {timePhase === 'morning' && <MorningComponent />}
        {timePhase === 'noon' && <NoonComponent />}
        {timePhase === 'evening' && <EveningComponent />}
        {timePhase === 'night' && <NightComponent />}
        <div className="relative z-10">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/80 mb-2 flex items-center gap-2 drop-shadow-md">
                        {PhaseIcon}
                        {greetingText}
                    </p>
                    <h1 className="text-4xl font-black text-white tracking-tighter drop-shadow-lg">{profile.name.split(' ')[0]}</h1>
                </div>
                <button onClick={() => onNavigate('profile')} className="w-14 h-14 rounded-[24px] bg-white/[0.1] border border-white/20 flex items-center justify-center transition-all haptic-press hover:bg-white/[0.2] shadow-lg inner-glow">
                    <i className="fas fa-fingerprint text-white text-2xl drop-shadow-md"></i>
                </button>
            </div>
            <TypewriterText text={motivationalQuote} />
        </div>
      </header>

      <section className="relative overflow-hidden rounded-[42px] p-8 animate-scale-in glass-card inner-glow gpu border-white/15">
         <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[120px] pointer-events-none -mr-40 -mt-40 animate-pulse-slow"></div>
         <div className="relative z-10">
            <div className="mb-10">
                <div className="flex flex-wrap items-baseline gap-2 sm:gap-3">
                    <span className={`text-6xl sm:text-7xl lg:text-8xl font-black tracking-tighter transition-all duration-700 ${consumed.cal > totalCalTarget ? 'text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.4)]' : 'text-white'}`}>
                        {Math.round(consumed.cal)}
                    </span>
                    <div className="flex flex-col mb-1 sm:mb-2">
                      <span className="text-gray-500 font-black text-xl sm:text-2xl tracking-tighter leading-none">/ {totalCalTarget}</span>
                      <span className="text-primary text-[10px] font-black uppercase tracking-[0.2em] mt-1 sm:mt-2 bg-primary/5 px-2 py-0.5 rounded-md border border-primary/10 w-fit">Metabolic Unit</span>
                    </div>
                </div>
                
                {/* --- ADAPTIVE CORRECTION INDICATOR --- */}
                <div className="mt-4 flex flex-col gap-2">
                   <div className="flex items-center gap-2 opacity-70">
                      <div className={`w-2 h-2 rounded-full ${plan.confidenceScore > 80 ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                      <span className="text-[9px] text-gray-400 font-mono tracking-wider">
                        EST. TRUE BMR: {plan.trueBmr} ± {plan.uncertaintyBand} (Conf: {plan.confidenceScore}%)
                      </span>
                   </div>
                   {/* SHOW ZIG ZAG REASON IF ACTIVE */}
                   {plan.adaptationReason && (
                       <div className="bg-red-500/10 border border-red-500/30 p-2 rounded-lg flex items-start gap-2 max-w-sm animate-pulse-slow">
                           <i className="fas fa-exclamation-circle text-red-400 text-xs mt-0.5"></i>
                           <p className="text-[10px] text-red-300 font-bold uppercase tracking-wide leading-tight">
                               {plan.adaptationReason}
                           </p>
                       </div>
                   )}
                </div>

                <div className="w-full bg-black/50 h-6 rounded-full mt-6 overflow-hidden border border-white/10 p-[3px] shadow-inner">
                    <div className={`h-full rounded-full transition-all duration-1000 ease-liquid gpu relative ${consumed.cal > totalCalTarget ? 'bg-gradient-to-r from-red-600 to-red-400' : 'bg-gradient-to-r from-primary via-yellow-400 to-yellow-300 shadow-[0_0_20px_rgba(255,215,0,0.3)]'}`} style={{ width: `${calPct}%` }}>
                        <div className="absolute inset-0 bg-white/20 blur-[2px] h-[40%] rounded-full translate-y-[-1px]"></div>
                    </div>
                </div>
            </div>

            <div className="flex gap-4">
                {['Protein', 'Carbs', 'Fats'].map((m, i) => {
                    const val = i===0 ? consumed.p : i===1 ? consumed.c : consumed.f;
                    const max = i===0 ? plan.protein : i===1 ? plan.carbs : plan.fats;
                    const pct = max > 0 ? Math.min(100, (val/max)*100) : 0;
                    const color = i===0 ? 'from-blue-600 to-cyan-400 shadow-blue-500/20' : i===1 ? 'from-green-600 to-emerald-400 shadow-green-500/20' : 'from-orange-600 to-yellow-400 shadow-orange-500/20';
                    return (
                        <div key={m} className="flex-1 bg-black/40 p-5 rounded-[28px] border border-white/5 inner-glow group hover:border-white/15 transition-all">
                            <p className="text-[10px] text-gray-500 uppercase font-black tracking-[0.2em] mb-2 group-hover:text-gray-300 transition-colors">{m.charAt(0)}</p>
                            <div className="text-lg font-black text-white mb-3 tabular-nums">{Math.round(val)}<span className="text-[11px] text-gray-600 font-bold ml-1">G</span></div>
                            <div className="h-2 w-full bg-white/[0.05] rounded-full overflow-hidden shadow-inner p-[1px]">
                                <div className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-1200 ease-liquid shadow-lg`} style={{ width: `${pct}%` }}></div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
      </section>

      <div className="bg-black/60 p-2 rounded-[32px] border border-white/10 flex relative backdrop-blur-[40px] sticky top-4 z-20 shadow-2xl inner-glow animate-fade-in mx-2">
        {['diet', 'workout', 'overview'].map((tab) => (
            <button 
              key={tab} 
              onClick={() => setActiveTab(tab as any)} 
              className={`flex-1 py-3.5 text-[10px] font-black uppercase tracking-[0.3em] rounded-[24px] transition-all duration-700 ease-spring haptic-press ${activeTab === tab ? 'text-dark bg-white shadow-[0_8px_20px_rgba(255,255,255,0.2)] scale-[1.02]' : 'text-gray-500 hover:text-white'}`}
            >
              {tab}
            </button>
        ))}
      </div>
      
      <div className="min-h-[450px] relative z-10 pb-12 px-1">
        {activeTab === 'diet' && (
            <div className="space-y-6 animate-slide-up">
                
                {/* --- GOAL MISMATCH ALERT --- */}
                {isPlanMismatch && (
                    <FadeInItem>
                        <div className="glass-card bg-yellow-500/5 border-yellow-500/30 p-5 rounded-[32px] flex flex-col sm:flex-row justify-between items-center gap-4 relative overflow-hidden group">
                           <div className="absolute inset-0 bg-yellow-500/5 animate-pulse-slow"></div>
                           <div className="relative z-10 flex items-center gap-4">
                               <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center border border-yellow-500/40 text-yellow-400">
                                   <i className="fas fa-exclamation-triangle text-xl"></i>
                               </div>
                               <div>
                                   <h4 className="text-yellow-400 font-black text-sm uppercase tracking-wide">Goal Drift Detected</h4>
                                   <p className="text-[10px] text-gray-400 font-bold mt-1">
                                       Current Plan: <span className="text-white">{currentPlanCalories}</span> vs Target: <span className="text-white">{plan.calories}</span> kcal
                                   </p>
                               </div>
                           </div>
                           <button 
                               onClick={() => setShowRegenModal(true)} 
                               className="relative z-10 bg-yellow-500 hover:bg-yellow-400 text-black font-black py-3 px-6 rounded-xl text-[10px] uppercase tracking-[0.2em] transition-all haptic-press shadow-lg shadow-yellow-500/20 flex items-center gap-2"
                           >
                               <i className="fas fa-sync-alt"></i> Sync Plan
                           </button>
                        </div>
                    </FadeInItem>
                )}

                {(!todayPlan && !isSyncing) ? (
                    <FadeInItem>
                        <div className="glass-card p-14 rounded-[48px] text-center border border-white/10 overflow-hidden relative group">
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-blue-500/10 opacity-30 pointer-events-none"></div>
                            <div className="w-28 h-28 bg-white/[0.03] rounded-[32px] flex items-center justify-center mb-10 mx-auto border border-white/10 group-hover:scale-110 group-hover:rotate-6 transition-all duration-1000 inner-glow">
                                <i className="fas fa-microchip text-5xl text-primary/50"></i>
                            </div>
                            <h2 className="text-3xl font-black text-white mb-4 tracking-tight">System Idle</h2>
                            <p className="text-gray-400 text-sm mb-12 leading-relaxed font-medium mx-auto max-w-[280px]">
                                Neural processing of today's intake data required. Initialize optimization protocol.
                            </p>
                            <button 
                                onClick={() => setShowRegenModal(true)} 
                                disabled={generating} 
                                className="bg-white text-dark font-black py-6 px-16 rounded-[28px] shadow-[0_25px_50px_-12px_rgba(255,255,255,0.2)] flex items-center justify-center gap-4 haptic-press transition-all hover:translate-y-[-2px] mx-auto tracking-[0.2em] uppercase text-[11px]"
                            >
                                <i className="fas fa-bolt-lightning"></i> Initialize Protocol
                            </button>
                        </div>
                    </FadeInItem>
                ) : (
                    <div className={`space-y-5 ${generating ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
                         {!isPlanMismatch && (
                             <div className="flex justify-between items-center px-2">
                                 <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                    Protocol Active
                                 </h3>
                                 <button 
                                    onClick={() => setShowRegenModal(true)}
                                    className="bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-primary px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 haptic-press shadow-lg"
                                 >
                                    <i className="fas fa-sliders"></i> Regenerate Plan
                                 </button>
                             </div>
                         )}

                         {(todayPlan?.meals || []).map((meal, idx) => (
                            <FadeInItem key={idx} delay={idx * 50}>
                                <div 
                                    onClick={() => toggleMealCompletion(idx)}
                                    className={`glass-card rounded-[40px] overflow-hidden group relative transition-all duration-500 ease-spring haptic-press cursor-pointer border border-white/5 ${meal.isCompleted ? 'border-green-500/30 opacity-60' : 'hover:border-white/20'} ${visualHaptic?.id === `meal-${idx}` && visualHaptic.type === 'success' ? 'animate-pulse-double ring-2 ring-green-400' : ''}`}
                                >
                                    <div className={`p-7 border-b border-white/5 flex justify-between items-center ${meal.isCompleted ? 'bg-green-500/[0.03]' : 'bg-white/[0.01]'}`}>
                                        <div className="flex items-center gap-5">
                                            <div className={`w-10 h-10 rounded-[18px] flex items-center justify-center text-[12px] font-black transition-all duration-700 ${meal.isCompleted ? 'bg-green-500 text-white rotate-[360deg]' : 'bg-primary text-dark'}`}>{idx + 1}</div>
                                            <div>
                                                <h3 className={`font-black text-xl tracking-tight leading-none mb-1.5 ${meal.isCompleted ? 'text-gray-500 line-through' : 'text-white'}`}>{meal.name}</h3>
                                                <div className="flex items-center gap-2">
                                                    <i className="fas fa-clock text-[9px] text-gray-600"></i>
                                                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">{meal.time}</p>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-3">
                                            {!meal.isCompleted && (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); setEditingMeal({index: idx, name: meal.name}); setEditInstruction(''); }}
                                                    className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center border border-white/5 transition-colors active:scale-90"
                                                >
                                                    <i className="fas fa-pen text-xs"></i>
                                                </button>
                                            )}

                                            <div className={`w-12 h-12 rounded-[20px] border-2 flex items-center justify-center transition-all duration-700 ${meal.isCompleted ? 'bg-green-500 border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)]' : 'border-white/10 group-hover:border-white/30'}`}>
                                                {meal.isCompleted && <i className="fas fa-check text-white text-lg"></i>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-7">
                                        <ul className="space-y-2.5 text-[15px] text-gray-400 font-medium pl-1">
                                            {(meal.items || []).map((it, i) => (
                                                <li key={i} className="flex items-start gap-4">
                                                    <div className="w-1.5 h-1.5 bg-primary/40 rounded-full mt-2 shrink-0"></div>
                                                    <span className={meal.isCompleted ? 'opacity-50' : ''}>{it}</span>
                                                </li>
                                            ))}
                                        </ul>
                                        <div className="mt-8 flex gap-6 pt-6 border-t border-white/5 px-2">
                                            <div className="flex flex-col"><span className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">PRO</span><span className="text-sm font-black text-blue-400">{meal.macros.p}g</span></div>
                                            <div className="flex flex-col"><span className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">CAR</span><span className="text-sm font-black text-green-400">{meal.macros.c}g</span></div>
                                            <div className="flex flex-col"><span className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">FAT</span><span className="text-sm font-black text-orange-400">{meal.macros.f}g</span></div>
                                            <div className="ml-auto flex flex-col items-end"><span className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">TOTAL</span><span className="text-sm font-black text-white">{meal.macros.cal}k</span></div>
                                        </div>
                                    </div>
                                    {meal.isCompleted && <div className="absolute inset-0 bg-green-500/5 pointer-events-none"></div>}
                                </div>
                            </FadeInItem>
                         ))}
                         
                         <FadeInItem delay={200}>
                            <button onClick={() => { setAddFoodModal(true); setAddFoodInput(''); }} className="w-full py-8 rounded-[40px] border-2 border-dashed border-white/10 hover:border-primary/40 text-gray-500 hover:text-white flex items-center justify-center gap-4 group bg-black/30 transition-all haptic-press">
                                <div className="w-10 h-10 rounded-full bg-white/[0.03] flex items-center justify-center group-hover:bg-primary group-hover:text-dark transition-all">
                                    <i className="fas fa-plus-circle text-xl"></i>
                                </div>
                                <span className="font-black text-[12px] uppercase tracking-[0.3em]">Add Intake Fragment</span>
                            </button>
                         </FadeInItem>
                    </div>
                )}
            </div>
        )}

        {activeTab === 'workout' && (
            <div className="space-y-6 animate-slide-up">
                {workoutPlan && Array.isArray(workoutPlan.workout) ? (
                    workoutPlan.workout.map((day, i) => (
                        <FadeInItem key={i} delay={i * 100}>
                            <div className="glass-card rounded-[42px] overflow-hidden border-white/10 hover:border-white/20 transition-all duration-700">
                                <div className="p-7 bg-white/[0.03] border-b border-white/5 flex justify-between items-center">
                                    <h3 className="font-black text-white text-2xl tracking-tighter leading-none">{day.day}</h3>
                                    <span className="text-[10px] bg-primary text-dark px-4 py-1.5 rounded-full font-black uppercase tracking-[0.15em] border border-white/20 shadow-lg">{day.focus}</span>
                                </div>
                                <div className="p-7 space-y-6">
                                    {(day.exercises || []).map((ex, j) => (
                                        <div key={j} className="flex justify-between items-start gap-6 group">
                                            <div className="flex-1">
                                                <p className="text-white font-black text-lg leading-tight group-hover:text-primary transition-colors">{ex.name}</p>
                                                {ex.notes && <p className="text-[11px] text-gray-500 mt-2 font-medium leading-relaxed bg-white/[0.02] p-2 rounded-lg">{ex.notes}</p>}
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className="glass-liquid px-4 py-2.5 rounded-[20px] border-white/5 shadow-inner">
                                                    <span className="text-[12px] font-black font-mono text-gray-400 tabular-nums">
                                                        {ex.sets} <span className="text-primary/60 mx-1">×</span> {ex.reps}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </FadeInItem>
                    ))
                ) : (
                    <div className="text-center py-24 glass-card rounded-[48px] border-white/5 opacity-40">
                         <i className="fas fa-dumbbell text-5xl text-gray-700 mb-6 animate-pulse"></i>
                         <p className="text-[11px] font-black text-gray-600 uppercase tracking-[0.3em]">Protocol Link Lost</p>
                    </div>
                )}
            </div>
        )}

        {activeTab === 'overview' && (
            <div className="space-y-8 animate-slide-up">
                {prediction ? (
                    <FadeInItem>
                        <div className="glass-card p-10 rounded-[48px] relative overflow-hidden group border-white/15">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-accent/15 rounded-full blur-[110px] pointer-events-none -mr-20 -mt-20 animate-pulse-slow"></div>
                            
                            <div className="flex items-center gap-4 mb-10">
                            <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                                <i className="fas fa-project-diagram text-accent"></i>
                            </div>
                            <h3 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.3em]">Trajectory Projection</h3>
                            </div>
                            
                            <div className="flex items-baseline gap-4 mb-2">
                                <span className="text-8xl font-black text-white tracking-tighter tabular-nums drop-shadow-lg">{prediction.projectedWeightIn4Weeks}</span>
                                <span className="text-2xl text-gray-600 font-black tracking-tighter uppercase">KG</span>
                            </div>
                            <p className="text-sm text-accent font-black uppercase tracking-[0.2em] mb-12">4-Week System State</p>
                            
                            <div className="space-y-8">
                                <div className="bg-black/60 p-7 rounded-[36px] border border-white/10 inner-glow shadow-inner">
                                    <div className="flex justify-between items-center mb-6">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-1">Mass Velocity</span>
                                            <span className="text-white font-black text-lg tabular-nums">0.82 <span className="text-xs text-gray-600 tracking-normal">x-factor</span></span>
                                        </div>
                                        <span className={`text-[10px] font-black uppercase px-4 py-2 rounded-2xl border shadow-lg ${prediction.trendAnalysis?.isHealthyPace ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
                                            {prediction.trendAnalysis?.weeklyRateOfChange > 0 ? '+' : ''}{prediction.trendAnalysis?.weeklyRateOfChange} kg / week
                                        </span>
                                    </div>
                                    <div className="h-3 w-full bg-white/[0.05] rounded-full overflow-hidden shadow-inner p-[2px]">
                                        <div className={`h-full rounded-full bg-accent transition-all duration-1500 ease-liquid shadow-[0_0_20px_rgba(56,189,248,0.4)] relative`} style={{width: '78%'}}>
                                            <div className="absolute inset-0 bg-white/20 blur-[1px] h-[30%] rounded-full"></div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="glass-liquid p-6 rounded-[32px] border-accent/20 relative group-hover:border-accent/40 transition-colors duration-700">
                                    <p className="text-sm text-gray-300 leading-relaxed font-medium italic">
                                        "{prediction.trendAnalysis?.recommendation}"
                                    </p>
                                </div>
                            </div>
                        </div>
                    </FadeInItem>
                ) : (
                    <div className="text-center py-32 glass-card rounded-[48px] border-white/5">
                        <div className="relative inline-block mb-8">
                             <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full"></div>
                             <i className="fas fa-satellite-dish text-5xl text-gray-600 relative z-10 animate-pulse"></i>
                        </div>
                        <p className="text-[11px] font-black text-gray-500 uppercase tracking-[0.4em] px-12 leading-loose">Awaiting sufficient biometric telemetry for regression analysis</p>
                    </div>
                )}
            </div>
        )}
      </div>

      {addFoodModal && (
        <div className="fixed inset-0 bg-dark/95 flex items-center justify-center z-[70] p-6 backdrop-blur-[60px] animate-fade-in">
          <div className="glass-card w-full max-w-sm rounded-[48px] overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)] border border-white/20 flex flex-col max-h-[85vh] inner-glow animate-scale-in">
            <div className="p-10 flex-1 overflow-y-auto no-scrollbar">
                <div className="flex justify-between items-center mb-10">
                    <h2 className="text-2xl font-black text-white tracking-tighter">{selectedFoodItem ? 'Quantify' : 'Injection Point'}</h2>
                    <button onClick={() => { setAddFoodModal(false); setAddFoodInput(''); setSelectedFoodItem(null); }} className="w-12 h-12 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center text-gray-400 haptic-press"><i className="fas fa-xmark text-lg"></i></button>
                </div>
                {selectedFoodItem ? (
                    <div className="space-y-12 animate-slide-up">
                        <div className="text-center relative">
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-primary/10 blur-[60px] rounded-full pointer-events-none"></div>
                          <input 
                            type="number" 
                            value={inputQuantity} 
                            onChange={e => setInputQuantity(e.target.value)} 
                            className="w-full bg-transparent text-white text-8xl font-black p-2 text-center focus:outline-none tabular-nums relative z-10 tracking-tighter" 
                            autoFocus 
                          />
                          <p className="text-[12px] text-primary font-black uppercase tracking-[0.4em] mt-4 relative z-10">{selectedFoodItem.type === 'unit' ? 'pieces' : selectedFoodItem.type === 'liquid' ? 'milliliters' : 'grams'}</p>
                        </div>
                        <button onClick={handleConfirmQuantity} className="w-full bg-white text-dark font-black py-6 rounded-[28px] tracking-[0.3em] uppercase text-[12px] shadow-2xl haptic-press transition-transform">Validate Fraction</button>
                    </div>
                ) : (
                    <div className="space-y-8 animate-fade-in">
                        <div className="relative group">
                          <i className="fas fa-magnifying-glass absolute left-6 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-primary transition-colors"></i>
                          <input 
                            value={addFoodInput} 
                            onChange={(e) => setAddFoodInput(e.target.value)} 
                            placeholder="Identify matter..." 
                            className="w-full bg-black/60 border border-white/10 py-5 pl-16 pr-6 text-white rounded-[24px] focus:border-primary/50 outline-none text-sm font-bold shadow-inner" 
                          />
                        </div>
                        <div className="space-y-3">
                          {(searchResults || []).map(item => (
                              <button key={item.id} onClick={() => handleSelectFood(item)} className="w-full text-left p-5 glass-liquid rounded-[28px] border-white/5 hover:border-white/20 flex justify-between items-center group haptic-press">
                                  <span className="font-bold text-gray-300 group-hover:text-white transition-colors">{item.name}</span>
                                  <span className="text-[10px] font-black text-primary bg-primary/10 px-3 py-1.5 rounded-xl border border-primary/20 uppercase tracking-widest">{item.calories} k</span>
                              </button>
                          ))}
                        </div>
                    </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
