
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';

const Auth: React.FC = () => {
  const [bootSequence, setBootSequence] = useState<'init' | 'scanning' | 'ready'>('init');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Boot Sequence Logic
  useEffect(() => {
    const timer1 = setTimeout(() => setBootSequence('scanning'), 800);
    const timer2 = setTimeout(() => setBootSequence('ready'), 2200);
    return () => { clearTimeout(timer1); clearTimeout(timer2); };
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        
        setSuccessMsg('Neural link verification email sent. Awaiting confirmation.');
        setIsLogin(true);
        setPassword('');
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // --- RENDERING STATES ---

  // 1. Initial Boot Screen (Logo Pulse)
  if (bootSequence === 'init') {
      return (
          <div className="flex items-center justify-center min-h-screen bg-dark relative overflow-hidden">
              <div className="absolute inset-0 bg-black z-0"></div>
              <div className="relative z-10 flex flex-col items-center">
                  <div className="w-20 h-20 border-4 border-primary rounded-full animate-ping-slow absolute opacity-20"></div>
                  <i className="fas fa-fingerprint text-6xl text-primary animate-pulse"></i>
                  <p className="mt-8 text-primary font-mono text-xs uppercase tracking-[0.3em] animate-pulse">System Boot...</p>
              </div>
          </div>
      );
  }

  // 2. Scanning Sequence (Radar)
  if (bootSequence === 'scanning') {
      return (
          <div className="flex items-center justify-center min-h-screen bg-dark relative overflow-hidden">
              <div className="absolute inset-0 bg-black z-0"></div>
              {/* Radar Effect */}
              <div className="absolute w-[600px] h-[600px] border border-primary/20 rounded-full animate-[spin_4s_linear_infinite] opacity-30">
                  <div className="w-1/2 h-1/2 bg-gradient-to-br from-transparent to-primary/20 absolute top-0 left-0 rounded-tl-full"></div>
              </div>
              <div className="relative z-10 text-center">
                  <div className="text-4xl font-black text-white mb-2 tracking-tighter">MEALMAN<span className="text-primary">.AI</span></div>
                  <div className="h-1 w-32 bg-gray-800 mx-auto rounded-full overflow-hidden">
                      <div className="h-full bg-primary animate-[shimmer_1.5s_infinite] w-full"></div>
                  </div>
                  <div className="mt-4 font-mono text-[10px] text-green-400">
                      <p>> Establishing Uplink...</p>
                      <p>> Verifying Biometrics...</p>
                      <p>> Protocol: ELITE</p>
                  </div>
              </div>
          </div>
      );
  }

  // 3. Final Login Form (Ready)
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 relative overflow-hidden">
      <div className="absolute inset-0 z-0">
          <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-primary/10 rounded-full blur-[140px] animate-pulse-slow"></div>
          <div className="absolute bottom-[-20%] left-[-10%] w-[70%] h-[70%] bg-blue-900/20 rounded-full blur-[160px]"></div>
      </div>

      <div className="glass-card w-full max-w-sm p-10 rounded-[48px] shadow-[0_40px_100px_rgba(0,0,0,0.8)] relative z-10 animate-scale-in backdrop-blur-3xl border border-white/10 inner-glow gpu">
        <header className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-[28px] bg-gradient-to-tr from-primary to-yellow-500 mb-6 shadow-[0_0_40px_rgba(255,215,0,0.3)] transform rotate-12 border border-white/20">
             <i className="fas fa-shield-heart text-3xl text-black"></i>
          </div>
          <h1 className="text-5xl font-black text-white tracking-tighter mb-2 drop-shadow-lg">
            <span className="text-transparent bg-clip-text bg-gradient-to-br from-white via-gray-200 to-gray-500">MEAL</span>MAN
          </h1>
          <div className="flex items-center justify-center gap-2 opacity-60">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
              <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.4em]">Online</p>
          </div>
        </header>

        {successMsg && (
          <div className="mb-8 glass-liquid border-green-500/40 p-5 rounded-2xl text-green-300 text-xs leading-relaxed animate-fade-in flex gap-4 items-center shadow-[0_0_20px_rgba(34,197,94,0.1)]">
            <i className="fas fa-check-circle text-green-400 text-xl"></i>
            <p className="font-bold">{successMsg}</p>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-6">
          <div className="space-y-2 group">
            <label className="text-[10px] font-black text-gray-500 ml-1 uppercase tracking-[0.2em] group-focus-within:text-primary transition-colors">Neural ID</label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-6 text-white focus:border-primary focus:bg-black/60 focus:shadow-[0_0_20px_rgba(255,215,0,0.1)] outline-none transition-all placeholder-gray-700 text-sm font-bold tracking-wide"
                placeholder="USER.ID"
                required
              />
              <i className="fas fa-fingerprint absolute right-5 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-primary transition-colors"></i>
            </div>
          </div>
          <div className="space-y-2 group">
            <label className="text-[10px] font-black text-gray-500 ml-1 uppercase tracking-[0.2em] group-focus-within:text-primary transition-colors">Security Key</label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-6 text-white focus:border-primary focus:bg-black/60 focus:shadow-[0_0_20px_rgba(255,215,0,0.1)] outline-none transition-all placeholder-gray-700 text-sm font-bold tracking-widest"
                placeholder="••••••••"
                required
              />
              <i className="fas fa-key absolute right-5 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-primary transition-colors"></i>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl text-red-400 text-[10px] font-black uppercase tracking-widest text-center shadow-[0_0_20px_rgba(239,68,68,0.2)]">
              <i className="fas fa-exclamation-triangle mr-2"></i> Access Denied: {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-dark font-black py-5 rounded-2xl shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:shadow-[0_0_60px_rgba(255,255,255,0.4)] active:scale-95 disabled:opacity-50 transition-all text-xs uppercase tracking-[0.2em] mt-4 relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-200 to-transparent -translate-x-full group-hover:animate-shimmer opacity-50"></div>
            <span className="relative z-10 flex items-center justify-center gap-3">
                {loading ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-bolt"></i>}
                {isLogin ? 'Initialize Uplink' : 'Register Bio-Data'}
            </span>
          </button>
        </form>

        <footer className="mt-10 text-center">
          <button
            onClick={() => { setIsLogin(!isLogin); setSuccessMsg(null); setError(null); }}
            className="text-[10px] text-gray-500 hover:text-white transition-colors font-black uppercase tracking-[0.2em]"
          >
            {isLogin ? "No ID? " : "Has ID? "}
            <span className="text-primary hover:underline decoration-primary underline-offset-4">
              {isLogin ? 'Create Protocol' : 'Authorize'}
            </span>
          </button>
        </footer>
      </div>
    </div>
  );
};

export default Auth;
