
import React, { useState, useEffect } from 'react';
import { UserProfile, Goal, ActivityLevel } from '../types';
import { supabase } from '../services/supabaseClient';
import { calculatePlan } from './Calculator';
import { generateDailyMealPlan } from '../services/geminiService';

interface Props {
  profile: UserProfile;
  onUpdateProfile: (updatedProfile: UserProfile) => void;
  onSignOut: () => void;
  onPlanRegenerated?: () => void; // New callback
}

const ProfileSettings: React.FC<Props> = ({ profile, onUpdateProfile, onSignOut, onPlanRegenerated }) => {
  const [formData, setFormData] = useState<UserProfile>({
      ...profile,
      dietary_preference: profile.dietary_preference || 'non-veg'
  });
  const [loading, setLoading] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const [showRegen, setShowRegen] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  
  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);

  useEffect(() => {
    setFormData({
        ...profile,
        dietary_preference: profile.dietary_preference || 'non-veg'
    });
  }, [profile]);

  // PWA Install Logic
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsAppInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
  };

  // Safe BMI Calculation
  const hM = formData.height / 100;
  const bmi = (hM > 0 && formData.weight > 0) ? (formData.weight / (hM * hM)).toFixed(1) : 'N/A';

  const handleChange = (field: keyof UserProfile, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setMessage(null);
    setShowRegen(false);
  };

  // Helper to match Dashboard's local date logic exactly
  const getLocalISODate = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Consolidated function to save profile AND regenerate plan if needed
  const handleSaveAndRegenerate = async () => {
    setLoading(true);
    setMessage(null);
    setShowRegen(false);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      // 1. Calculate New Macros (Fresh start, no history weighting)
      const newMacros = calculatePlan(formData);
      
      // 2. Update Profile in DB
      const updates = {
        name: formData.name,
        age: formData.age,
        weight: formData.weight,
        height: formData.height,
        gender: formData.gender,
        goal: formData.goal,
        activity_level: formData.activityLevel,
        dietary_preference: formData.dietary_preference,
        daily_calories: newMacros.calories,
        weekly_calories: newMacros.calories * 7,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
      if (error) throw error;

      // Update Local State immediately
      onUpdateProfile({ ...formData, daily_calories: newMacros.calories, weekly_calories: newMacros.calories * 7 });
      
      // 3. AUTO-REGENERATE PLAN (Implicitly done to fix user workflow)
      setMessage({ text: "Profile Saved. Calculating New Portions...", type: 'success' });
      
      try {
          // Use local date to match Dashboard
          const today = getLocalISODate();
          
          const newPlan = await generateDailyMealPlan(
              formData, 
              newMacros, // Pass NEW macro targets
              today, 
              [], 
              "GOAL CHANGED: Automatic Plan Adjustment based on new profile settings.",
              formData.dietary_preference as any
          );

          const { error: planError } = await supabase.from('daily_meal_plans').upsert({ 
              user_id: user.id, 
              date: today, 
              meals: newPlan.meals, 
              macros: newPlan.macros 
          }, { onConflict: 'user_id, date' });

          if (planError) throw planError;
          
          // Signal App to update dashboard version
          if (onPlanRegenerated) {
              onPlanRegenerated();
          }
          setMessage({ text: "Success! Diet Plan Updated to new Calories.", type: 'success' });

      } catch (planErr) {
          console.error("Auto-regen failed:", planErr);
          setMessage({ text: "Profile saved, but Diet Plan update failed. Try manually.", type: 'error' });
          setShowRegen(true); // Fallback to manual button if auto fails
      }

    } catch (err: any) {
      console.error(err);
      setMessage({ text: `Failed to update profile: ${err?.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const goals = Object.values(Goal);
  const currentGoalIndex = goals.indexOf(formData.goal);
  const diets = ['veg', 'egg', 'non-veg'] as const;
  const currentDietIndex = diets.indexOf(formData.dietary_preference as any);

  const parseActivity = (fullString: string) => {
    const parts = fullString.split(' (');
    return { title: parts[0], desc: parts[1] ? parts[1].replace(')', '') : '' };
  };

  return (
    <div className="p-4 pb-32 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-black text-white tracking-tight">Settings</h2>
            <p className="text-xs text-gray-400 font-medium">Customize your plan</p>
          </div>
          <button onClick={onSignOut} className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all active:scale-90">
            <i className="fas fa-power-off"></i>
          </button>
      </div>

      {/* Hero Stats Card */}
      <div className="relative rounded-3xl p-6 overflow-hidden border border-white/10 group glass-card">
         <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-[60px] group-hover:bg-primary/30 transition-all duration-700"></div>
         
         <div className="relative z-10 flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-gray-800 to-gray-700 flex items-center justify-center shadow-lg border border-white/10 text-2xl">
                {formData.gender === 'Male' ? '👨' : '👩'}
            </div>
            <div className="flex-1">
                <h3 className="text-2xl font-bold text-white leading-none mb-1">{formData.name}</h3>
                <div className="flex gap-3 text-xs font-medium text-gray-400">
                    <span className="bg-black/30 px-2 py-1 rounded-md">{formData.age} yrs</span>
                    <span className="bg-black/30 px-2 py-1 rounded-md">{formData.height} cm</span>
                    <span className="bg-black/30 px-2 py-1 rounded-md">{formData.weight} kg</span>
                </div>
            </div>
            <div className="text-right">
                 <div className="text-[10px] text-primary font-bold uppercase tracking-wider mb-0.5">BMI</div>
                 <div className="text-3xl font-black text-white leading-none">{bmi}</div>
            </div>
         </div>
      </div>

      {/* PWA INSTALL SECTION */}
      {!isAppInstalled && (
        <div className="space-y-3 pt-4 border-t border-white/10">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">App Installation</h3>
            
            {deferredPrompt ? (
                <button 
                    onClick={handleInstallClick}
                    className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-black py-4 rounded-2xl shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 border-t border-white/20"
                >
                    <i className="fas fa-download animate-bounce"></i> Install App to Home Screen
                </button>
            ) : (
                <div className="bg-black/20 p-4 rounded-2xl border border-white/5 text-center">
                    <p className="text-[10px] text-gray-400 leading-relaxed font-medium">
                        Install for a better experience: <br/>
                        Tap <i className="fas fa-ellipsis-v mx-1 text-white"></i> (Android) or <i className="fas fa-share-square mx-1 text-white"></i> (iOS) <br/>
                        and select <strong>"Add to Home Screen"</strong>.
                    </p>
                </div>
            )}
        </div>
      )}

      <div className="space-y-8 animate-slide-up">
          
          {/* GOAL SLIDER */}
          <div className="space-y-3">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <i className="fas fa-crosshairs text-primary"></i> Current Goal
              </label>
              
              <div className="relative bg-black/40 backdrop-blur-md rounded-2xl p-1.5 flex justify-between items-center border border-white/5 h-14 select-none">
                  {/* Sliding Pill */}
                  <div 
                    className="absolute top-1.5 bottom-1.5 bg-gradient-to-r from-primary to-yellow-500 rounded-xl shadow-lg shadow-primary/20 transition-all duration-500 ease-spring gpu"
                    style={{
                        transform: `translateX(${currentGoalIndex * 100}%)`,
                        width: `${100 / goals.length}%`,
                    }}
                  ></div>

                  {goals.map((g, idx) => (
                      <button
                          key={g}
                          onClick={() => handleChange('goal', g)}
                          className={`flex-1 relative z-10 h-full text-[11px] font-bold uppercase tracking-wide transition-colors duration-300 flex items-center justify-center ${
                              formData.goal === g ? 'text-black' : 'text-gray-500 hover:text-gray-300'
                          }`}
                          style={{width: `${100/goals.length}%`}}
                      >
                          {g === 'Fat Loss' && <i className="fas fa-fire mr-1.5"></i>}
                          {g === 'Muscle Gain' && <i className="fas fa-dumbbell mr-1.5"></i>}
                          {g === 'Maintenance / Recomp' && <i className="fas fa-balance-scale mr-1.5"></i>}
                          {g === 'Maintenance / Recomp' ? 'Recomp' : g}
                      </button>
                  ))}
              </div>
          </div>

          {/* DIET PREFERENCE SLIDER */}
          <div className="space-y-3">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <i className="fas fa-utensils text-green-400"></i> Diet Preference
              </label>
              
              <div className="relative bg-black/40 backdrop-blur-md rounded-2xl p-1.5 flex justify-between items-center border border-white/5 h-16 select-none">
                  {/* Sliding Pill */}
                  <div 
                    className={`absolute top-1.5 bottom-1.5 rounded-xl shadow-lg transition-all duration-500 ease-spring gpu ${
                        formData.dietary_preference === 'veg' ? 'bg-green-500 shadow-green-500/20' : 
                        formData.dietary_preference === 'egg' ? 'bg-yellow-500 shadow-yellow-500/20' : 
                        'bg-red-500 shadow-red-500/20'
                    }`}
                    style={{
                        transform: `translateX(${currentDietIndex * 100}%)`,
                        width: `${100 / diets.length}%`,
                    }}
                  ></div>

                  {diets.map((type) => (
                      <button
                          key={type}
                          onClick={() => handleChange('dietary_preference', type)}
                          className={`flex-1 relative z-10 h-full flex flex-col items-center justify-center transition-colors duration-300 ${
                              formData.dietary_preference === type ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                          }`}
                          style={{width: `${100/diets.length}%`}}
                      >
                          <i className={`fas ${type === 'veg' ? 'fa-leaf' : type === 'egg' ? 'fa-egg' : 'fa-drumstick-bite'} text-lg mb-0.5 ${formData.dietary_preference === type ? 'scale-110' : ''} transition-transform`}></i>
                          <span className="text-[9px] font-bold uppercase">{type}</span>
                      </button>
                  ))}
              </div>
          </div>

          {/* ACTIVITY LEVEL CARDS */}
          <div className="space-y-3">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <i className="fas fa-running text-blue-400"></i> Activity Level
              </label>
              <div className="space-y-2">
                  {Object.values(ActivityLevel).map(level => {
                      const { title, desc } = parseActivity(level);
                      const isSelected = formData.activityLevel === level;
                      
                      return (
                        <button
                          key={level}
                          onClick={() => handleChange('activityLevel', level)}
                          className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden group active:scale-[0.98] ${
                             isSelected 
                               ? 'bg-blue-600/10 border-blue-500/50 shadow-[0_0_20px_rgba(37,99,235,0.15)]' 
                               : 'bg-black/20 border-white/5 hover:bg-white/5 hover:border-white/10'
                          }`}
                        >
                             <div className="flex justify-between items-center relative z-10">
                                <div>
                                    <div className={`font-bold text-sm mb-1 ${isSelected ? 'text-blue-400' : 'text-gray-300'}`}>
                                        {title}
                                    </div>
                                    <div className="text-[11px] text-gray-500 font-medium">
                                        {desc}
                                    </div>
                                </div>
                                {isSelected && (
                                    <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center shadow-lg animate-fade-in">
                                        <i className="fas fa-check text-white text-xs"></i>
                                    </div>
                                )}
                             </div>
                        </button>
                      );
                  })}
              </div>
          </div>

          {/* FIXED: Removed sticky positioning to prevent floating over content */}
          <div className="pt-8 space-y-3">
              <button 
                  onClick={handleSaveAndRegenerate}
                  disabled={loading}
                  className="w-full bg-white text-black font-black py-4 rounded-2xl shadow-2xl shadow-white/10 hover:bg-gray-200 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 text-sm uppercase tracking-wider relative overflow-hidden"
              >
                  {loading ? (
                       <i className="fas fa-circle-notch fa-spin"></i>
                  ) : (
                       <>
                         <span className="relative z-10">Save Settings & Update Plan</span>
                         <i className="fas fa-save relative z-10"></i>
                       </>
                  )}
              </button>

              {/* Retry Button only shows if Auto-Regen Fails */}
              {showRegen && (
                  <button 
                    onClick={async () => {
                        setRegenLoading(true);
                        // Re-run the manual regen logic if needed
                        try {
                           const { data: { user } } = await supabase.auth.getUser();
                           if (!user) throw new Error("No user");
                           const today = getLocalISODate();
                           const macros = calculatePlan(formData);
                           const newPlan = await generateDailyMealPlan(
                              formData, macros, today, [], 
                              "Manual Retry", formData.dietary_preference as any
                           );
                           await supabase.from('daily_meal_plans').upsert({ user_id: user.id, date: today, meals: newPlan.meals, macros: newPlan.macros }, { onConflict: 'user_id, date' });
                           if (onPlanRegenerated) onPlanRegenerated();
                           setMessage({ text: "Plan Updated!", type: 'success' });
                           setShowRegen(false);
                        } catch(e) { console.error(e); }
                        setRegenLoading(false);
                    }}
                    disabled={regenLoading}
                    className="w-full bg-red-500 text-white font-bold py-3 rounded-2xl shadow-lg animate-fade-in-up flex items-center justify-center gap-2 active:scale-95 transition-transform"
                  >
                      {regenLoading ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-redo"></i>}
                      Retry Plan Update
                  </button>
              )}
          </div>

          {message && (
              <div className={`p-4 rounded-2xl border text-sm flex items-start gap-3 animate-slide-up ${
                  message.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-200' : 'bg-red-500/10 border-red-500/30 text-red-200'
              }`}>
                  <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                       message.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                  }`}>
                      <i className={`fas ${message.type === 'success' ? 'fa-check' : 'fa-exclamation'} text-[10px]`}></i>
                  </div>
                  <p className="leading-tight">{message.text}</p>
              </div>
          )}
      </div>
    </div>
  );
};

export default ProfileSettings;
