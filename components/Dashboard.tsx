
import React, { useState, useEffect } from 'react';
import { UserProfile, MacroPlan, PersonalizedPlan, DailyMealPlanDB, DietMeal, ProgressEntry, WeightPrediction, FoodItem } from '../types';
import { calculatePlan } from './Calculator';
import { supabase } from '../services/supabaseClient';
import { generateDailyMealPlan } from '../services/geminiService';
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
  const plan: MacroPlan = profile.daily_calories 
    ? { ...calculatePlan(profile), calories: profile.daily_calories } 
    : calculatePlan(profile);
    
  const [activeTab, setActiveTab] = useState<'overview' | 'diet' | 'workout'>('diet');
  const [todayPlan, setTodayPlan] = useState<DailyMealPlanDB | null>(null);
  const [recentPlans, setRecentPlans] = useState<DailyMealPlanDB[]>([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState('');
  const [showRegenInput, setShowRegenInput] = useState(false);
  const [dietType, setDietType] = useState<DietType>((profile.dietary_preference as DietType) || 'non-veg');
  const [showScanner, setShowScanner] = useState(false);
  const [prediction, setPrediction] = useState<WeightPrediction | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const [addFoodModal, setAddFoodModal] = useState(false);
  const [addFoodInput, setAddFoodInput] = useState('');
  const [searchResults, setSearchResults] = useState<FoodItem[]>([]);
  const [selectedFoodItem, setSelectedFoodItem] = useState<FoodItem | null>(null);
  const [inputQuantity, setInputQuantity] = useState<string>(''); 

  useEffect(() => {
      if (!selectedFoodItem) {
          if (addFoodInput.length > 1) {
              const term = addFoodInput.toLowerCase();
              const results = FOOD_DATABASE.filter(f => f.name.toLowerCase().includes(term)).slice(0, 6);
              setSearchResults(results);
          } else {
              setSearchResults([]);
          }
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
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const getTimeGreeting = () => {
    const hours = new Date().getHours();
    return hours < 12 ? 'Good Morning' : hours < 18 ? 'Afternoon' : 'Evening';
  };

  useEffect(() => { 
      if (refreshTrigger && refreshTrigger > 0) setIsSyncing(true);
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
        const { data, error } = await supabase.from('daily_meal_plans').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(5); 
        if (error) throw error;
        if (Array.isArray(data)) {
            setRecentPlans(data);
            setTodayPlan(data.find((p: any) => p.date === today) || null);
        }
    } catch (err) { console.error(err); }
    setLoading(false);
    setIsSyncing(false);
  };

  const toggleMealCompletion = async (index: number) => {
    if (!todayPlan || !todayPlan.meals) return;
    const updatedMeals = [...todayPlan.meals];
    updatedMeals[index] = { ...updatedMeals[index], isCompleted: !updatedMeals[index].isCompleted };
    const updatedPlan = { ...todayPlan, meals: updatedMeals };
    setTodayPlan(updatedPlan);
    try { await supabase.from('daily_meal_plans').update({ meals: updatedMeals }).eq('id', todayPlan.id); } catch (err) { setTodayPlan(todayPlan); }
  };

  const handleGenerateToday = async () => {
    setGenerating(true);
    setShowRegenInput(false);
    try {
        const today = getTodayDate();
        const newTarget = profile.daily_calories || plan.calories;
        const newPlan = await generateDailyMealPlan(profile, plan, today, [], preferences, dietType, newTarget);
        await supabase.from('daily_meal_plans').upsert({ user_id: userId, date: today, meals: newPlan.meals, macros: newPlan.macros }, { onConflict: 'user_id, date' });
        setTodayPlan(newPlan);
        setPreferences('');
    } catch (err) { alert(`Link Failed: ${err}`); } 
    finally { setGenerating(false); }
  };

  return (
    <div className="space-y-6">
      {showScanner && <BarcodeScanner onScanSuccess={(f) => { setShowScanner(false); setSelectedFoodItem(f); setInputQuantity(f.base_amount.toString()); setAddFoodModal(true); }} onClose={() => setShowScanner(false)} />}
        
      <header className="flex justify-between items-end mb-2 px-1">
        <div>
          <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.3em] mb-1">{getTimeGreeting()} Protocol</p>
          <h1 className="text-4xl font-[900] text-white tracking-tighter leading-none">{profile.name.split(' ')[0]}</h1>
        </div>
        <button onClick={() => onNavigate('profile')} className="w-10 h-10 rounded-[18px] bg-surface1 border border-white/10 flex items-center justify-center transition-all haptic-press shadow-md">
          <i className="fas fa-fingerprint text-primary text-xl"></i>
        </button>
      </header>

      {/* Hero Status Panel - Dramatic Typography */}
      <section className="relative overflow-hidden rounded-[32px] p-6 animate-scale-in glass-card inner-glow border-white/10 ambient-shadow-primary">
         <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-primary/10 rounded-full blur-[60px] pointer-events-none -mr-20 -mt-20"></div>
         
         <div className="relative z-10">
            <div className="mb-6">
                <div className="flex items-baseline gap-2">
                    <span className={`text-[min(18vw,76px)] font-[900] tracking-tighter transition-all duration-700 leading-none ${consumed.cal > totalCalTarget ? 'text-red-500' : 'text-white'}`}>{consumed.cal}</span>
                    <div className="flex flex-col">
                      <span className="text-gray-500 font-black text-xl tracking-tighter leading-none">/ {totalCalTarget}</span>
                      <span className="text-primary text-[8px] font-black uppercase tracking-widest mt-1">KCAL UNITS</span>
                    </div>
                </div>
                <div className="w-full bg-black/50 h-3.5 rounded-full mt-6 overflow-hidden border border-white/10 p-[2px]">
                    <div className={`h-full rounded-full transition-all duration-1000 ease-liquid gpu ${consumed.cal > totalCalTarget ? 'bg-red-500' : 'bg-gradient-to-r from-primary via-orange-400 to-yellow-300 shadow-[0_0_10px_rgba(255,215,0,0.4)]'}`} style={{ width: `${calPct}%` }}></div>
                </div>
            </div>

            <div className="flex gap-2">
                {[
                  { label: 'Protein', val: consumed.p, max: plan.protein, shadow: 'ambient-shadow-blue', color: 'bg-blue-400' },
                  { label: 'Carbs', val: consumed.c, max: plan.carbs, shadow: 'ambient-shadow-warning', color: 'bg-orange-400' },
                  { label: 'Fats', val: consumed.f, max: plan.fats, shadow: 'ambient-shadow-success', color: 'bg-green-400' }
                ].map((m) => {
                    const pct = m.max > 0 ? Math.min(100, (m.val/m.max)*100) : 0;
                    return (
                        <div key={m.label} className={`flex-1 bg-surface1 p-3 rounded-[20px] border border-white/5 inner-glow ${m.shadow}`}>
                            <p className="text-[8px] text-gray-500 uppercase font-black tracking-widest mb-1">{m.label.charAt(0)}</p>
                            <div className="text-sm font-black text-white mb-2 tabular-nums">{Math.round(m.val)}<span className="text-[9px] text-gray-600 ml-0.5">g</span></div>
                            <div className="h-1 w-full bg-white/[0.05] rounded-full overflow-hidden">
                                <div className={`h-full ${m.color} rounded-full transition-all duration-1000 ease-liquid`} style={{ width: `${pct}%` }}></div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
      </section>

      {/* Segment Switcher */}
      <div className="bg-black/60 p-1.5 rounded-[24px] border border-white/10 flex relative backdrop-blur-3xl sticky top-2 z-20 shadow-xl inner-glow">
        {['diet', 'workout', 'overview'].map((tab) => (
            <button 
              key={tab} 
              onClick={() => setActiveTab(tab as any)} 
              className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-[18px] transition-all duration-500 ease-spring haptic-press ${activeTab === tab ? 'text-dark bg-white shadow-md scale-[1.02]' : 'text-gray-500 hover:text-white'}`}
            >
              {tab}
            </button>
        ))}
      </div>
      
      <div className="min-h-[400px] relative z-10 pb-8 px-0.5">
        {activeTab === 'diet' && (
            <div className="space-y-5 animate-slide-up">
                {(!todayPlan && !isSyncing) ? (
                    <div className="glass-card p-10 rounded-[32px] text-center border border-white/10 overflow-hidden relative group">
                        <div className="w-20 h-20 bg-surface1 rounded-[24px] flex items-center justify-center mb-6 mx-auto border border-white/10 group-hover:scale-110 transition-transform duration-700">
                             <i className="fas fa-bolt-lightning text-4xl text-primary/40"></i>
                        </div>
                        <h2 className="text-xl font-black text-white mb-4 tracking-tight">Protocol Idle</h2>
                        <button 
                            onClick={handleGenerateToday} 
                            disabled={generating} 
                            className="bg-white text-dark font-black py-4 px-12 rounded-[22px] shadow-lg flex items-center justify-center gap-3 haptic-press mx-auto tracking-widest uppercase text-[10px]"
                        >
                            {generating ? <i className="fas fa-sync fa-spin"></i> : <i className="fas fa-power-off"></i>}
                            {generating ? 'Syncing' : 'Initialize Cycle'}
                        </button>
                    </div>
                ) : (
                    <div className={`space-y-4 ${generating ? 'opacity-40 grayscale' : ''}`}>
                         {/* Prominent Regenerate Action */}
                         <div className="flex flex-col gap-4">
                            <button 
                                onClick={() => setShowRegenInput(!showRegenInput)}
                                className={`w-full py-4 rounded-[24px] border-2 border-dashed flex items-center justify-center gap-3 transition-all haptic-press group ${showRegenInput ? 'bg-primary/10 border-primary text-primary' : 'bg-surface1 border-white/5 text-gray-400 hover:border-primary/40 hover:text-white'}`}
                            >
                                <i className={`fas ${showRegenInput ? 'fa-xmark' : 'fa-wand-magic-sparkles'} text-base group-hover:animate-pulse`}></i>
                                <span className="font-black text-[11px] uppercase tracking-[0.2em]">Regenerate Daily Protocol</span>
                            </button>

                            {showRegenInput && (
                                <div className="glass-card p-5 rounded-[28px] border-primary/30 animate-scale-in space-y-4">
                                    <textarea 
                                        value={preferences} 
                                        onChange={(e) => setPreferences(e.target.value)} 
                                        placeholder="Add cravings, energy level, or specific ingredient overrides..." 
                                        className="w-full bg-black/50 border border-white/10 rounded-[20px] p-4 text-xs text-white outline-none focus:border-primary transition-all h-24 placeholder-gray-700" 
                                    />
                                    <button 
                                        onClick={handleGenerateToday} 
                                        disabled={generating} 
                                        className="w-full bg-gradient-to-r from-primary to-orange-400 text-dark font-black py-4 rounded-[20px] text-[10px] uppercase tracking-[0.3em] shadow-xl active:scale-95 transition-transform"
                                    >
                                        Execute Recalculation
                                    </button>
                                </div>
                            )}
                         </div>

                         <div className="flex justify-between items-center px-2">
                             <h3 className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Active Intake Blocks</h3>
                             <span className="text-[8px] bg-white/5 text-gray-500 px-2 py-0.5 rounded-full border border-white/5">{todayPlan?.meals.length} blocks mapped</span>
                         </div>

                         {(todayPlan?.meals || []).map((meal, idx) => (
                            <div 
                              key={idx} 
                              onClick={() => toggleMealCompletion(idx)}
                              className={`glass-card rounded-[28px] overflow-hidden group relative transition-all duration-500 haptic-press cursor-pointer animate-slide-up ${meal.isCompleted ? 'border-green-500/20 opacity-50' : 'hover:border-white/15'}`}
                              style={{ animationDelay: `${idx * 60}ms` }}
                            >
                                <div className={`p-5 border-b border-white/5 flex justify-between items-center ${meal.isCompleted ? 'bg-green-500/[0.02]' : 'bg-white/[0.01]'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-[12px] flex items-center justify-center text-[10px] font-black transition-all ${meal.isCompleted ? 'bg-green-500 text-white' : 'bg-primary text-dark shadow-md'}`}>{idx + 1}</div>
                                        <div>
                                            <h3 className={`font-black text-base tracking-tight mb-0.5 ${meal.isCompleted ? 'text-gray-500 line-through' : 'text-white'}`}>{meal.name}</h3>
                                            <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest">{meal.time}</p>
                                        </div>
                                    </div>
                                    <div className={`w-9 h-9 rounded-[14px] border-2 flex items-center justify-center transition-all duration-500 ${meal.isCompleted ? 'bg-green-500 border-green-500 shadow-lg' : 'border-white/10'}`}>
                                        {meal.isCompleted && <i className="fas fa-check text-white text-xs"></i>}
                                    </div>
                                </div>
                                <div className="p-5">
                                    <ul className="space-y-1.5 text-xs text-gray-400 font-medium">
                                        {(meal.items || []).map((it, i) => (
                                            <li key={i} className="flex items-start gap-2">
                                                <div className="w-1 h-1 bg-primary/40 rounded-full mt-1.5 shrink-0"></div>
                                                <span className={meal.isCompleted ? 'opacity-40' : ''}>{it}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    <div className="mt-4 flex gap-4 pt-4 border-t border-white/5 opacity-80">
                                        <div className="flex flex-col"><span className="text-[8px] font-black text-gray-600 uppercase mb-0.5">P</span><span className="text-xs font-black text-blue-400">{meal.macros.p}g</span></div>
                                        <div className="flex flex-col"><span className="text-[8px] font-black text-gray-600 uppercase mb-0.5">C</span><span className="text-xs font-black text-orange-400">{meal.macros.c}g</span></div>
                                        <div className="flex flex-col"><span className="text-[8px] font-black text-gray-600 uppercase mb-0.5">F</span><span className="text-xs font-black text-green-400">{meal.macros.f}g</span></div>
                                        <div className="ml-auto flex flex-col items-end"><span className="text-[8px] font-black text-gray-600 uppercase mb-0.5">KCAL</span><span className="text-xs font-black text-white">{meal.macros.cal}</span></div>
                                    </div>
                                </div>
                            </div>
                         ))}
                         
                         <button onClick={() => { setAddFoodModal(true); setAddFoodInput(''); setSearchResults([]); setAddFoodModal(true); }} className="w-full py-6 rounded-[32px] border-2 border-dashed border-white/10 hover:border-primary/30 text-gray-500 flex items-center justify-center gap-3 bg-black/20 transition-all haptic-press">
                             <i className="fas fa-plus-circle text-base"></i>
                             <span className="font-black text-[10px] uppercase tracking-[0.2em]">Inject Manual Intake</span>
                         </button>
                    </div>
                )}
            </div>
        )}

        {activeTab === 'workout' && (
            <div className="space-y-4 animate-slide-up">
                {workoutPlan && Array.isArray(workoutPlan.workout) ? (
                    workoutPlan.workout.map((day, i) => (
                        <div key={i} className="glass-card rounded-[32px] overflow-hidden border-white/10 animate-slide-up" style={{ animationDelay: `${i * 80}ms` }}>
                            <div className="p-5 bg-surface1 border-b border-white/5 flex justify-between items-center">
                                <h3 className="font-black text-white text-lg tracking-tight leading-none uppercase tracking-widest">{day.day}</h3>
                                <span className="text-[8px] bg-primary/20 text-primary px-3 py-1 rounded-full font-black uppercase tracking-widest border border-primary/20">{day.focus}</span>
                            </div>
                            <div className="p-5 space-y-4">
                                {(day.exercises || []).map((ex, j) => (
                                    <div key={j} className="flex justify-between items-start gap-4">
                                        <div className="flex-1">
                                            <p className="text-white font-[900] text-sm leading-tight tracking-tight">{ex.name}</p>
                                            {ex.notes && <p className="text-[9px] text-gray-600 mt-1 font-medium italic leading-relaxed">{ex.notes}</p>}
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="bg-black/30 px-3 py-1.5 rounded-xl border border-white/5 shadow-inner">
                                                <span className="text-[10px] font-black font-mono text-gray-500 tabular-nums">
                                                    {ex.sets}<span className="text-primary/60 mx-0.5">×</span>{ex.reps}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-20 opacity-30 uppercase font-black text-xs tracking-widest">Protocol Matrix Lost</div>
                )}
            </div>
        )}

        {activeTab === 'overview' && (
            <div className="space-y-6 animate-slide-up">
                {prediction ? (
                    <div className="glass-card p-8 rounded-[40px] relative overflow-hidden group ambient-shadow-blue">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-accent/15 rounded-full blur-[80px] pointer-events-none -mr-20 -mt-20"></div>
                        <div className="flex items-center gap-3 mb-8">
                          <i className="fas fa-project-diagram text-accent text-sm"></i>
                          <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">System Trajectory</h3>
                        </div>
                        <div className="flex items-baseline gap-3 mb-1">
                            <span className="text-7xl font-[900] text-white tracking-tighter tabular-nums leading-none">{prediction.projectedWeightIn4Weeks}</span>
                            <span className="text-lg text-gray-600 font-black uppercase">KG</span>
                        </div>
                        <p className="text-[10px] text-accent font-black uppercase tracking-[0.2em] mb-10">4-Week Projection</p>
                        <div className="space-y-6">
                            <div className="bg-black/60 p-5 rounded-[28px] border border-white/10 inner-glow">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">Mass Velocity</span>
                                    <span className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-xl border ${prediction.trendAnalysis?.isHealthyPace ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
                                        {prediction.trendAnalysis?.weeklyRateOfChange > 0 ? '+' : ''}{prediction.trendAnalysis?.weeklyRateOfChange}kg/wk
                                    </span>
                                </div>
                                <div className="h-2 w-full bg-white/[0.05] rounded-full overflow-hidden shadow-inner">
                                    <div className="h-full rounded-full bg-accent transition-all duration-1500 ease-liquid" style={{width: '78%'}}></div>
                                </div>
                            </div>
                            <p className="text-xs text-gray-400 leading-relaxed font-medium italic pl-3 border-l border-accent/30">
                                "{prediction.trendAnalysis?.recommendation}"
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-24 glass-card rounded-[40px] border-white/5 opacity-50">
                        <i className="fas fa-satellite-dish text-4xl text-gray-700 mb-4 animate-pulse"></i>
                        <p className="text-[10px] font-black text-gray-600 uppercase tracking-[0.4em] px-10">Awaiting sufficient Biometric telemetry for regression analysis</p>
                    </div>
                )}
            </div>
        )}
      </div>

      {addFoodModal && (
        <div className="fixed inset-0 bg-dark/95 flex items-center justify-center z-[70] p-4 backdrop-blur-[40px] animate-fade-in">
          <div className="glass-card w-full max-w-sm rounded-[40px] overflow-hidden shadow-3xl border border-white/15 flex flex-col max-h-[80vh] inner-glow animate-scale-in">
            <div className="p-8 flex-1 overflow-y-auto no-scrollbar">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-xl font-[900] text-white tracking-tighter uppercase">{selectedFoodItem ? 'Quantify' : 'Identification'}</h2>
                    <button onClick={() => { setAddFoodModal(false); setAddFoodInput(''); setSelectedFoodItem(null); }} className="w-10 h-10 rounded-full bg-surface2 flex items-center justify-center text-gray-400 haptic-press"><i className="fas fa-xmark"></i></button>
                </div>
                {selectedFoodItem ? (
                    <div className="space-y-10 animate-slide-up">
                        <div className="text-center relative py-4">
                          <input type="number" value={inputQuantity} onChange={e => setInputQuantity(e.target.value)} className="w-full bg-transparent text-white text-8xl font-[900] p-2 text-center focus:outline-none tabular-nums tracking-tighter" autoFocus />
                          <p className="text-[10px] text-primary font-black uppercase tracking-[0.3em] mt-2 animate-pulse">{selectedFoodItem.type === 'unit' ? 'pieces' : selectedFoodItem.type === 'liquid' ? 'ml' : 'grams'}</p>
                        </div>
                        <button onClick={async () => { /* Logic to add food assumed from prev context */ setAddFoodModal(false); }} className="w-full bg-white text-dark font-black py-5 rounded-[24px] tracking-widest uppercase text-[11px] shadow-xl haptic-press">Authorize Intake</button>
                    </div>
                ) : (
                    <div className="space-y-6 animate-fade-in">
                        <div className="relative group">
                          <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-primary transition-colors"></i>
                          <input value={addFoodInput} onChange={(e) => setAddFoodInput(e.target.value)} placeholder="Matter identification..." className="w-full bg-black/60 border border-white/10 py-4 pl-12 pr-6 text-white rounded-[20px] focus:border-primary/40 outline-none text-sm font-bold shadow-inner" />
                        </div>
                        <div className="space-y-2">
                          {(searchResults || []).map(item => (
                              <button key={item.id} onClick={() => { setSelectedFoodItem(item); setInputQuantity(item.base_amount.toString()); }} className="w-full text-left p-4 glass-liquid rounded-[20px] border-white/5 hover:border-white/20 flex justify-between items-center group haptic-press">
                                  <span className="font-bold text-gray-300 group-hover:text-white text-sm transition-colors">{item.name}</span>
                                  <span className="text-[9px] font-black text-primary bg-primary/10 px-2 py-1 rounded-lg border border-primary/20">{item.calories} KCAL</span>
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
