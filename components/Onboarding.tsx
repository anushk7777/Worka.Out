
import React, { useState } from 'react';
import { UserProfile, ActivityLevel, Goal, Gender } from '../types';
import { supabase } from '../services/supabaseClient';
import { generateWorkoutSplit } from '../services/geminiService';
import { calculatePlan } from './Calculator';
import BodyFatAnalyzer from './BodyFatAnalyzer';

interface Props {
  onComplete: (profile: UserProfile) => void;
}

const Onboarding: React.FC<Props> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Saving...");
  const [showAnalyzer, setShowAnalyzer] = useState(false);
  const [scanFile, setScanFile] = useState<File | null>(null);
  
  const [formData, setFormData] = useState<Partial<UserProfile>>({
    activityLevel: ActivityLevel.SEDENTARY,
    goal: Goal.FAT_LOSS,
    gender: Gender.MALE,
    dietary_preference: 'non-veg' // Default
  });

  const handleChange = (field: keyof UserProfile, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (step < 4) {
      setStep(step + 1);
    } else if (step === 4) {
      setStep(5);
    }
  };

  const handleAnalysisComplete = (percentage: number, file: File) => {
    setFormData(prev => ({ ...prev, bodyFat: percentage }));
    setScanFile(file); 
  };

  // Helper for ISO Date
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

      // Calculate Calories & Budget
      const calculatedMacros = calculatePlan(finalProfile);

      // 1. Save Profile with Budget
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

      const { error: profileError } = await supabase
        .from('profiles')
        .insert([profileData]);

      if (profileError) throw profileError;

      // 2. Upload Scan Image
      let photoUrl = null;
      if (scanFile) {
        setLoadingText("Uploading Scan...");
        const fileExt = scanFile.name.split('.').pop();
        const fileName = `${user.id}/baseline-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('progress_photos')
          .upload(fileName, scanFile);

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('progress_photos')
            .getPublicUrl(fileName);
          photoUrl = urlData.publicUrl;
        }
      }

      // 3. Create Baseline Log
      const logData = {
        user_id: user.id,
        date: getTodayISO(), 
        weight: Number(finalProfile.weight),
        body_fat: finalProfile.bodyFat ? Number(finalProfile.bodyFat) : null,
        photo_url: photoUrl,
        notes: "Initial Baseline Log from Onboarding"
      };

      await supabase.from('progress_logs').insert([logData]);

      // 4. Generate Workout Split ONLY (Diet is daily now)
      setLoadingText("Generating Weekly Workout Split...");
      const workoutPlan = await generateWorkoutSplit(finalProfile);

      // 5. Save Workout Plan
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
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-4">
      <div className="bg-secondary p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-700 relative">
        <h2 className="text-2xl font-bold text-primary mb-6 text-center">
          {step === 1 ? "Basics" : step === 2 ? "Stats" : step === 3 ? "Preferences" : step === 4 ? "Goals" : "Baseline Check"}
        </h2>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input 
                type="text" 
                className="w-full bg-dark border border-gray-600 rounded p-3 text-white focus:border-primary outline-none"
                value={formData.name || ''}
                onChange={(e) => handleChange('name', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Gender</label>
              <div className="flex gap-4">
                {[Gender.MALE, Gender.FEMALE].map((g) => (
                  <button
                    key={g}
                    onClick={() => handleChange('gender', g)}
                    className={`flex-1 p-3 rounded border ${formData.gender === g ? 'bg-primary border-primary text-white' : 'bg-dark border-gray-600 text-gray-400'}`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Age</label>
              <input 
                type="number" 
                className="w-full bg-dark border border-gray-600 rounded p-3 text-white focus:border-primary outline-none"
                value={formData.age || ''}
                onChange={(e) => handleChange('age', parseInt(e.target.value))}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Weight (kg)</label>
              <input 
                type="number" 
                className="w-full bg-dark border border-gray-600 rounded p-3 text-white focus:border-primary outline-none"
                value={formData.weight || ''}
                onChange={(e) => handleChange('weight', parseFloat(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Height (cm)</label>
              <input 
                type="number" 
                className="w-full bg-dark border border-gray-600 rounded p-3 text-white focus:border-primary outline-none"
                value={formData.height || ''}
                onChange={(e) => handleChange('height', parseFloat(e.target.value))}
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <label className="block text-sm font-medium mb-1">Diet Preference</label>
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
                            : 'bg-dark border-gray-600 text-gray-400 hover:border-gray-500'
                        }`}
                    >
                        <i className={`fas ${type === 'veg' ? 'fa-leaf' : type === 'egg' ? 'fa-egg' : 'fa-drumstick-bite'} text-lg`}></i>
                        <span className="text-[10px] font-bold uppercase">{type}</span>
                    </button>
                ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Activity Level</label>
              <select 
                className="w-full bg-dark border border-gray-600 rounded p-3 text-white focus:border-primary outline-none text-sm"
                value={formData.activityLevel}
                onChange={(e) => handleChange('activityLevel', e.target.value)}
              >
                {Object.values(ActivityLevel).map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Primary Goal</label>
              <select 
                className="w-full bg-dark border border-gray-600 rounded p-3 text-white focus:border-primary outline-none"
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
          <div className="space-y-6 text-center">
            <div className="bg-dark/50 p-4 rounded-xl border border-gray-600">
              <i className="fas fa-camera text-4xl text-primary mb-3"></i>
              <h3 className="text-lg font-bold">Body Scan Required</h3>
              <p className="text-sm text-gray-400 mt-2">
                To generate a 100% accurate plan, we need to analyze your current physique.
              </p>
            </div>

            <div className="space-y-4">
              <button 
                onClick={() => setShowAnalyzer(true)}
                className={`w-full bg-secondary hover:bg-gray-700 text-primary border border-primary font-bold py-3 rounded flex items-center justify-center gap-2 ${scanFile ? 'ring-2 ring-green-500' : ''}`}
              >
                {scanFile ? (
                   <><i className="fas fa-check"></i> Image Captured ({formData.bodyFat}%)</>
                ) : (
                   <><i className="fas fa-camera"></i> Open Scanner</>
                )}
              </button>
            </div>
          </div>
        )}

        <div className="mt-8 flex gap-2">
            {step > 1 && (
                <button 
                onClick={() => setStep(step - 1)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded"
                disabled={loading}
                >
                Back
                </button>
            )}
            
            {step === 5 ? (
                <button 
                  onClick={handleFinalize}
                  disabled={loading || !formData.bodyFat}
                  className="flex-1 bg-primary hover:bg-orange-600 text-white font-bold py-3 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <i className="fas fa-spinner fa-spin"></i> : "Initialize"}
                </button>
            ) : (
                <button 
                onClick={handleNext}
                disabled={(step === 1 && (!formData.name || !formData.age) || step === 2 && (!formData.weight || !formData.height))}
                className="flex-1 bg-primary hover:bg-orange-600 text-white font-bold py-3 rounded disabled:opacity-50"
                >
                Next
                </button>
            )}
        </div>

        {loading && (
            <p className="text-center text-xs text-gray-400 mt-4 animate-pulse">{loadingText}</p>
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
