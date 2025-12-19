
import React, { useState, useRef, useEffect } from 'react';
import { analyzeBodyComposition } from '../services/geminiService';
import { UserProfile } from '../types';

interface Props {
  onAnalysisComplete: (percentage: number, imageFile: File) => void;
  onClose: () => void;
  profile: Partial<UserProfile>;
}

// Particle System for Fireworks
const FireworksCanvas = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = canvas.parentElement?.clientWidth || 300;
        canvas.height = canvas.parentElement?.clientHeight || 300;

        const particles: any[] = [];
        const colors = ['#FFD700', '#FFA500', '#FFFFFF', '#38BDF8'];

        const createParticle = (x: number, y: number) => {
            const count = 30;
            for (let i = 0; i < count; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 5 + 2;
                particles.push({
                    x, y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    alpha: 1,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    size: Math.random() * 3 + 1
                });
            }
        };

        // Initial burst
        createParticle(canvas.width / 2, canvas.height / 2);

        const animate = () => {
            if (!ctx) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.1; // gravity
                p.alpha -= 0.02;
                
                ctx.globalAlpha = p.alpha;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();

                if (p.alpha <= 0) {
                    particles.splice(i, 1);
                    i--;
                }
            }
            if (particles.length > 0) requestAnimationFrame(animate);
        };
        animate();
    }, []);

    return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-50" />;
};

const BodyFatAnalyzer: React.FC<Props> = ({ onAnalysisComplete, onClose, profile }) => {
  // UI States: 'capture' -> 'analyzing' -> 'result'
  const [viewState, setViewState] = useState<'capture' | 'analyzing' | 'result'>('capture');
  
  // Data States
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  
  const [activeTab, setActiveTab] = useState<'front' | 'back'>('front');
  const [error, setError] = useState<string | null>(null);
  
  // Result States
  const [finalResult, setFinalResult] = useState<{ percentage: number; reasoning: string } | null>(null);
  const [displayPercentage, setDisplayPercentage] = useState(0);

  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  // Loading Animation Texts
  const [loadingText, setLoadingText] = useState("Initializing Neural Uplink...");
  useEffect(() => {
      if (viewState === 'analyzing') {
          const texts = [
              "Mapping Skeletal Landmarks...",
              "Calculating Subcutaneous Density...",
              "Analyzing Muscle Insertion Points...",
              "Cross-referencing DEXA Datasets...",
              "Finalizing Biometric Model..."
          ];
          let i = 0;
          const interval = setInterval(() => {
              setLoadingText(texts[i % texts.length]);
              i++;
          }, 1200);
          return () => clearInterval(interval);
      }
  }, [viewState]);

  // Percentage Counter Animation
  useEffect(() => {
      if (viewState === 'result' && finalResult) {
          let start = 0;
          const end = finalResult.percentage;
          const duration = 1500;
          const startTime = performance.now();

          const animateCount = (currentTime: number) => {
              const elapsed = currentTime - startTime;
              const progress = Math.min(elapsed / duration, 1);
              // Ease out quart
              const ease = 1 - Math.pow(1 - progress, 4);
              
              setDisplayPercentage(Number((start + (end - start) * ease).toFixed(1)));

              if (progress < 1) {
                  requestAnimationFrame(animateCount);
              }
          };
          requestAnimationFrame(animateCount);
      }
  }, [viewState, finalResult]);

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
        setError("Front scan data required.");
        return;
    }
    
    setViewState('analyzing');
    setError(null);

    try {
      // Simulate minimum 3s processing time for "wow" effect
      const minTimePromise = new Promise(resolve => setTimeout(resolve, 3000));
      const analysisPromise = analyzeBodyComposition(frontPreview, backPreview, profile);
      
      const [_, result] = await Promise.all([minTimePromise, analysisPromise]);
      
      setFinalResult(result);
      setViewState('result');
    } catch (err) {
      console.error(err);
      setError("Analysis corrupted. Sensors blocked or lighting insufficient.");
      setViewState('capture');
    }
  };

  const handleSave = () => {
      if (finalResult && frontFile) {
          onAnalysisComplete(finalResult.percentage, frontFile);
          onClose();
      }
  };

  return (
    <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[100] backdrop-blur-xl animate-fade-in overflow-hidden">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-20%] left-[-20%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[100px] animate-pulse-slow"></div>
          <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse-slow"></div>
      </div>

      <div className="relative w-full max-w-md h-[100dvh] md:h-auto md:max-h-[85vh] md:aspect-[9/16] bg-black/40 border border-white/10 md:rounded-3xl flex flex-col overflow-hidden shadow-2xl">
        
        {/* --- HEADER --- */}
        <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-30 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
            <div>
                <h2 className="text-white font-black uppercase tracking-[0.2em] text-sm flex items-center gap-2">
                    <i className="fas fa-satellite-dish text-primary animate-pulse"></i>
                    Bio-Scan Module
                </h2>
                <p className="text-[10px] text-gray-400 font-mono mt-1">v.3.1.0 // ACTIVE</p>
            </div>
            <button onClick={onClose} className="pointer-events-auto w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-red-500/20 transition-all">
                <i className="fas fa-times"></i>
            </button>
        </div>

        {/* --- VIEW: CAPTURE --- */}
        {viewState === 'capture' && (
            <div className="flex-1 flex flex-col relative animate-fade-in">
                {/* Viewport Area */}
                <div className="flex-1 relative bg-gray-900 overflow-hidden group">
                    
                    {/* Active Image Layer */}
                    <div className="absolute inset-0 z-10 flex items-center justify-center">
                        {(activeTab === 'front' ? frontPreview : backPreview) ? (
                            <img 
                                src={(activeTab === 'front' ? frontPreview : backPreview) as string} 
                                className="w-full h-full object-cover opacity-80" 
                                alt="Scan Target" 
                            />
                        ) : (
                            <div className="text-center opacity-40">
                                <i className="fas fa-crosshairs text-6xl text-white/20 mb-4"></i>
                                <p className="text-[10px] font-mono uppercase tracking-widest text-white">No Signal</p>
                            </div>
                        )}
                    </div>

                    {/* Augmented Reality Overlay (HUD) */}
                    <div className="absolute inset-0 z-20 pointer-events-none">
                        {/* Corners */}
                        <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-primary/50"></div>
                        <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-primary/50"></div>
                        <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-primary/50"></div>
                        <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-primary/50"></div>
                        
                        {/* Body Guide Outline (SVG) */}
                        <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 100 200" preserveAspectRatio="none">
                            <path d="M50 20 C 55 20, 60 25, 60 35 C 60 40, 75 45, 80 55 L 80 120 L 70 190 L 30 190 L 20 120 L 20 55 C 25 45, 40 40, 40 35 C 40 25, 45 20, 50 20" 
                                fill="none" stroke="white" strokeWidth="0.5" strokeDasharray="2 2" />
                            <line x1="0" y1="100" x2="100" y2="100" stroke="cyan" strokeWidth="0.2" opacity="0.5" />
                            <line x1="50" y1="0" x2="50" y2="200" stroke="cyan" strokeWidth="0.2" opacity="0.5" />
                        </svg>

                        {/* Scanning Laser Beam - Only if image present */}
                        {(activeTab === 'front' ? frontPreview : backPreview) && (
                            <div className="absolute left-0 right-0 h-1 bg-cyan-400 shadow-[0_0_20px_cyan] animate-scan-beam opacity-80"></div>
                        )}
                    </div>

                    {/* Click Trigger for File Input */}
                    <div 
                        onClick={() => activeTab === 'front' ? frontInputRef.current?.click() : backInputRef.current?.click()}
                        className="absolute inset-0 z-30 cursor-pointer"
                    ></div>
                </div>

                {/* Control Deck */}
                <div className="bg-black/80 backdrop-blur-xl border-t border-white/10 p-6 pb-8 space-y-6 relative z-40">
                    
                    {/* View Toggles */}
                    <div className="flex justify-center gap-8">
                        <button 
                            onClick={() => setActiveTab('front')}
                            className={`flex flex-col items-center gap-2 transition-all ${activeTab === 'front' ? 'text-primary scale-110' : 'text-gray-500 hover:text-white'}`}
                        >
                            <div className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center ${activeTab === 'front' ? 'border-primary bg-primary/10 shadow-[0_0_15px_rgba(255,215,0,0.3)]' : 'border-white/10 bg-white/5'}`}>
                                <i className="fas fa-user-circle text-2xl"></i>
                            </div>
                            <span className="text-[9px] font-black uppercase tracking-widest">Front</span>
                        </button>
                        
                        <div className="w-px h-12 bg-white/10 self-center"></div>

                        <button 
                            onClick={() => setActiveTab('back')}
                            className={`flex flex-col items-center gap-2 transition-all ${activeTab === 'back' ? 'text-primary scale-110' : 'text-gray-500 hover:text-white'}`}
                        >
                            <div className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center ${activeTab === 'back' ? 'border-primary bg-primary/10 shadow-[0_0_15px_rgba(255,215,0,0.3)]' : 'border-white/10 bg-white/5'}`}>
                                <i className="fas fa-user text-2xl"></i>
                            </div>
                            <span className="text-[9px] font-black uppercase tracking-widest">Back</span>
                        </button>
                    </div>

                    {/* Status Text */}
                    <div className="text-center h-4">
                        {error ? (
                            <p className="text-red-400 text-[10px] font-bold uppercase animate-pulse">{error}</p>
                        ) : (
                            <p className="text-cyan-400 text-[10px] font-mono uppercase tracking-widest">
                                {frontPreview && backPreview ? ">> DATA LOCK: READY <<" : frontPreview ? ">> FRONT VIEW ACQUIRED <<" : ">> AWAITING INPUT <<"}
                            </p>
                        )}
                    </div>

                    {/* Main Action */}
                    <button 
                        onClick={handleAnalyze}
                        disabled={!frontPreview}
                        className="w-full bg-white text-black font-black py-5 rounded-2xl uppercase tracking-[0.3em] text-xs shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:shadow-[0_0_50px_rgba(255,255,255,0.4)] transition-all active:scale-95 disabled:opacity-30 disabled:shadow-none relative overflow-hidden group"
                    >
                        <span className="relative z-10 flex items-center justify-center gap-3">
                            <i className="fas fa-fingerprint"></i> Initiate Analysis
                        </span>
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-300 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] opacity-50"></div>
                    </button>
                </div>
            </div>
        )}

        {/* --- VIEW: ANALYZING (3D LOADER) --- */}
        {viewState === 'analyzing' && (
            <div className="flex-1 flex flex-col items-center justify-center relative bg-black animate-fade-in">
                
                {/* 3D Scene */}
                <div className="scene-3d mb-12 animate-rotate-3d">
                    <div className="cube-3d">
                        <div className="face-3d face-front"><i className="fas fa-dna text-3xl"></i></div>
                        <div className="face-3d face-back"><i className="fas fa-bone text-3xl"></i></div>
                        <div className="face-3d face-right"><i className="fas fa-microchip text-3xl"></i></div>
                        <div className="face-3d face-left"><i className="fas fa-heartbeat text-3xl"></i></div>
                        <div className="face-3d face-top"><i className="fas fa-brain text-3xl"></i></div>
                        <div className="face-3d face-bottom"><i className="fas fa-atom text-3xl"></i></div>
                    </div>
                </div>

                {/* Progress Text */}
                <div className="text-center space-y-2 z-10">
                    <p className="text-primary font-black text-2xl animate-pulse">PROCESSING</p>
                    <div className="h-1 w-48 bg-gray-800 rounded-full mx-auto overflow-hidden">
                        <div className="h-full bg-primary animate-[shimmer_2s_infinite] w-full"></div>
                    </div>
                    <p className="text-cyan-400 font-mono text-[10px] uppercase tracking-widest mt-4">
                        {loadingText}
                    </p>
                </div>

                {/* Background Grid */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px] perspective-[500px] rotate-x-[60deg] pointer-events-none opacity-20"></div>
            </div>
        )}

        {/* --- VIEW: RESULT --- */}
        {viewState === 'result' && (
            <div className="flex-1 flex flex-col relative bg-gradient-to-b from-gray-900 to-black animate-scale-in">
                <FireworksCanvas />
                
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative z-10">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-green-400 to-blue-500 p-1 mb-8 shadow-[0_0_50px_rgba(74,222,128,0.4)] animate-bounce-in">
                        <div className="w-full h-full rounded-full bg-black flex items-center justify-center">
                            <i className="fas fa-check text-4xl text-green-400"></i>
                        </div>
                    </div>

                    <h3 className="text-gray-400 font-bold uppercase tracking-[0.4em] text-xs mb-2">Estimated Composition</h3>
                    
                    <div className="flex items-baseline justify-center gap-2 mb-8">
                        <span className="text-8xl font-black text-white tracking-tighter tabular-nums drop-shadow-2xl">
                            {displayPercentage}
                        </span>
                        <span className="text-2xl text-primary font-bold">%</span>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 w-full backdrop-blur-md">
                        <p className="text-xs text-gray-300 leading-relaxed font-medium italic">
                            "{finalResult?.reasoning}"
                        </p>
                    </div>
                </div>

                <div className="p-6 bg-black/50 border-t border-white/10 relative z-20">
                    <button 
                        onClick={handleSave}
                        className="w-full bg-green-500 hover:bg-green-400 text-black font-black py-5 rounded-2xl uppercase tracking-[0.3em] text-xs shadow-[0_0_30px_rgba(74,222,128,0.3)] transition-all active:scale-95 flex items-center justify-center gap-3"
                    >
                        <i className="fas fa-save"></i> Save to Profile
                    </button>
                    <button 
                        onClick={() => setViewState('capture')}
                        className="w-full mt-3 text-gray-500 text-[10px] uppercase font-bold tracking-widest hover:text-white py-2"
                    >
                        Discard & Retake
                    </button>
                </div>
            </div>
        )}

        {/* Hidden File Inputs */}
        <input type="file" ref={frontInputRef} onChange={(e) => handleFileChange(e, 'front')} accept="image/*" className="hidden" />
        <input type="file" ref={backInputRef} onChange={(e) => handleFileChange(e, 'back')} accept="image/*" className="hidden" />

      </div>
    </div>
  );
};

export default BodyFatAnalyzer;
