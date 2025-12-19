
import React, { useState, useEffect } from 'react';
import { UserProfile, Goal, ActivityLevel } from '../types';
import { supabase } from '../services/supabaseClient';
import { calculatePlan } from './Calculator';

interface Props {
  profile: UserProfile;
  onUpdateProfile: (updatedProfile: UserProfile) => void;
  onSignOut: () => void;
  onPlanRegenerated?: () => void;
}

const ProfileSettings: React.FC<Props> = ({ profile, onUpdateProfile, onSignOut }) => {
  const [formData, setFormData] = useState<UserProfile>({
      ...profile,
      dietary_preference: profile.dietary_preference || 'non-veg',
      goal_aggressiveness: profile.goal_aggressiveness || 'normal',
      medical_conditions: profile.medical_conditions || ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [showRiskModal, setShowRiskModal] = useState(false);
  
  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);

  useEffect(() => {
    setFormData({
        ...profile,
        dietary_preference: profile.dietary_preference || 'non-veg',
        goal_aggressiveness: profile.goal_aggressiveness || 'normal',
        medical_conditions: profile.medical_conditions || ''
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
  };

  const handlePreSave = () => {
      // If user is switching to Aggressive, warn them first
      if (formData.goal_aggressiveness === 'aggressive' && profile.goal_aggressiveness !== 'aggressive') {
          setShowRiskModal(true);
      } else {
          handleSaveProfile();
      }
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    setMessage(null);
    setShowRiskModal(false);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      // 1. Calculate New Macros (Fresh start based on new stats & aggressiveness)
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
        
        // New Fields
        medical_conditions: formData.medical_conditions,
        goal_aggressiveness: formData.goal_aggressiveness,

        daily_calories: newMacros.calories,
        weekly_calories: newMacros.calories * 7,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
      if (error) throw error;

      // Update Local State immediately
      onUpdateProfile({ 
          ...formData, 
          daily_calories: newMacros.calories, 
          weekly_calories: newMacros.calories * 7 
      });
      
      setMessage({ text: "Profile & Intensity Updated. Check Dashboard to sync your meal plan.", type: 'success' });

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
    <div className="p-4 pb-32 space-y-8 animate-fade-in relative">
      
      {/* RISK WARNING MODAL */}
      {showRiskModal && (
          <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-6 backdrop-blur-xl animate-fade-in">
              <div className="bg-red-950/30 border border-red-500/50 rounded-[40px] p-8 w-full max-w-sm shadow-[0_0_60px_rgba(220,38,38,0.3)] animate-shake relative">
                  <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500 flex items-center justify-center mx-auto mb-6">
                      <i className="fas fa-biohazard text-3xl text-red-500"></i>
                  </div>
                  <h3 className="text-2xl font-black text-white text-center mb-4 uppercase tracking-tighter">Bio-Metric Warning</h3>
                  <div className="space-y-4 text-xs text-gray-300 font-medium leading-relaxed bg-black/40 p-4 rounded-2xl border border-white/5">
                      <p><strong className="text-red-400">1. Metabolic Adaptation:</strong> Aggressive deficits can downregulate T3 thyroid hormone, slowing metabolism.</p>
                      <p><strong className="text-red-400">2. Lean Mass Risk:</strong> Accelerated fat loss increases the risk of muscle catabolism. High protein is non-negotiable.</p>
                      <p><strong className="text-red-400">3. Hormonal Impact:</strong> May temporarily suppress testosterone/estrogen and increase cortisol.</p>
                  </div>
                  <p className="text-center text-[10px] text-gray-500 mt-4 uppercase tracking-widest">Do you accept these physiological risks?</p>
                  
                  <div className="grid grid-cols-2 gap-4 mt-6">
                      <button 
                        onClick={() => { setShowRiskModal(false); handleChange('goal_aggressiveness', 'normal'); }}
                        className="py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-gray-400 font-bold text-xs uppercase tracking-wider"
                      >
                          Cancel
                      </button>
                      <button 
                        onClick={handleSaveProfile}
                        className="py-4 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-red-600/20"
                      >
                          I Confirm
                      </button>
                  </div>
              </div>
          </div>
      )}

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

      <div className="space-y-8 animate-slide-up">
          
          {/* MEDICAL CONDITIONS INPUT */}
          <div className="space-y-3">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <i className="fas fa-notes-medical text-red-400"></i> Medical Context
              </label>
              <div className="relative">
                  <textarea
                      value={formData.medical_conditions}
                      onChange={(e) => handleChange('medical_conditions', e.target.value)}
                      placeholder="E.g. Diabetes Type 2, Hypertensive, Peanut Allergy, Knee Injury..."
                      className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm text-white focus:border-red-400/50 outline-none h-24 placeholder-gray-600 font-medium resize-none shadow-inner" 
                  />
                  <div className="absolute bottom-3 right-3 text-[9px] text-gray-600 uppercase font-black tracking-wider pointer-events-none">
                      AI Safety Filter Active
                  </div>
              </div>
          </div>

          {/* GOAL & INTENSITY SECTION */}
          <div className="space-y-4 bg-white/[0.02] p-4 rounded-3xl border border-white/5">
              {/* GOAL SLIDER */}
              <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 block">Objective</label>
                  <div className="relative bg-black/40 backdrop-blur-md rounded-2xl p-1.5 flex justify-between items-center border border-white/5 h-14 select-none">
                      <div 
                        className="absolute top-1.5 bottom-1.5 bg-gradient-to-r from-primary to-yellow-500 rounded-xl shadow-lg shadow-primary/20 transition-all duration-500 ease-spring gpu"
                        style={{ transform: `translateX(${currentGoalIndex * 100}%)`, width: `${100 / goals.length}%` }}
                      ></div>
                      {goals.map((g) => (
                          <button
                              key={g}
                              onClick={() => handleChange('goal', g)}
                              className={`flex-1 relative z-10 h-full text-[10px] font-black uppercase tracking-wide transition-colors duration-300 flex items-center justify-center ${formData.goal === g ? 'text-black' : 'text-gray-500 hover:text-gray-300'}`}
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

              {/* INTENSITY TOGGLE */}
              <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 block">Protocol Intensity</label>
                  <div className="flex gap-3">
                      <button 
                          onClick={() => handleChange('goal_aggressiveness', 'normal')}
                          className={`flex-1 py-4 rounded-2xl border flex flex-col items-center justify-center transition-all ${formData.goal_aggressiveness === 'normal' ? 'bg-green-500/10 border-green-500 text-green-400 shadow-[0_0_20px_rgba(34,197,94,0.1)]' : 'bg-black/40 border-white/5 text-gray-500'}`}
                      >
                          <span className="text-[10px] uppercase font-black tracking-widest">Sustainable</span>
                          <span className="text-[9px] mt-1 opacity-70">Recommended</span>
                      </button>
                      <button 
                          onClick={() => handleChange('goal_aggressiveness', 'aggressive')}
                          className={`flex-1 py-4 rounded-2xl border flex flex-col items-center justify-center transition-all ${formData.goal_aggressiveness === 'aggressive' ? 'bg-red-500/10 border-red-500 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.2)]' : 'bg-black/40 border-white/5 text-gray-500'}`}
                      >
                          <span className="text-[10px] uppercase font-black tracking-widest flex items-center gap-1">
                              Accelerated <i className="fas fa-bolt text-[9px]"></i>
                          </span>
                          <span className="text-[9px] mt-1 opacity-70">High Risk</span>
                      </button>
                  </div>
              </div>
          </div>

          {/* DIET PREFERENCE SLIDER */}
          <div className="space-y-3">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <i className="fas fa-utensils text-green-400"></i> Diet Preference
              </label>
              
              <div className="relative bg-black/40 backdrop-blur-md rounded-2xl p-1.5 flex justify-between items-center border border-white/5 h-16 select-none">
                  <div 
                    className={`absolute top-1.5 bottom-1.5 rounded-xl shadow-lg transition-all duration-500 ease-spring gpu ${
                        formData.dietary_preference === 'veg' ? 'bg-green-500 shadow-green-500/20' : 
                        formData.dietary_preference === 'egg' ? 'bg-yellow-500 shadow-yellow-500/20' : 
                        'bg-red-500 shadow-red-500/20'
                    }`}
                    style={{ transform: `translateX(${currentDietIndex * 100}%)`, width: `${100 / diets.length}%` }}
                  ></div>

                  {diets.map((type) => (
                      <button
                          key={type}
                          onClick={() => handleChange('dietary_preference', type)}
                          className={`flex-1 relative z-10 h-full flex flex-col items-center justify-center transition-colors duration-300 ${formData.dietary_preference === type ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
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
                          className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden group active:scale-[0.98] ${isSelected ? 'bg-blue-600/10 border-blue-500/50 shadow-[0_0_20px_rgba(37,99,235,0.15)]' : 'bg-black/20 border-white/5 hover:bg-white/5 hover:border-white/10'}`}
                        >
                             <div className="flex justify-between items-center relative z-10">
                                <div>
                                    <div className={`font-bold text-sm mb-1 ${isSelected ? 'text-blue-400' : 'text-gray-300'}`}>{title}</div>
                                    <div className="text-[11px] text-gray-500 font-medium">{desc}</div>
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

          <div className="pt-8 space-y-3">
              <button 
                  onClick={handlePreSave}
                  disabled={loading}
                  className="w-full bg-white text-black font-black py-4 rounded-2xl shadow-2xl shadow-white/10 hover:bg-gray-200 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 text-sm uppercase tracking-wider relative overflow-hidden"
              >
                  {loading ? (
                       <i className="fas fa-circle-notch fa-spin"></i>
                  ) : (
                       <>
                         <span className="relative z-10">Save Profile & Recalculate</span>
                         <i className="fas fa-save relative z-10"></i>
                       </>
                  )}
              </button>
          </div>

          {message && (
              <div className={`p-4 rounded-2xl border text-sm flex items-start gap-3 animate-slide-up ${message.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-200' : 'bg-red-500/10 border-red-500/30 text-red-200'}`}>
                  <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${message.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
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
