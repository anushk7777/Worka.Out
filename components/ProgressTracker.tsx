import React, { useState, useEffect } from 'react';
import { ProgressEntry, UserProfile } from '../types';
import { supabase } from '../services/supabaseClient';
import BodyFatAnalyzer from './BodyFatAnalyzer';
import { generateWorkoutSplit } from '../services/geminiService';
import { calculatePlan } from './Calculator';

interface Props {
  logs: ProgressEntry[];
  onAddLog: (log: ProgressEntry) => void;
  profile: UserProfile; // Updated from currentWeight to full profile for Analyzer context
  launchScanner?: boolean;
  onScannerLaunched?: () => void;
}

const ProgressTracker: React.FC<Props> = ({ logs, onAddLog, profile, launchScanner, onScannerLaunched }) => {
  const [weight, setWeight] = useState(profile.weight);
  const [bodyFat, setBodyFat] = useState('');
  const [notes, setNotes] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [showAnalyzer, setShowAnalyzer] = useState(false);
  
  // Tab State: 'quick' for weight only, 'scan' for full re-evaluation
  const [logMode, setLogMode] = useState<'quick' | 'scan'>('quick');

  // Handle auto-launch from parent
  useEffect(() => {
    if (launchScanner) {
      setLogMode('scan');
      setShowAnalyzer(true);
      if (onScannerLaunched) {
        onScannerLaunched();
      }
    }
  }, [launchScanner, onScannerLaunched]);

  const handleAnalysisComplete = (percentage: number, file: File) => {
    setBodyFat(percentage.toString());
    setPhotoFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);

    setLogMode('scan'); // Ensure we are in scan mode to see results
  };

  const handleLog = async () => {
    if (!weight) return;
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      let photoUrl = null;

      // 1. Upload Photo if exists
      if (photoFile) {
        const fileExt = photoFile.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('progress_photos')
          .upload(fileName, photoFile);

        if (uploadError) throw uploadError;

        // Get Public URL
        const { data: urlData } = supabase.storage
          .from('progress_photos')
          .getPublicUrl(fileName);
          
        photoUrl = urlData.publicUrl;
      }

      // 2. Insert Log
      const logData = {
        user_id: user.id,
        date: new Date().toLocaleDateString(),
        weight: Number(weight),
        body_fat: bodyFat ? Number(bodyFat) : null,
        photo_url: photoUrl,
        notes: notes
      };

      const { data, error } = await supabase
        .from('progress_logs')
        .insert([logData])
        .select()
        .single();

      if (error) throw error;

      // 3. Update local state
      onAddLog({
        id: data.id,
        date: data.date,
        created_at: data.created_at,
        weight: data.weight,
        bodyFat: data.body_fat,
        photo_url: data.photo_url,
        notes: data.notes
      });

      // --- AUTO-SCALE LOGIC ---
      const weightDiff = Math.abs(weight - profile.weight);
      if (weightDiff >= 0.5) {
        await regeneratePlan(user.id, weight);
      } else {
        alert('Progress logged successfully!');
      }

      // Reset Form
      setNotes('');
      setBodyFat('');
      setPhotoFile(null);
      setPhotoPreview(null);
      setLogMode('quick');

    } catch (error) {
      console.error('Error logging progress:', error);
      alert('Failed to save log. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const regeneratePlan = async (userId: string, newWeight: number) => {
    setRegenerating(true);
    try {
        const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
        if (!profileData) return;

        // Recalculate Calories for Database
        const updatedProfileRaw: UserProfile = { ...profileData, weight: newWeight };
        const newMacros = calculatePlan(updatedProfileRaw);

        await supabase
          .from('profiles')
          .update({ 
              weight: newWeight,
              daily_calories: newMacros.calories,
              weekly_calories: newMacros.calories * 7
          })
          .eq('id', userId);

        const updatedProfile: UserProfile = {
            ...profileData,
            weight: newWeight,
            bodyFat: bodyFat ? Number(bodyFat) : profileData.body_fat
        };

        const newWorkout = await generateWorkoutSplit(updatedProfile);

        await supabase
        .from('user_plans')
        .upsert({
            user_id: userId,
            workout_plan: newWorkout
        });

        alert('Progress logged! Your daily & weekly calorie budgets have been updated based on new weight.');
    } catch (err) {
        console.error("Scaling failed:", err);
        alert('Progress logged, but failed to update plan.');
    } finally {
        setRegenerating(false);
    }
  };

  const sortedLogs = [...logs].reverse(); 

  const getTrendIcon = (current: number, previous: number) => {
    if (current < previous) return <i className="fas fa-arrow-down text-green-500"></i>;
    if (current > previous) return <i className="fas fa-arrow-up text-red-500"></i>; 
    return <i className="fas fa-minus text-gray-500"></i>;
  };

  return (
    <div className="p-4 space-y-6 pb-32">
      <div className="bg-secondary p-6 rounded-2xl border border-gray-700">
        <h1 className="text-2xl font-bold text-primary mb-2">Log Monitor</h1>
        <p className="text-gray-400 text-sm">Track your progress. Significant weight changes will automatically update your profile and stats.</p>
      </div>

      {/* Input Section */}
      <div className="bg-secondary p-0 rounded-2xl border border-gray-700 relative overflow-hidden">
        
        {/* TABS */}
        <div className="flex border-b border-gray-700 bg-dark/30">
            <button 
                onClick={() => setLogMode('quick')}
                className={`flex-1 py-4 text-sm font-bold transition-all ${logMode === 'quick' ? 'bg-secondary text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
                Quick Log
            </button>
            <button 
                onClick={() => setLogMode('scan')}
                className={`flex-1 py-4 text-sm font-bold transition-all ${logMode === 'scan' ? 'bg-secondary text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
                <i className="fas fa-microchip mr-2"></i> AI Body Scan
            </button>
        </div>

        <div className="p-6">
            {logMode === 'quick' ? (
                 /* --- QUICK LOG MODE --- */
                 <div className="animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Current Weight (kg)</label>
                            <input 
                            type="number" 
                            value={weight}
                            onChange={(e) => setWeight(parseFloat(e.target.value))}
                            className="w-full bg-dark border border-gray-600 rounded-xl p-3 text-white focus:border-primary outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Body Fat % (Manual Input)</label>
                            <input 
                            type="number" 
                            value={bodyFat}
                            onChange={(e) => setBodyFat(e.target.value)}
                            className="w-full bg-dark border border-gray-600 rounded-xl p-3 text-white focus:border-primary outline-none"
                            placeholder="Optional"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs text-gray-500 mb-1">Notes</label>
                            <textarea 
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full bg-dark border border-gray-600 rounded-xl p-3 text-white focus:border-primary outline-none"
                            placeholder="How are you feeling?"
                            rows={2}
                            />
                        </div>
                    </div>
                 </div>
            ) : (
                /* --- AI SCAN MODE --- */
                <div className="animate-fade-in flex flex-col items-center justify-center space-y-4">
                    {!photoFile ? (
                        <div className="text-center space-y-4 py-4 w-full">
                             <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto border border-primary/20 shadow-[0_0_15px_rgba(249,115,22,0.3)]">
                                <i className="fas fa-camera text-3xl text-primary"></i>
                             </div>
                             <div>
                                <h3 className="text-white font-bold text-lg">Re-evaluate Body Fat</h3>
                                <p className="text-gray-400 text-xs max-w-xs mx-auto mt-2 leading-relaxed">
                                    Upload a photo to re-evaluate your body fat percentage. 
                                    <br/>The AI uses your height ({profile.height}cm) and weight to increase accuracy.
                                </p>
                             </div>
                             <button 
                                onClick={() => setShowAnalyzer(true)}
                                className="w-full bg-gradient-to-r from-primary to-orange-600 hover:to-orange-500 text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                             >
                                <i className="fas fa-expand-arrows-alt"></i> Start Analysis
                             </button>
                        </div>
                    ) : (
                        // Results View
                        <div className="w-full space-y-4">
                             <div className="flex items-start gap-4 bg-dark/40 p-4 rounded-xl border border-primary/30 relative overflow-hidden">
                                 <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
                                 <img src={photoPreview || ''} alt="Scan" className="w-20 h-20 object-cover rounded-lg border border-gray-600" />
                                 <div className="flex-1">
                                     <div className="text-[10px] text-primary uppercase font-bold mb-1 tracking-wider">AI Analysis Result</div>
                                     <div className="text-4xl font-black text-white flex items-baseline gap-1">
                                        {bodyFat}
                                        <span className="text-sm text-gray-400 font-medium">% BF</span>
                                     </div>
                                     <button onClick={() => { setPhotoFile(null); setBodyFat(''); setPhotoPreview(null); }} className="text-xs text-red-400 hover:text-red-300 mt-2 flex items-center gap-1">
                                        <i className="fas fa-redo"></i> Retake
                                     </button>
                                 </div>
                             </div>

                             <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Confirm Current Weight (kg)</label>
                                    <input 
                                        type="number" 
                                        value={weight} 
                                        onChange={e => setWeight(parseFloat(e.target.value))} 
                                        className="w-full bg-dark border border-gray-600 rounded-xl p-3 text-white focus:border-primary outline-none" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Add Notes</label>
                                    <textarea 
                                        value={notes} 
                                        onChange={e => setNotes(e.target.value)} 
                                        className="w-full bg-dark border border-gray-600 rounded-xl p-3 text-white focus:border-primary outline-none"
                                        placeholder="Scan details..."
                                    />
                                </div>
                             </div>
                        </div>
                    )}
                </div>
            )}

            {/* Common Save Button - Show if Manual OR if Scan is Complete */}
            {(logMode === 'quick' || (logMode === 'scan' && photoFile)) && (
                <button 
                    onClick={handleLog}
                    disabled={loading || regenerating}
                    className="w-full mt-4 bg-white text-black hover:bg-gray-200 font-bold py-4 rounded-xl transition-colors disabled:opacity-50 shadow-lg flex items-center justify-center gap-2"
                >
                    {loading || regenerating ? (
                        <>
                            <i className="fas fa-spinner fa-spin"></i> 
                            {regenerating ? "Updating Profile..." : "Saving Log..."}
                        </>
                    ) : (
                        <><i className="fas fa-save"></i> Save Entry</>
                    )}
                </button>
            )}
        </div>
      </div>

      {/* Analyzer Modal */}
      {showAnalyzer && (
        <BodyFatAnalyzer 
          onClose={() => setShowAnalyzer(false)} 
          onAnalysisComplete={handleAnalysisComplete}
          profile={profile} // Passed full profile for accurate analysis
        />
      )}

      {/* History List */}
      <div className="space-y-4 pt-4">
        <h3 className="text-white font-bold ml-1 text-sm uppercase tracking-wider opacity-70">Recent History</h3>
        {sortedLogs.length === 0 ? (
          <div className="text-gray-500 text-center py-8">No logs yet. Start tracking!</div>
        ) : (
          sortedLogs.map((log, index) => {
            const prevLog = sortedLogs[index + 1];
            return (
              <div key={log.id} className="bg-secondary p-4 rounded-xl border border-gray-700 flex justify-between items-start">
                <div className="flex-1">
                  <div className="text-gray-400 text-xs mb-1">{log.date}</div>
                  <div className="text-white font-bold text-lg flex items-center gap-2">
                    {log.weight} kg
                    {prevLog && getTrendIcon(log.weight, prevLog.weight)}
                  </div>
                  {log.bodyFat && <div className="text-xs text-primary font-bold mt-1">{log.bodyFat}% Body Fat</div>}
                  {log.notes && <div className="text-xs text-gray-500 mt-2 italic border-l-2 border-gray-600 pl-2">"{log.notes}"</div>}
                </div>
                {log.photo_url && (
                  <a href={log.photo_url} target="_blank" rel="noopener noreferrer" className="ml-4 w-14 h-14 bg-dark rounded-lg overflow-hidden border border-gray-600 flex-shrink-0 relative group">
                    <img src={log.photo_url} alt="Progress" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <i className="fas fa-expand text-white text-xs"></i>
                    </div>
                  </a>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ProgressTracker;