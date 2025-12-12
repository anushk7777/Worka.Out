import React, { useState, useRef } from 'react';
import { analyzeBodyComposition } from '../services/geminiService';
import { UserProfile } from '../types';

interface Props {
  onAnalysisComplete: (percentage: number, imageFile: File) => void;
  onClose: () => void;
  profile: Partial<UserProfile>;
}

const BodyFatAnalyzer: React.FC<Props> = ({ onAnalysisComplete, onClose, profile }) => {
  // State for Front Image
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [frontFile, setFrontFile] = useState<File | null>(null);
  
  // State for Back Image
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);

  const [activeTab, setActiveTab] = useState<'front' | 'back'>('front');
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Refs
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, view: 'front' | 'back') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (view === 'front') {
            setFrontFile(file);
            setFrontPreview(reader.result as string);
        } else {
            setBackFile(file);
            setBackPreview(reader.result as string);
        }
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!frontPreview) {
        setError("Front view is required for analysis.");
        return;
    }
    
    setAnalyzing(true);
    setError(null);

    try {
      // Pass both images to the service
      const result = await analyzeBodyComposition(frontPreview, backPreview, profile);
      
      // Pass the Front file as the primary one for storage (MVP constraint)
      if (frontFile) {
        onAnalysisComplete(result.percentage, frontFile);
      }
      
      alert(`Dual-Scan Analysis Complete\n\nEstimated BF: ${result.percentage}%\n\nAnalysis: ${result.reasoning}`);
      onClose();
    } catch (err) {
      console.error(err);
      setError("Analysis failed. Please ensure photos are clear.");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-secondary border border-gray-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-dark/50">
          <h3 className="text-white font-bold flex items-center">
            <i className="fas fa-layer-group text-primary mr-2"></i> Dual-Angle Body Scan
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
            {/* View Toggle Tabs */}
            <div className="flex bg-dark/50 p-1 rounded-xl mb-4 border border-white/5">
                <button 
                    onClick={() => setActiveTab('front')}
                    className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${activeTab === 'front' ? 'bg-primary text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
                >
                    <i className="fas fa-user mr-1"></i> Front View
                </button>
                <button 
                    onClick={() => setActiveTab('back')}
                    className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${activeTab === 'back' ? 'bg-primary text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
                >
                    <i className="fas fa-user-alt mr-1"></i> Back View
                </button>
            </div>

            {/* Front View Uploader */}
            <div className={`${activeTab === 'front' ? 'block' : 'hidden'} animate-fade-in`}>
                <div className="bg-blue-500/10 border border-blue-500/30 p-3 rounded-lg mb-4 flex items-start gap-3">
                    <i className="fas fa-info-circle text-blue-400 mt-1"></i>
                    <p className="text-xs text-blue-200">
                        <strong className="block text-blue-400 mb-1">Step 1: Front Assessment</strong>
                        Capture torso clearly. Hands relaxed at sides. Good lighting is critical for analyzing abdominal definition.
                    </p>
                </div>

                {!frontPreview ? (
                    <div 
                    onClick={() => frontInputRef.current?.click()}
                    className="w-full h-64 border-2 border-dashed border-gray-600 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-dark/50 transition-colors group"
                    >
                        <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center group-hover:scale-110 transition-transform mb-3 border border-gray-600">
                            <i className="fas fa-camera text-2xl text-primary"></i>
                        </div>
                        <p className="text-white font-bold text-sm">Upload Front Photo</p>
                        <p className="text-gray-500 text-xs mt-1">Tap to select</p>
                    </div>
                ) : (
                    <div className="relative w-full h-64 rounded-xl overflow-hidden bg-black border border-white/10">
                        <img src={frontPreview} alt="Front Preview" className="w-full h-full object-contain" />
                        <button 
                            onClick={() => { setFrontPreview(null); setFrontFile(null); }}
                            className="absolute top-2 right-2 bg-black/60 text-white w-8 h-8 rounded-full hover:bg-red-500 flex items-center justify-center backdrop-blur-sm border border-white/20 transition-colors"
                        >
                            <i className="fas fa-trash text-xs"></i>
                        </button>
                        <div className="absolute bottom-2 left-2 bg-black/60 text-primary text-xs px-2 py-1 rounded backdrop-blur-sm border border-primary/30">
                            <i className="fas fa-check-circle mr-1"></i> Front Ready
                        </div>
                    </div>
                )}
            </div>

            {/* Back View Uploader */}
            <div className={`${activeTab === 'back' ? 'block' : 'hidden'} animate-fade-in`}>
                 <div className="bg-orange-500/10 border border-orange-500/30 p-3 rounded-lg mb-4 flex items-start gap-3">
                    <i className="fas fa-info-circle text-orange-400 mt-1"></i>
                    <p className="text-xs text-orange-200">
                        <strong className="block text-orange-400 mb-1">Step 2: Posterior Assessment (Optional)</strong>
                        Turn around. Capture back, trap, and glute definition. This helps the AI confirm muscle mass vs. fat.
                    </p>
                </div>

                {!backPreview ? (
                    <div 
                    onClick={() => backInputRef.current?.click()}
                    className="w-full h-64 border-2 border-dashed border-gray-600 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-dark/50 transition-colors group"
                    >
                        <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center group-hover:scale-110 transition-transform mb-3 border border-gray-600">
                             <i className="fas fa-undo text-2xl text-gray-400 group-hover:text-white"></i>
                        </div>
                        <p className="text-white font-bold text-sm">Upload Back Photo</p>
                        <p className="text-gray-500 text-xs mt-1">Optional but Recommended</p>
                    </div>
                ) : (
                    <div className="relative w-full h-64 rounded-xl overflow-hidden bg-black border border-white/10">
                        <img src={backPreview} alt="Back Preview" className="w-full h-full object-contain" />
                        <button 
                            onClick={() => { setBackPreview(null); setBackFile(null); }}
                            className="absolute top-2 right-2 bg-black/60 text-white w-8 h-8 rounded-full hover:bg-red-500 flex items-center justify-center backdrop-blur-sm border border-white/20 transition-colors"
                        >
                            <i className="fas fa-trash text-xs"></i>
                        </button>
                        <div className="absolute bottom-2 left-2 bg-black/60 text-primary text-xs px-2 py-1 rounded backdrop-blur-sm border border-primary/30">
                            <i className="fas fa-check-circle mr-1"></i> Back Ready
                        </div>
                    </div>
                )}
            </div>

            {/* Hidden Inputs */}
            <input type="file" ref={frontInputRef} onChange={(e) => handleFileChange(e, 'front')} accept="image/*" className="hidden" />
            <input type="file" ref={backInputRef} onChange={(e) => handleFileChange(e, 'back')} accept="image/*" className="hidden" />
            
            {error && <p className="text-red-400 text-xs mt-4 text-center bg-red-500/10 p-2 rounded border border-red-500/20">{error}</p>}

            {/* Analysis Section */}
            <div className="mt-6 space-y-3">
                <div className="flex justify-between items-center text-xs text-gray-500 px-1">
                    <span>
                        Status: <span className={frontPreview && backPreview ? "text-green-400" : frontPreview ? "text-yellow-400" : "text-gray-400"}>
                            {frontPreview && backPreview ? "Dual View Ready" : frontPreview ? "Single View Ready" : "Awaiting Photos"}
                        </span>
                    </span>
                    <span>{profile.gender || 'User'}, {profile.weight}kg</span>
                </div>

                <button
                    onClick={handleAnalyze}
                    disabled={!frontPreview || analyzing}
                    className="w-full bg-gradient-to-r from-primary to-orange-600 hover:to-orange-500 text-white font-bold py-4 rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center relative overflow-hidden group"
                >
                    {analyzing ? (
                        <>
                            <div className="absolute inset-0 bg-white/10 animate-pulse"></div>
                            <i className="fas fa-circle-notch fa-spin mr-2"></i> 
                            <span className="animate-pulse">Cross-referencing Anatomical Models...</span>
                        </>
                    ) : (
                        <>
                             <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                             <i className="fas fa-dna mr-2"></i> Run AI Average Analysis
                        </>
                    )}
                </button>
                <p className="text-[10px] text-center text-gray-500 leading-tight">
                    *The AI will compare your visual markers against standard anatomical datasets (HuggingFace/DEXA references) and calculate a weighted average of both views.
                </p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default BodyFatAnalyzer;