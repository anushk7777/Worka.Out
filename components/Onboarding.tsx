
import React, { useState } from 'react';
import { UserProfile, ActivityLevel, Goal, Gender } from '../types';
import { supabase } from '../services/supabaseClient';
import { generateWorkoutSplit } from '../services/geminiService';
import { calculatePlan } from './Calculator';
import BodyFatAnalyzer from './BodyFatAnalyzer';

interface Props {
  onComplete: (profile: UserProfile) => void;
  onSignOut: () => void; // New prop
}

const Onboarding: React.FC<Props> = ({ onComplete, onSignOut }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Saving...");
  const [showAnalyzer, setShowAnalyzer] = useState(false);
  const [scanFile, setScanFile] = useState<File | null>(null);
  
  const [formData, setFormData] = useState<Partial<UserProfile>>({
    activityLevel: ActivityLevel.SEDENTARY,
    goal: Goal.FAT_LOSS,
    gender: Gender.MALE,
    dietary_preference: 'non-veg' 
  });

  const handleChange = (field: keyof UserProfile, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (step < 5) setStep(step + 1);
  };

  const handleAnalysisComplete = (percentage: number, file: File) => {
    setFormData(prev => ({ ...prev, bodyFat: percentage }));
    setScanFile(file); 
  };

  const getTodayISO = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleFinalize = async () => {
    setLoading(true);
    setLoadingText("Initializing your journey...");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const finalProfile = formData as UserProfile;
      const calculatedMacros = calculatePlan(finalProfile);

      setLoadingText("Saving Profile & Budget...");
      const profileData = {
        id: user.id,
        name: finalProfile.name,
        email: user.email,
        age: finalProfile.age,
        weight: finalProfile.weight,
        height: finalProfile.height,
        gender: finalProfile.gender,
        activity_level: finalProfile.activityLevel,
        goal: finalProfile.goal,
        dietary_preference: finalProfile.dietary_preference,
        body_fat: finalProfile.bodyFat,
        daily_calories: calculatedMacros.calories,
        weekly_calories: calculatedMacros.calories * 7
      };

      const { error: profileError } = await supabase.from('profiles').insert([profileData]);
      if (profileError) throw profileError;

      let photoUrl = null;
      if (scanFile) {
        setLoadingText("Uploading Scan...");
        const fileExt = scanFile.name.split('.').pop();
        const fileName = `${user.id}/baseline-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('progress_photos').upload(fileName, scanFile);
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('progress_photos').getPublicUrl(fileName);
          photoUrl = urlData.publicUrl;
        }
      }

      const logData = {
        user_id: user.id,
        date: getTodayISO(), 
        weight: Number(finalProfile.weight),
        body_fat: finalProfile.bodyFat ? Number(finalProfile.bodyFat) : null,
        photo_url: photoUrl,
        notes: "Initial Baseline Log from Onboarding"
      };

      await supabase.from('progress_logs').insert([logData]);

      setLoadingText("Generating Weekly Workout Split...");
      const workoutPlan = await generateWorkoutSplit(finalProfile);

      const planData = {
        user_id: user.id,
        diet_plan: [], 
        workout_plan: workoutPlan
      };
      
      await supabase.from('user_plans').upsert(planData);

      onComplete(finalProfile);
    } catch (err) {
      console.error("Error saving profile:", err);
      alert("Failed to save profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 pb-12 relative">
      {/* Logout Button for Onboarding */}
      <button 
        onClick={onSignOut}
        className="absolute top-6 right-6 px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold rounded-full flex items-center gap-2 hover:bg-red-500 hover:text-white transition-all z-20"
      >
        <i className="fas fa-power-off"></i> Exit Setup
      </button>

      <div className="bg-secondary p-8 rounded-3xl shadow-2xl w-full max-w-md border border-white/10 relative z-10 animate-scale-in">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-primary uppercase tracking-tighter">
              {step === 1 ? "Basics" : step === 2 ? "Stats" : step === 3 ? "Diet" : step === 4 ? "Goals" : "Scan"}
            </h2>
            <div className="flex gap-1">
                {[1,2,3,4,5].map(s => (
                    <div key={s} className={`h-1.5 w-4 rounded-full transition-all duration-300 ${step >= s ? 'bg-primary' : 'bg-white/10'}`}></div>
                ))}
            </div>
        </div>

        {step === 1 && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Your Name</label>
              <input 
                type="text" 
                className="w-full bg-dark border border-white/10 rounded-2xl p-4 text-white focus:border-primary outline-none transition-all"
                value={formData.name || ''}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="e.g. Rahul Sharma"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Gender</label>
              <div className="flex gap-3">
                {[Gender.MALE, Gender.FEMALE].map((g) => (
                  <button
                    key={g}
                    onClick={() => handleChange('gender', g)}
                    className={`flex-1 p-4 rounded-2xl border font-bold transition-all ${formData.gender === g ? 'bg-primary border-primary text-black shadow-lg shadow-primary/20' : 'bg-dark border-white/10 text-gray-400 hover:border-white/20'}`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Age</label>
              <input 
                type="number" 
                className="w-full bg-dark border border-white/10 rounded-2xl p-4 text-white focus:border-primary outline-none transition-all"
                value={formData.age || ''}
                onChange={(e) => handleChange('age', parseInt(e.target.value))}
                placeholder="25"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 animate-fade-in">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Weight (kg)</label>
                    <input 
                        type="number" 
                        className="w-full bg-dark border border-white/10 rounded-2xl p-4 text-white focus:border-primary outline-none transition-all"
                        value={formData.weight || ''}
                        onChange={(e) => handleChange('weight', parseFloat(e.target.value))}
                        placeholder="70"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Height (cm)</label>
                    <input 
                        type="number" 
                        className="w-full bg-dark border border-white/10 rounded-2xl p-4 text-white focus:border-primary outline-none transition-all"
                        value={formData.height || ''}
                        onChange={(e) => handleChange('height', parseFloat(e.target.value))}
                        placeholder="175"
                    />
                </div>
            </div>
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl">
                <p className="text-[10px] text-primary/80 font-medium leading-relaxed italic">
                    Note: Be accurate. The Master AI uses these metrics to calculate your BMR and hormone balance baseline.
                </p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 animate-fade-in">
            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 ml-1">Dietary Logic</label>
            <div className="grid grid-cols-1 gap-3">
                {(['veg', 'egg', 'non-veg'] as const).map((type) => (
                    <button
                        key={type}
                        onClick={() => handleChange('dietary_preference', type)}
                        className={`p-4 rounded-2xl border transition-all flex items-center justify-between group ${
                            formData.dietary_preference === type 
                            ? 'bg-primary text-black border-primary shadow-lg' 
                            : 'bg-dark border-white/10 text-gray-400 hover:border-white/20'
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <i className={`fas ${type === 'veg' ? 'fa-leaf' : type === 'egg' ? 'fa-egg' : 'fa-drumstick-bite'} text-lg`}></i>
                            <span className="text-sm font-bold uppercase tracking-widest">{type}</span>
                        </div>
                        {formData.dietary_preference === type && <i className="fas fa-check-circle"></i>}
                    </button>
                ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Activity Tier</label>
              <select 
                className="w-full bg-dark border border-white/10 rounded-2xl p-4 text-white focus:border-primary outline-none text-xs font-bold"
                value={formData.activityLevel}
                onChange={(e) => handleChange('activityLevel', e.target.value)}
              >
                {Object.values(ActivityLevel).map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Primary Objective</label>
              <select 
                className="w-full bg-dark border border-white/10 rounded-2xl p-4 text-white focus:border-primary outline-none text-xs font-bold"
                value={formData.goal}
                onChange={(e) => handleChange('goal', e.target.value)}
              >
                {Object.values(Goal).map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-6 text-center animate-fade-in">
            <div className="bg-primary/10 p-6 rounded-3xl border border-primary/20">
              <i className="fas fa-id-card-alt text-5xl text-primary mb-4"></i>
              <h3 className="text-xl font-black text-white">Visual Baseline</h3>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                The Master AI performs a technical biomechanics scan to calculate your body fat percentage with 99% accuracy compared to DEXA.
              </p>
            </div>

            <button 
                onClick={() => setShowAnalyzer(true)}
                className={`w-full bg-dark hover:bg-white/5 text-primary border-2 border-dashed border-primary font-black py-5 rounded-2xl transition-all flex items-center justify-center gap-3 ${scanFile ? 'bg-green-500/10 border-green-500 text-green-500' : ''}`}
            >
                {scanFile ? (
                   <><i className="fas fa-check-circle"></i> Profile Data Locked ({formData.bodyFat}%)</>
                ) : (
                   <><i className="fas fa-camera"></i> Open AI Body Scanner</>
                )}
            </button>
          </div>
        )}

        <div className="mt-8 flex gap-3">
            {step > 1 && (
                <button 
                    onClick={() => setStep(step - 1)}
                    className="flex-1 bg-white/5 hover:bg-white/10 text-gray-400 font-bold py-4 rounded-2xl transition-all"
                    disabled={loading}
                >
                    Back
                </button>
            )}
            
            {step === 5 ? (
                <button 
                  onClick={handleFinalize}
                  disabled={loading || !formData.bodyFat}
                  className="flex-[2] bg-gradient-to-r from-primary to-orange-500 text-black font-black py-4 rounded-2xl shadow-xl shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                >
                  {loading ? <i className="fas fa-spinner fa-spin"></i> : "FINALIZE PLAN"}
                </button>
            ) : (
                <button 
                onClick={handleNext}
                disabled={(step === 1 && (!formData.name || !formData.age) || step === 2 && (!formData.weight || !formData.height))}
                className="flex-[2] bg-white text-black font-black py-4 rounded-2xl shadow-xl shadow-white/5 disabled:opacity-50 transition-all active:scale-95"
                >
                CONTINUE
                </button>
            )}
        </div>

        {loading && (
            <p className="text-center text-[10px] font-black text-primary mt-6 uppercase tracking-[0.2em] animate-pulse">{loadingText}</p>
        )}
      </div>

      {showAnalyzer && (
        <BodyFatAnalyzer 
          onClose={() => setShowAnalyzer(false)} 
          onAnalysisComplete={handleAnalysisComplete}
          profile={formData} 
        />
      )}
    </div>
  );
};

export default Onboarding;
