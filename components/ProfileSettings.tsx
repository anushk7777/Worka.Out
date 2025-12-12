
import React, { useState } from 'react';
import { UserProfile, Goal, ActivityLevel } from '../types';
import { supabase } from '../services/supabaseClient';
import { calculatePlan } from './Calculator';

interface Props {
  profile: UserProfile;
  onUpdateProfile: (updatedProfile: UserProfile) => void;
  onSignOut: () => void;
}

const ProfileSettings: React.FC<Props> = ({ profile, onUpdateProfile, onSignOut }) => {
  const [formData, setFormData] = useState<UserProfile>(profile);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  const bmi = (formData.weight / ((formData.height/100) * (formData.height/100))).toFixed(1);

  const handleChange = (field: keyof UserProfile, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setMessage(null);
  };

  const handleSave = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      // Recalculate macros based on new goal/activity
      const newMacros = calculatePlan(formData);

      const updates = {
        goal: formData.goal,
        activity_level: formData.activityLevel,
        dietary_preference: formData.dietary_preference,
        daily_calories: newMacros.calories,
        weekly_calories: newMacros.calories * 7,
        updated_at: new Date()
      };

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;

      // Update parent state
      onUpdateProfile({ 
        ...formData, 
        daily_calories: newMacros.calories,
        weekly_calories: newMacros.calories * 7
      });

      setMessage({ 
        text: "Profile updated. Your new meal plan will be generated starting TOMORROW.", 
        type: 'success' 
      });

    } catch (err: any) {
      console.error(err);
      setMessage({ text: "Failed to update profile.", type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 pb-28 space-y-6">
      <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Profile & Settings</h2>
          <button 
            onClick={onSignOut}
            className="text-xs text-red-400 border border-red-500/30 bg-red-500/10 px-3 py-1.5 rounded-lg hover:bg-red-500/20 transition-colors"
          >
            <i className="fas fa-sign-out-alt mr-1"></i> Sign Out
          </button>
      </div>

      {/* Hero Stats */}
      <div className="glass-card p-6 rounded-2xl flex items-center justify-between relative overflow-hidden">
         <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl"></div>
         <div>
            <h3 className="text-xl font-bold text-white">{formData.name}</h3>
            <div className="flex gap-4 mt-2 text-sm text-gray-400">
                <span>{formData.age} yrs</span>
                <span>{formData.height} cm</span>
                <span>{formData.weight} kg</span>
            </div>
         </div>
         <div className="text-right z-10">
             <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">BMI</div>
             <div className="text-2xl font-black text-primary">{bmi}</div>
         </div>
      </div>

      <div className="space-y-6 animate-slide-up">
          
          {/* Goal Setting */}
          <div className="space-y-2">
              <label className="text-sm font-bold text-gray-300 uppercase tracking-wide flex items-center gap-2">
                  <i className="fas fa-bullseye text-primary"></i> Fitness Goal
              </label>
              <div className="bg-secondary p-1 rounded-xl border border-gray-700">
                  {Object.values(Goal).map((g) => (
                      <button
                          key={g}
                          onClick={() => handleChange('goal', g)}
                          className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-all mb-1 last:mb-0 ${
                              formData.goal === g 
                              ? 'bg-primary text-black font-bold shadow-lg' 
                              : 'text-gray-400 hover:bg-white/5'
                          }`}
                      >
                          {g}
                      </button>
                  ))}
              </div>
          </div>

          {/* Diet Preference */}
          <div className="space-y-2">
              <label className="text-sm font-bold text-gray-300 uppercase tracking-wide flex items-center gap-2">
                  <i className="fas fa-utensils text-green-400"></i> Diet Preference
              </label>
              <div className="grid grid-cols-3 gap-2">
                  {(['veg', 'egg', 'non-veg'] as const).map((type) => (
                      <button
                          key={type}
                          onClick={() => handleChange('dietary_preference', type)}
                          className={`py-3 rounded-xl border transition-all flex flex-col items-center gap-1 ${
                              formData.dietary_preference === type 
                              ? type === 'veg' ? 'bg-green-500 text-white border-green-500' 
                              : type === 'egg' ? 'bg-yellow-500 text-black border-yellow-500'
                              : 'bg-red-500 text-white border-red-500'
                              : 'bg-dark border-gray-700 text-gray-500 hover:border-gray-500'
                          }`}
                      >
                          <i className={`fas ${type === 'veg' ? 'fa-leaf' : type === 'egg' ? 'fa-egg' : 'fa-drumstick-bite'} text-lg`}></i>
                          <span className="text-[10px] font-bold uppercase">{type}</span>
                      </button>
                  ))}
              </div>
              <p className="text-[10px] text-gray-500 italic px-1">
                  *Changing this will not affect today's meal plan. The AI will adapt starting tomorrow.
              </p>
          </div>

          {/* Activity Level */}
          <div className="space-y-2">
              <label className="text-sm font-bold text-gray-300 uppercase tracking-wide flex items-center gap-2">
                  <i className="fas fa-running text-blue-400"></i> Activity Level
              </label>
              <select 
                  value={formData.activityLevel}
                  onChange={(e) => handleChange('activityLevel', e.target.value)}
                  className="w-full bg-secondary border border-gray-700 rounded-xl p-3 text-sm text-white focus:border-primary outline-none"
              >
                  {Object.values(ActivityLevel).map(level => (
                      <option key={level} value={level}>{level}</option>
                  ))}
              </select>
          </div>

          {/* Save Button */}
          <button 
              onClick={handleSave}
              disabled={loading}
              className="w-full bg-white text-black font-bold py-4 rounded-xl shadow-lg shadow-white/10 hover:bg-gray-200 transition-all active:scale-95 disabled:opacity-50"
          >
              {loading ? <i className="fas fa-circle-notch fa-spin"></i> : "Save Profile Changes"}
          </button>

          {message && (
              <div className={`p-4 rounded-xl border text-sm flex items-start gap-3 animate-fade-in ${
                  message.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-200' : 'bg-red-500/10 border-red-500/30 text-red-200'
              }`}>
                  <i className={`fas ${message.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle'} mt-0.5`}></i>
                  <p>{message.text}</p>
              </div>
          )}
      </div>
    </div>
  );
};

export default ProfileSettings;
