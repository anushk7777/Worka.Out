
import React, { useState, useEffect } from 'react';
import { ProgressEntry, UserProfile } from '../types';
import { supabase } from '../services/supabaseClient';
import BodyFatAnalyzer from './BodyFatAnalyzer';
import ComparisonSlider from './ComparisonSlider';
import { generateWorkoutSplit } from '../services/geminiService';
import { calculatePlan } from './Calculator';

interface Props {
  logs: ProgressEntry[];
  onAddLog: (log: ProgressEntry) => void;
  profile: UserProfile; 
  launchScanner?: boolean;
  onScannerLaunched?: () => void;
}

const ProgressTracker: React.FC<Props> = ({ logs, onAddLog, profile, launchScanner, onScannerLaunched }) => {
  const [weight, setWeight] = useState(profile.weight);
  const [bodyFat, setBodyFat] = useState('');
  const [notes, setNotes] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  
  // Data Quality State
  const [weighInType, setWeighInType] = useState<'fasted' | 'random'>('fasted');
  const [flags, setFlags] = useState({
      high_sodium: false,
      high_carb: false,
      alcohol: false
  });

  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [showAnalyzer, setShowAnalyzer] = useState(false);
  
  // Tab State: 'quick', 'scan', 'compare'
  const [logMode, setLogMode] = useState<'quick' | 'scan' | 'compare'>('quick');

  // Comparison State
  const [compareIdx1, setCompareIdx1] = useState<number>(0); // Index in sortedLogs
  const [compareIdx2, setCompareIdx2] = useState<number>(1);

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

  const getTodayISO = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const toggleFlag = (key: keyof typeof flags) => {
      setFlags(prev => ({ ...prev, [key]: !prev[key] }));
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
      // Append flags to notes for persistence without schema migration if columns don't exist yet
      const flagsStr = JSON.stringify({ type: weighInType, flags });
      const finalNotes = notes ? `${notes} || META: ${flagsStr}` : `META: ${flagsStr}`;

      const logData = {
        user_id: user.id,
        date: getTodayISO(), 
        weight: Number(weight),
        body_fat: bodyFat ? Number(bodyFat) : null,
        photo_url: photoUrl,
        notes: finalNotes,
      };
      
      const { data, error } = await supabase
        .from('progress_logs')
        .insert([logData])
        .select()
        .single();

      if (error) throw error;

      // 3. Update local state
      // Parse back the metadata for UI
      const parsedLog: ProgressEntry = {
        id: data.id,
        date: data.date,
        created_at: data.created_at,
        weight: data.weight,
        bodyFat: data.body_fat,
        photo_url: data.photo_url,
        notes: data.notes,
        weigh_in_type: weighInType,
        flags: flags
      };

      onAddLog(parsedLog);

      // --- AUTO-SCALE LOGIC ---
      const weightDiff = Math.abs(weight - profile.weight);
      // We regenerate if diff > 0.5kg OR if adaptive correction might be needed (Fat Loss + Gain)
      const needsCorrection = (profile.goal === 'Fat Loss' && weight > profile.weight + 0.3);
      
      if (weightDiff >= 0.5 || needsCorrection) {
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
      setFlags({ high_sodium: false, high_carb: false, alcohol: false });
      setWeighInType('fasted');

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

        // Recalculate Calories with Adaptive Correction
        const oldWeight = profileData.weight;
        const updatedProfileRaw: UserProfile = { ...profileData, weight: newWeight };
        
        // CALCULATE DAYS SINCE LAST UPDATE FOR NORMALIZATION
        const lastUpdateDate = profileData.updated_at ? new Date(profileData.updated_at) : new Date();
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - lastUpdateDate.getTime());
        const daysSinceLastLog = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)));

        // PASS OLD WEIGHT AND DAYS TO TRIGGER TIME-NORMALIZED ZIG ZAG
        const newMacros = calculatePlan(updatedProfileRaw, oldWeight, daysSinceLastLog);

        await supabase
          .from('profiles')
          .update({ 
              weight: newWeight,
              daily_calories: newMacros.calories,
              weekly_calories: newMacros.calories * 7,
              updated_at: new Date().toISOString() // Update timestamp for next calc
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

        const alertMsg = newMacros.adaptationReason 
            ? `Update: ${newMacros.adaptationReason} New Target: ${newMacros.calories} kcal.`
            : `Progress logged! Profile updated to ${newWeight}kg. New Target: ${newMacros.calories} kcal.`;
            
        alert(alertMsg);
    } catch (err) {
        console.error("Scaling failed:", err);
        alert('Progress logged, but failed to update plan.');
    } finally {
        setRegenerating(false);
    }
  };

  const sortedLogs = [...logs].reverse(); 
  const logsWithPhotos = sortedLogs.filter(l => l.photo_url);

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
                <i className="fas fa-microchip mr-2"></i> Scan
            </button>
            <button 
                onClick={() => setLogMode('compare')}
                className={`flex-1 py-4 text-sm font-bold transition-all ${logMode === 'compare' ? 'bg-secondary text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
                <i className="fas fa-columns mr-2"></i> Compare
            </button>
        </div>

        <div className="p-6">
            {logMode === 'quick' && (
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
                        
                        {/* --- DATA QUALITY AXIS UI --- */}
                        <div className="md:col-span-2 space-y-4 pt-2">
                            {/* Weigh In Type Toggle */}
                            <div className="bg-dark/40 p-3 rounded-xl border border-white/5 flex justify-between items-center">
                                <span className="text-xs text-gray-400 font-bold uppercase tracking-wide">Protocol</span>
                                <div className="flex bg-black p-1 rounded-lg">
                                    <button 
                                        onClick={() => setWeighInType('fasted')}
                                        className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${weighInType === 'fasted' ? 'bg-green-500/20 text-green-400' : 'text-gray-500 hover:text-white'}`}
                                    >
                                        Fasted (AM)
                                    </button>
                                    <button 
                                        onClick={() => setWeighInType('random')}
                                        className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${weighInType === 'random' ? 'bg-yellow-500/20 text-yellow-400' : 'text-gray-500 hover:text-white'}`}
                                    >
                                        Random
                                    </button>
                                </div>
                            </div>

                            {/* Signal Flags */}
                            <div>
                                <label className="block text-xs text-gray-500 mb-2">Context Tags (Reduces Noise)</label>
                                <div className="flex flex-wrap gap-2">
                                    <button 
                                        onClick={() => toggleFlag('high_sodium')}
                                        className={`px-4 py-2 rounded-lg text-[10px] font-bold border transition-all ${flags.high_sodium ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-dark border-white/10 text-gray-500'}`}
                                    >
                                        <i className="fas fa-shaker mr-1.5"></i> High Sodium
                                    </button>
                                    <button 
                                        onClick={() => toggleFlag('high_carb')}
                                        className={`px-4 py-2 rounded-lg text-[10px] font-bold border transition-all ${flags.high_carb ? 'bg-orange-500/20 border-orange-500 text-orange-400' : 'bg-dark border-white/10 text-gray-500'}`}
                                    >
                                        <i className="fas fa-bread-slice mr-1.5"></i> Carb Load
                                    </button>
                                    <button 
                                        onClick={() => toggleFlag('alcohol')}
                                        className={`px-4 py-2 rounded-lg text-[10px] font-bold border transition-all ${flags.alcohol ? 'bg-purple-500/20 border-purple-500 text-purple-400' : 'bg-dark border-white/10 text-gray-500'}`}
                                    >
                                        <i className="fas fa-wine-glass mr-1.5"></i> Alcohol
                                    </button>
                                </div>
                            </div>
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
            )}
            
            {logMode === 'scan' && (
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

            {logMode === 'compare' && (
                /* --- COMPARISON MODE --- */
                <div className="animate-fade-in space-y-6">
                    {logsWithPhotos.length < 2 ? (
                        <div className="text-center py-8 text-gray-400">
                            <i className="fas fa-images text-4xl mb-3 opacity-50"></i>
                            <p>You need at least 2 logs with photos to use comparison mode.</p>
                        </div>
                    ) : (
                        <>
                            <ComparisonSlider 
                                beforeImage={logsWithPhotos[compareIdx2]?.photo_url || ''}
                                afterImage={logsWithPhotos[compareIdx1]?.photo_url || ''}
                                beforeDate={logsWithPhotos[compareIdx2]?.date || 'Old'}
                                afterDate={logsWithPhotos[compareIdx1]?.date || 'New'}
                            />
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-primary font-bold uppercase">Base Photo</label>
                                    <select 
                                        value={compareIdx2}
                                        onChange={(e) => setCompareIdx2(parseInt(e.target.value))}
                                        className="w-full bg-dark border border-gray-600 rounded-lg p-2 text-xs text-white mt-1"
                                    >
                                        {logsWithPhotos.map((l, idx) => (
                                            <option key={l.id} value={idx}>{l.date} ({l.weight}kg)</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-primary font-bold uppercase">Current Photo</label>
                                    <select 
                                        value={compareIdx1}
                                        onChange={(e) => setCompareIdx1(parseInt(e.target.value))}
                                        className="w-full bg-dark border border-gray-600 rounded-lg p-2 text-xs text-white mt-1"
                                    >
                                        {logsWithPhotos.map((l, idx) => (
                                            <option key={l.id} value={idx}>{l.date} ({l.weight}kg)</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Common Save Button - Show if Manual OR if Scan is Complete (NOT in compare mode) */}
            {logMode !== 'compare' && (logMode === 'quick' || (logMode === 'scan' && photoFile)) && (
                <button 
                    onClick={handleLog}
                    disabled={loading || regenerating}
                    className="w-full mt-4 bg-white text-black hover:bg-gray-200 font-bold py-4 rounded-xl transition-colors disabled:opacity-50 shadow-lg flex items-center justify-center gap-2"
                >
                    {loading || regenerating ? (
                        <>
                            <i className="fas fa-spinner fa-spin"></i> 
                            {regenerating ? "Zig-Zag Adapting..." : "Saving Log..."}
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

      {/* History List - Only show if not in compare mode */}
      {logMode !== 'compare' && (
          <div className="space-y-4 pt-4">
            <h3 className="text-white font-bold ml-1 text-sm uppercase tracking-wider opacity-70">Recent History</h3>
            {sortedLogs.length === 0 ? (
              <div className="text-gray-500 text-center py-8">No logs yet. Start tracking!</div>
            ) : (
              sortedLogs.map((log, index) => {
                const prevLog = sortedLogs[index + 1];
                // Extract metadata from notes if possible
                let flags = null;
                let cleanNotes = log.notes;
                if (log.notes && log.notes.includes('META:')) {
                    try {
                        const parts = log.notes.split('META:');
                        cleanNotes = parts[0];
                        flags = JSON.parse(parts[1]);
                    } catch (e) {}
                }

                return (
                  <div key={log.id} className="bg-secondary p-4 rounded-xl border border-gray-700 flex justify-between items-start">
                    <div className="flex-1">
                      <div className="text-gray-400 text-xs mb-1 flex items-center gap-2">
                          {log.date}
                          {flags?.type === 'fasted' && <span className="text-[9px] text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded uppercase font-bold">Fasted</span>}
                          {flags?.type === 'random' && <span className="text-[9px] text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded uppercase font-bold">Random</span>}
                      </div>
                      <div className="text-white font-bold text-lg flex items-center gap-2">
                        {log.weight} kg
                        {prevLog && getTrendIcon(log.weight, prevLog.weight)}
                      </div>
                      {log.bodyFat && <div className="text-xs text-primary font-bold mt-1">{log.bodyFat}% Body Fat</div>}
                      
                      {/* Context Badges */}
                      {flags?.flags && (
                          <div className="flex gap-1 mt-2">
                              {flags.flags.high_sodium && <div className="w-2 h-2 rounded-full bg-blue-500" title="High Sodium"></div>}
                              {flags.flags.high_carb && <div className="w-2 h-2 rounded-full bg-orange-500" title="High Carb"></div>}
                              {flags.flags.alcohol && <div className="w-2 h-2 rounded-full bg-purple-500" title="Alcohol"></div>}
                          </div>
                      )}

                      {cleanNotes && <div className="text-xs text-gray-500 mt-2 italic border-l-2 border-gray-600 pl-2">"{cleanNotes}"</div>}
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
      )}
    </div>
  );
};

export default ProgressTracker;
