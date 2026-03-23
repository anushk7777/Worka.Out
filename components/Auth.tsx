
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  onGuestLogin?: () => void;
}

const Auth: React.FC<Props> = ({ onGuestLogin }) => {
  const [bootSequence, setBootSequence] = useState<'init' | 'scanning' | 'ready'>('init');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    // Technical instructions for the fresh project
    console.log("%c[SYSTEM] Fresh OAuth Configuration Required:", "color: #FFD700; font-weight: bold; font-size: 12px;");
    console.log("1. Google Origin: https://zjolmyhiincfpjojetov.supabase.co");
    console.log("2. Google Redirect: https://zjolmyhiincfpjojetov.supabase.co/auth/v1/callback");
    
    const timer1 = setTimeout(() => setBootSequence('scanning'), 800);
    const timer2 = setTimeout(() => setBootSequence('ready'), 2200);
    return () => { clearTimeout(timer1); clearTimeout(timer2); };
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin, 
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      if (error) throw error;
    } catch (error: any) {
      console.error("Auth Exception:", error);
      setError(error.message);
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (!email.includes('@') || password.length < 6) {
        throw new Error("Neural ID invalid. Minimum 6 character security key required.");
      }

      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin }
        });
        if (error) throw error;
        if (data?.user && !data.session) {
            setSuccessMsg('Signal sent to mailbox. Verify and re-authorize.');
            setIsLogin(true);
        }
      }
    } catch (error: any) {
      setError(error.message || "Uplink failed.");
    } finally {
      setLoading(false);
    }
  };

  if (bootSequence === 'init') {
      return (
          <div className="flex items-center justify-center min-h-screen bg-dark relative overflow-hidden">
              <div className="absolute inset-0 bg-black z-0"></div>
              <div className="relative z-10 flex flex-col items-center">
                  <div className="w-20 h-20 border-4 border-primary rounded-full animate-ping-slow absolute opacity-20"></div>
                  <i className="fas fa-fingerprint text-6xl text-primary animate-pulse"></i>
                  <p className="mt-8 text-primary font-mono text-xs uppercase tracking-[0.3em] animate-pulse">Initializing AI Core...</p>
              </div>
          </div>
      );
  }

  if (bootSequence === 'scanning') {
      return (
          <div className="flex items-center justify-center min-h-screen bg-dark relative overflow-hidden">
              <div className="absolute inset-0 bg-black z-0"></div>
              <div className="absolute w-[600px] h-[600px] border border-primary/20 rounded-full animate-[spin_4s_linear_infinite] opacity-30">
                  <div className="w-1/2 h-1/2 bg-gradient-to-br from-transparent to-primary/20 absolute top-0 left-0 rounded-tl-full"></div>
              </div>
              <div className="relative z-10 text-center">
                  <div className="text-4xl font-black text-white mb-2 tracking-tighter">MEALMAN<span className="text-primary">.AI</span></div>
                  <div className="h-1 w-32 bg-gray-800 mx-auto rounded-full overflow-hidden">
                      <div className="h-full bg-primary animate-[shimmer_1.5s_infinite] w-full"></div>
                  </div>
                  <div className="mt-4 font-mono text-[10px] text-green-400">
                      <p>&gt; Protocol: MASTER_TRAINER</p>
                      <p>&gt; Status: Awaiting Neural Auth</p>
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 relative overflow-hidden bg-dark">
      <div className="absolute inset-0 z-0">
          <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-primary/10 rounded-full blur-[60px] animate-pulse-slow transform-gpu"></div>
          <div className="absolute bottom-[-20%] left-[-10%] w-[70%] h-[70%] bg-blue-900/20 rounded-full blur-[80px] transform-gpu"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="glass-premium w-full max-w-sm p-10 rounded-[48px] shadow-[0_40px_100px_rgba(0,0,0,0.8)] relative z-10 backdrop-blur-xl border border-white/10 inner-glow gpu transform-gpu"
      >
        <header className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-[28px] bg-gradient-to-tr from-primary to-yellow-500 mb-6 shadow-[0_0_40px_rgba(255,215,0,0.3)] transform rotate-12 border border-white/20 animate-float">
             <i className="fas fa-shield-heart text-3xl text-black"></i>
          </div>
          <h1 className="text-5xl font-black text-white tracking-tighter mb-2 drop-shadow-lg leading-none uppercase">
            Meal<span className="text-primary">Man</span>
          </h1>
          <div className="flex items-center justify-center gap-2 opacity-60">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
              <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.4em]">System Secure</p>
          </div>
        </header>

        {successMsg && (
          <div className="mb-6 bg-green-500/10 border border-green-500/40 p-5 rounded-2xl text-green-300 text-xs animate-fade-in flex gap-4 items-center">
            <i className="fas fa-check-circle text-green-400 text-xl shrink-0"></i>
            <p className="font-bold">{successMsg}</p>
          </div>
        )}

        <div className="mb-6">
           <button 
             onClick={handleGoogleLogin}
             type="button"
             disabled={loading}
             className="w-full bg-white text-black font-black py-4 rounded-full flex items-center justify-center gap-3 transition-transform hover:scale-[1.02] active:scale-95 shadow-lg disabled:opacity-50 shine-effect"
           >
             <i className="fab fa-google text-lg"></i>
             <span className="text-xs uppercase tracking-widest font-black">Neural Link (Google)</span>
           </button>
        </div>

        <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-[9px] uppercase">
                <span className="bg-[#030712] px-3 text-gray-500 font-black tracking-[0.3em]">Manual Neural ID</span>
            </div>
        </div>

        <form onSubmit={handleAuth} className="space-y-5">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            className="w-full bg-black/40 border border-white/10 rounded-[24px] py-4 px-6 text-white focus:border-primary outline-none transition-all placeholder-gray-700 text-sm font-bold"
            placeholder="USER@NEURAL.NET"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            className="w-full bg-black/40 border border-white/10 rounded-[24px] py-4 px-6 text-white focus:border-primary outline-none transition-all placeholder-gray-700 text-sm font-bold"
            placeholder="SECURE_KEY"
          />

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-[24px] text-red-400 text-[10px] font-bold text-center animate-shake">
              <i className="fas fa-exclamation-triangle mr-2"></i> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white/5 text-white border border-white/20 font-black py-4 rounded-full hover:bg-white hover:text-black transition-all text-xs uppercase tracking-[0.2em] active:scale-95 shine-effect"
          >
            {isLogin ? 'Initiate Uplink' : 'Register Signal'}
          </button>
        </form>

        <footer className="mt-8 text-center flex flex-col gap-4">
          <button
            onClick={() => { setIsLogin(!isLogin); setError(null); }}
            className="text-[10px] text-gray-500 hover:text-white transition-colors font-black uppercase tracking-[0.2em]"
          >
            {isLogin ? "New Client? Register" : "Active Client? Auth"}
          </button>
          
          {onGuestLogin && (
            <button
                onClick={onGuestLogin}
                className="text-[10px] text-gray-600 hover:text-primary transition-colors font-black uppercase tracking-[0.2em]"
            >
                Initialize Guest Protocol
            </button>
          )}
        </footer>
      </motion.div>
    </div>
  );
};

export default Auth;
