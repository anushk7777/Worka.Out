
import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, MacroPlan, PersonalizedPlan, DailyMealPlanDB, DietMeal, ProgressEntry, WeightPrediction, FoodItem } from '../types';
import { calculatePlan } from './Calculator';
import { supabase } from '../services/supabaseClient';
import { generateDailyMealPlan, handleDietDeviation } from '../services/geminiService';
import { predictWeightTrajectory } from '../services/analyticsService';
import BarcodeScanner from './BarcodeScanner';
import { FOOD_DATABASE } from '../constants'; 

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

export const Dashboard: React.FC<Props> = ({ userId, profile, workoutPlan, logs = [], onSignOut, onNavigate, refreshTrigger }) => {
  // 1. Calculate Plan Source of Truth
  const plan: MacroPlan = profile.daily_calories 
    ? { ...calculatePlan(profile), calories: profile.daily_calories } 
    : calculatePlan(profile);
    
  const [activeTab, setActiveTab] = useState<'overview' | 'diet' | 'workout'>('diet');
  const [todayPlan, setTodayPlan] = useState<DailyMealPlanDB | null>(null);
  const [recentPlans, setRecentPlans] = useState<DailyMealPlanDB[]>([]);
  
  // UI States
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showRegenModal, setShowRegenModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Regeneration Inputs
  const [regenPreferences, setRegenPreferences] = useState('');
  const [regenDietType, setRegenDietType] = useState<DietType>((profile.dietary_preference as DietType) || 'non-veg');
  const [regenCalories, setRegenCalories] = useState<number>(plan.calories);

  // Edit Meal States
  const [editingMeal, setEditingMeal] = useState<{index: number, name: string} | null>(null);
  const [editInstruction, setEditInstruction] = useState('');
  const [isEditingMeal, setIsEditingMeal] = useState(false);

  // Add Food Modal States
  const [addFoodModal, setAddFoodModal] = useState(false);
  const [addFoodInput, setAddFoodInput] = useState('');
  const [searchResults, setSearchResults] = useState<FoodItem[]>([]);
  const [selectedFoodItem, setSelectedFoodItem] = useState<FoodItem | null>(null);
  const [inputQuantity, setInputQuantity] = useState<string>(''); 
  const [prediction, setPrediction] = useState<WeightPrediction | null>(null);

  // --- Effects ---

  // Sync state when profile updates
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

  useEffect(() => { 
      if (refreshTrigger && refreshTrigger > 0) {
          setIsSyncing(true);
          setTodayPlan(null); // Force reload
      }
      fetchDailyPlans(); 
  }, [userId, refreshTrigger]); 

  useEffect(() => {
      if (Array.isArray(logs) && logs.length > 0) {
          const pred = predictWeightTrajectory(logs, plan, undefined); 
          setPrediction(pred);
      }
  }, [logs, plan]);

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
    updatedMeals[index] = { ...updatedMeals[index], isCompleted: !updatedMeals[index].isCompleted };
    const updatedPlan = { ...todayPlan, meals: updatedMeals };
    setTodayPlan(updatedPlan);
    try {
        await supabase.from('daily_meal_plans').update({ meals: updatedMeals }).eq('id', todayPlan.id);
        setRecentPlans(prev => [updatedPlan, ...(prev || []).filter(p => p.date !== todayPlan.date)]);
    } catch (err) { setTodayPlan(todayPlan); alert("Failed to save progress."); }
  };

  const handleScanSuccess = (foodData: any) => {
      setShowScanner(false);
      setAddFoodInput(foodData.name);
      setAddFoodModal(true);
  };

  // --- REGENERATION LOGIC ---
  const handleGenerateToday = async () => {
    setGenerating(true);
    setShowRegenModal(false);
    
    try {
        const today = getTodayDate();
        const historyForAI = (recentPlans || []).filter(p => p.date !== today);
        
        // Use the manual overrides from modal
        const effectiveMacros = { ...plan, calories: regenCalories };
        
        const newPlan = await generateDailyMealPlan(
            profile, 
            effectiveMacros, 
            today, 
            historyForAI, 
            regenPreferences, // Custom user instructions
            regenDietType,    // Override diet type
            regenCalories     // Override calories
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
        setRegenPreferences(''); // Clear input
        
    } catch (err: any) { 
        alert(`Failed: ${getErrorMessage(err)}`); 
    } finally { 
        setGenerating(false); 
    }
  };

  // --- SINGLE MEAL EDIT LOGIC ---
  const handleSubmitEdit = async () => {
    if (!editingMeal || !todayPlan || !editInstruction.trim()) return;
    
    setIsEditingMeal(true);
    try {
        // Calculate new effective plan target (keep current macro goals)
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
        
        // Close Modal
        setEditingMeal(null);
        setEditInstruction('');
    } catch (e: any) {
        alert("Failed to edit meal: " + getErrorMessage(e));
    } finally {
        setIsEditingMeal(false);
    }
  };

  const handleSelectFood = (item: FoodItem) => { setSelectedFoodItem(item); setInputQuantity(item.base_amount.toString()); };

  const handleConfirmQuantity = async () => {
      if (!todayPlan || !selectedFoodItem || !todayPlan.meals) return;
      const qty = parseFloat(inputQuantity);
      if (isNaN(qty) || qty <= 0) { alert("Invalid quantity."); return; }
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
      } catch (err: any) { alert(`Failed: ${getErrorMessage(err)}`); } 
  };

  return (
    <div className="space-y-8">
      {showScanner && <BarcodeScanner onScanSuccess={handleScanSuccess} onClose={() => setShowScanner(false)} />}
      
      {/* Regeneration Modal */}
      {showRegenModal && (
        <div className="fixed inset-0 bg-dark/95 backdrop-blur-3xl z-[80] flex items-center justify-center p-6 animate-fade-in">
             <div className="glass-card w-full max-w-sm rounded-[40px] p-8 border-primary/20 relative z-10 animate-scale-in">
                 <div className="flex justify-between items-center mb-6">
                    <h3 className="text-white font-black text-lg tracking-tight">Regenerate Protocol</h3>
                    <button onClick={() => setShowRegenModal(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white"><i className="fas fa-times"></i></button>
                 </div>

                 <div className="space-y-6">
                    {/* Diet Type Selector */}
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

                    {/* Calorie Override */}
                    <div>
                         <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Calorie Target</label>
                         <input 
                            type="number"
                            value={regenCalories}
                            onChange={(e) => setRegenCalories(parseInt(e.target.value))}
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white font-bold text-center focus:border-primary outline-none tabular-nums"
                         />
                    </div>

                    {/* Instructions */}
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
                         className="w-full bg-white text-dark font-black py-5 rounded-2xl text-[11px] uppercase tracking-[0.3em] shadow-xl haptic-press active:scale-95 transition-transform flex items-center justify-center gap-3"
                    >
                        {generating ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-bolt"></i>}
                        Generate New Plan
                    </button>
                 </div>
             </div>
        </div>
      )}

      {/* Edit Meal Modal */}
      {editingMeal && (
          <div className="fixed inset-0 bg-dark/95 backdrop-blur-3xl z-[90] flex items-center justify-center p-6 animate-fade-in">
              <div className="glass-card w-full max-w-sm rounded-[40px] p-8 border-white/10 relative z-10 animate-scale-in shadow-2xl">
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

      <header className="flex justify-between items-end mb-4 px-1">
        <div>
          <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.3em] mb-1">{getTimeGreeting()}</p>
          <h1 className="text-5xl font-black text-white tracking-tighter drop-shadow-md leading-none">{profile.name.split(' ')[0]}</h1>
        </div>
        <button onClick={() => onNavigate('profile')} className="w-14 h-14 rounded-[24px] bg-white/[0.03] border border-white/10 flex items-center justify-center transition-all haptic-press hover:bg-white/[0.08] shadow-lg inner-glow">
          <i className="fas fa-fingerprint text-primary text-2xl"></i>
        </button>
      </header>

      {/* High-Fidelity Liquid Status Panel */}
      <section className="relative overflow-hidden rounded-[42px] p-8 animate-scale-in glass-card inner-glow gpu border-white/15">
         <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[120px] pointer-events-none -mr-40 -mt-40 animate-pulse-slow"></div>
         
         <div className="relative z-10">
            <div className="mb-10">
                <div className="flex items-baseline gap-3">
                    <span className={`text-8xl font-black tracking-tighter transition-all duration-700 ${consumed.cal > totalCalTarget ? 'text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.4)]' : 'text-white'}`}>{consumed.cal}</span>
                    <div className="flex flex-col mb-2">
                      <span className="text-gray-500 font-black text-2xl tracking-tighter leading-none">/ {totalCalTarget}</span>
                      <span className="text-primary text-[10px] font-black uppercase tracking-[0.2em] mt-2 bg-primary/5 px-2 py-0.5 rounded-md border border-primary/10">Metabolic Unit</span>
                    </div>
                </div>
                {/* Liquid Tube Tracker */}
                <div className="w-full bg-black/50 h-6 rounded-full mt-8 overflow-hidden border border-white/10 p-[3px] shadow-inner">
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

      {/* Magnetic Tab Switcher */}
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
                {(!todayPlan && !isSyncing) ? (
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
                ) : (
                    <div className={`space-y-5 ${generating ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
                         {/* PROMINENT REGENERATION COMMAND CENTER */}
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

                         {(todayPlan?.meals || []).map((meal, idx) => (
                            <div 
                              key={idx} 
                              onClick={() => toggleMealCompletion(idx)}
                              className={`glass-card rounded-[40px] overflow-hidden group relative transition-all duration-700 haptic-press cursor-pointer animate-slide-up ${meal.isCompleted ? 'border-green-500/30 opacity-60' : 'hover:border-white/20'}`}
                              style={{ animationDelay: `${idx * 80}ms` }}
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
                                        {/* EDIT BUTTON */}
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
                         ))}
                         
                         <button onClick={() => { setAddFoodModal(true); setAddFoodInput(''); }} className="w-full py-8 rounded-[40px] border-2 border-dashed border-white/10 hover:border-primary/40 text-gray-500 hover:text-white flex items-center justify-center gap-4 group bg-black/30 transition-all haptic-press">
                             <div className="w-10 h-10 rounded-full bg-white/[0.03] flex items-center justify-center group-hover:bg-primary group-hover:text-dark transition-all">
                                <i className="fas fa-plus-circle text-xl"></i>
                             </div>
                             <span className="font-black text-[12px] uppercase tracking-[0.3em]">Add Intake Fragment</span>
                         </button>
                    </div>
                )}
            </div>
        )}

        {activeTab === 'workout' && (
            <div className="space-y-6 animate-slide-up">
                {workoutPlan && Array.isArray(workoutPlan.workout) ? (
                    workoutPlan.workout.map((day, i) => (
                        <div key={i} className="glass-card rounded-[42px] overflow-hidden border-white/10 hover:border-white/20 transition-all duration-700 animate-slide-up" style={{ animationDelay: `${i * 100}ms` }}>
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
