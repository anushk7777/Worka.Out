
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { analyzeBodyComposition } from '../services/geminiService';
import { UserProfile } from '../types';

interface Props {
  onAnalysisComplete: (percentage: number, imageFile: File) => void;
  onClose: () => void;
  profile: Partial<UserProfile>;
}

const BodyFatAnalyzer: React.FC<Props> = ({ onAnalysisComplete, onClose, profile }) => {
  const [viewState, setViewState] = useState<'capture' | 'processing' | 'result' | 'error'>('capture');
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<{ percentage: number; reasoning: string } | null>(null);
  const frontInputRef = useRef<HTMLInputElement>(null);

  // Simple flashing text for processing
  const [scanningText, setScanningText] = useState("Initializing Gemini 3.0 Pro...");

  useEffect(() => {
    if (viewState === 'processing') {
      const texts = [
        "High-Res Anthropometric Mapping...",
        "Identifying Serratus & Abdominal Landmarks...",
        "Calculating Subcutaneous Adipose Density...",
        "Cross-Referencing DEXA Benchmarks...",
        "Finalizing Clinical Report..."
      ];
      let i = 0;
      const interval = setInterval(() => {
        setScanningText(texts[i % texts.length]);
        i++;
      }, 1000); // Slower updates to feel more "heavy"
      return () => clearInterval(interval);
    }
  }, [viewState]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFrontFile(file);
        setFrontPreview(reader.result as string);
        setErrorMsg(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!frontPreview) return;
    setViewState('processing');
    
    try {
      // Minimum delay for UX feels - Deep thinking takes time
      await new Promise(r => setTimeout(r, 3000));
      
      const analysis = await analyzeBodyComposition(frontPreview, null, profile);

      if (!analysis.valid || analysis.percentage === undefined) {
          // STRICT VALIDATION REJECTION
          setErrorMsg(analysis.reasoning || "Invalid biometric data. High-precision mode requires a clear, well-lit torso image.");
          setViewState('error');
      } else {
          setResult({ percentage: analysis.percentage, reasoning: analysis.reasoning });
          setViewState('result');
      }
    } catch (err) {
      setErrorMsg("Neural engine overload. Please ensure high-quality connection and try again.");
      setViewState('error');
    }
  };

  const handleSave = () => {
    if (result && frontFile) {
      onAnalysisComplete(result.percentage, frontFile);
      onClose();
    }
  };

  const content = (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-[9999] animate-fade-in font-sans">
      <div className="relative w-full max-w-md h-full md:h-auto md:max-h-[90vh] bg-neutral-900 md:rounded-3xl flex flex-col overflow-hidden shadow-2xl border border-white/10">
        
        {/* Header */}
        <div className="h-16 flex justify-between items-center px-6 border-b border-white/5 bg-neutral-900 z-10">
            <span className="text-white font-black uppercase tracking-widest text-xs flex items-center gap-2">
                <i className="fas fa-bullseye text-red-500"></i> Gemini 3.0 Pro Vision
            </span>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white">
                <i className="fas fa-times"></i>
            </button>
        </div>

        {/* --- STATE: CAPTURE --- */}
        {viewState === 'capture' && (
            <div className="flex-1 flex flex-col">
                <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
                    {frontPreview ? (
                        <img src={frontPreview} className="w-full h-full object-contain" alt="Subject" />
                    ) : (
                        <div className="text-center opacity-40">
                            <i className="fas fa-cloud-upload-alt text-6xl mb-4"></i>
                            <p className="uppercase tracking-widest text-xs font-bold">Upload High-Res Torso Scan</p>
                        </div>
                    )}
                    <input type="file" ref={frontInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                    <div className="absolute inset-0 z-10" onClick={() => frontInputRef.current?.click()}></div>
                </div>
                <div className="p-6 bg-neutral-900 border-t border-white/5">
                    <button 
                        onClick={handleAnalyze} 
                        disabled={!frontPreview}
                        className="w-full bg-white text-black font-black py-4 rounded-xl uppercase tracking-[0.2em] text-xs disabled:opacity-50"
                    >
                        {frontPreview ? "Initiate Deep Scan" : "Select Image"}
                    </button>
                </div>
            </div>
        )}

        {/* --- STATE: PROCESSING --- */}
        {viewState === 'processing' && (
            <div className="flex-1 flex flex-col items-center justify-center bg-black p-8 relative">
                 <div className="w-full h-1 bg-gray-800 absolute top-0">
                     <div className="h-full bg-red-500 animate-[shimmer_1.5s_infinite] w-1/3"></div>
                 </div>
                 <div className="w-24 h-24 border-4 border-white/10 border-t-red-500 rounded-full animate-spin mb-8"></div>
                 <h3 className="text-white font-black uppercase tracking-widest text-center animate-pulse">{scanningText}</h3>
                 <p className="text-[10px] text-gray-500 mt-4 uppercase tracking-[0.1em]">Thinking Budget: 16k Tokens Active</p>
            </div>
        )}

        {/* --- STATE: ERROR (INVALID IMAGE) --- */}
        {viewState === 'error' && (
            <div className="flex-1 flex flex-col items-center justify-center bg-neutral-900 p-8 text-center">
                 <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20">
                     <i className="fas fa-hand-paper text-3xl text-red-500"></i>
                 </div>
                 <h3 className="text-white font-black text-xl mb-2">Scan Rejected</h3>
                 <p className="text-gray-400 text-sm leading-relaxed mb-8 max-w-[250px]">
                     {errorMsg}
                 </p>
                 <button 
                    onClick={() => setViewState('capture')}
                    className="bg-white/5 hover:bg-white/10 text-white font-bold py-3 px-8 rounded-lg border border-white/10 transition-all uppercase text-xs tracking-wider"
                 >
                     Retry Scan
                 </button>
            </div>
        )}

        {/* --- STATE: RESULT --- */}
        {viewState === 'result' && result && (
            <div className="flex-1 flex flex-col bg-neutral-900">
                <div className="flex-1 flex flex-col items-center justify-center p-8">
                    <p className="text-gray-500 text-[10px] uppercase font-bold tracking-[0.3em] mb-4">Biometric Result</p>
                    <div className="text-8xl font-black text-white tracking-tighter mb-2">
                        {result.percentage}<span className="text-2xl text-red-500">%</span>
                    </div>
                    
                    {/* Visual Scale */}
                    <div className="w-full max-w-xs mt-8 mb-8">
                        <div className="flex justify-between text-[9px] text-gray-500 uppercase font-bold mb-2">
                            <span>Athletic</span>
                            <span>Fit</span>
                            <span>Average</span>
                            <span>High</span>
                        </div>
                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden relative">
                             {/* Gradient Bar */}
                             <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 opacity-30"></div>
                             {/* Indicator */}
                             <div 
                                className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_10px_white]"
                                style={{ left: `${Math.min(100, Math.max(0, (result.percentage - 5) * 2.5))}%` }} 
                             ></div>
                        </div>
                    </div>

                    <div className="bg-black/40 p-6 rounded-2xl border border-white/5 w-full">
                        <div className="flex items-center gap-3 mb-2">
                            <i className="fas fa-microscope text-primary text-xs"></i>
                            <span className="text-[10px] text-primary font-bold uppercase tracking-widest">Clinical Observation</span>
                        </div>
                        <p className="text-gray-300 text-sm leading-relaxed italic">
                            "{result.reasoning}"
                        </p>
                    </div>
                </div>

                <div className="p-6 border-t border-white/5">
                    <button 
                        onClick={handleSave}
                        className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-xl uppercase tracking-widest text-xs shadow-lg shadow-red-500/20"
                    >
                        Save Clinical Data
                    </button>
                    <button onClick={() => setViewState('capture')} className="w-full mt-3 text-gray-500 hover:text-white text-xs font-bold py-3 uppercase tracking-wider">
                        Discard & Retake
                    </button>
                </div>
            </div>
        )}

      </div>
    </div>
  );
  return createPortal(content, document.body);
};

export default BodyFatAnalyzer;
