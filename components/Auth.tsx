
import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';

const Auth: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
        
        setSuccessMsg('Profile Pending. Please check your email for neural link verification.');
        setIsLogin(true);
        setPassword('');
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 relative overflow-hidden">
      <div className="absolute inset-0 z-0">
          <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-primary/20 rounded-full blur-[140px] animate-pulse-slow"></div>
          <div className="absolute bottom-[-20%] left-[-10%] w-[70%] h-[70%] bg-blue-600/20 rounded-full blur-[160px]"></div>
      </div>

      <div className="glass-card w-full max-w-sm p-10 rounded-[48px] shadow-[0_40px_100px_rgba(0,0,0,0.6)] relative z-10 animate-slide-up backdrop-blur-3xl border border-white/10 inner-glow gpu">
        <header className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-[28px] bg-gradient-to-tr from-primary to-yellow-400 mb-6 shadow-2xl shadow-primary/40 transform rotate-12">
             <i className="fas fa-shield-heart text-3xl text-dark"></i>
          </div>
          <h1 className="text-5xl font-black text-white tracking-tighter mb-2">
            <span className="text-transparent bg-clip-text bg-gradient-to-br from-white via-primary to-yellow-600">MEAL</span>MAN
          </h1>
          <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.4em]">Elite AI Core</p>
        </header>

        {successMsg && (
          <div className="mb-8 glass-liquid border-green-500/40 p-5 rounded-2xl text-green-300 text-xs leading-relaxed animate-fade-in flex gap-4 items-center">
            <i className="fas fa-shuttle-space text-green-400 text-xl"></i>
            <p className="font-bold">{successMsg}</p>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-500 ml-1 uppercase tracking-[0.2em]">Neural ID</label>
            <div className="relative group">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/40 border border-white/5 rounded-2xl py-4 px-6 text-white focus:border-primary focus:bg-black/60 outline-none transition-all placeholder-gray-700 text-sm font-medium"
                placeholder="id@nexus.com"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-500 ml-1 uppercase tracking-[0.2em]">Security Key</label>
            <div className="relative group">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/40 border border-white/5 rounded-2xl py-4 px-6 text-white focus:border-primary focus:bg-black/60 outline-none transition-all placeholder-gray-700 text-sm font-medium"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl text-red-400 text-[10px] font-black uppercase tracking-widest text-center">
              Access Denied: {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-dark font-black py-5 rounded-2xl shadow-[0_20px_40px_rgba(255,255,255,0.1)] active:scale-95 disabled:opacity-50 transition-all text-xs uppercase tracking-[0.2em] mt-4"
          >
            {loading ? <i className="fas fa-sync-alt fa-spin"></i> : (isLogin ? 'Establish Link' : 'Initialize ID')}
          </button>
        </form>

        <footer className="mt-10 text-center">
          <button
            onClick={() => { setIsLogin(!isLogin); setSuccessMsg(null); setError(null); }}
            className="text-[10px] text-gray-500 hover:text-white transition-colors font-black uppercase tracking-[0.2em]"
          >
            {isLogin ? "No Link? " : "Linked? "}
            <span className="text-primary hover:underline">
              {isLogin ? 'Register' : 'Authorize'}
            </span>
          </button>
        </footer>
      </div>
    </div>
  );
};

export default Auth;
