import React, { useState, useEffect } from 'react';
import { supabase } from './services/supabaseClient';
import Auth from './components/Auth';
import Onboarding from './components/Onboarding';
import Dashboard from './components/Dashboard';
import Library from './components/Library';
import ProgressTracker from './components/ProgressTracker';
import CheckInDueModal from './components/CheckInDueModal';
import { UserProfile, ProgressEntry, ActivityLevel, Goal, Gender, PersonalizedPlan } from './types';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [workoutPlan, setWorkoutPlan] = useState<PersonalizedPlan | null>(null);
  const [progressLogs, setProgressLogs] = useState<ProgressEntry[]>([]);
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'library' | 'progress'>('dashboard');
  const [loading, setLoading] = useState(true);
  
  // Check-in logic states
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [autoLaunchScanner, setAutoLaunchScanner] = useState(false);

  useEffect(() => {
    // 1. Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchUserData(session.user.id);
      else setLoading(false);
    });

    // 2. Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchUserData(session.user.id);
      else {
        setProfile(null);
        setWorkoutPlan(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserData = async (userId: string) => {
    setLoading(true);
    try {
      // Fetch Profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileData) {
        setProfile({
          name: profileData.name,
          age: profileData.age,
          weight: profileData.weight,
          height: profileData.height,
          gender: profileData.gender as Gender,
          activityLevel: profileData.activity_level as ActivityLevel,
          goal: profileData.goal as Goal,
          bodyFat: profileData.body_fat,
          daily_calories: profileData.daily_calories,
          weekly_calories: profileData.weekly_calories
        });
      }

      // Fetch User Workout Plan
      const { data: planData } = await supabase
        .from('user_plans')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (planData && planData.workout_plan) {
        setWorkoutPlan({
          workout: planData.workout_plan
        });
      }

      // Fetch Logs
      const { data: logsData } = await supabase
        .from('progress_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (logsData) {
        const formattedLogs: ProgressEntry[] = logsData.map(log => ({
          id: log.id,
          date: log.date,
          created_at: log.created_at,
          weight: log.weight,
          bodyFat: log.body_fat,
          notes: log.notes,
          photo_url: log.photo_url
        }));
        setProgressLogs(formattedLogs);

        // Check if check-in is due (14 days)
        if (formattedLogs.length > 0) {
          const lastLog = formattedLogs[formattedLogs.length - 1];
          const lastLogDateStr = lastLog.created_at || lastLog.date;
          const lastLogDate = new Date(lastLogDateStr);
          
          if (!isNaN(lastLogDate.getTime())) {
            const now = new Date();
            const diffTime = Math.abs(now.getTime() - lastLogDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            
            if (diffDays >= 14) {
               setShowCheckInModal(true);
            }
          }
        }
      }

    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLog = (log: ProgressEntry) => {
    setProgressLogs(prev => [...prev, log]);
    if (profile) {
      setProfile({ ...profile, weight: log.weight });
    }
    setShowCheckInModal(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setWorkoutPlan(null);
    setProgressLogs([]);
    setShowCheckInModal(false);
  };

  const handleStartCheckIn = () => {
    setShowCheckInModal(false);
    setCurrentTab('progress');
    setTimeout(() => {
      setAutoLaunchScanner(true);
    }, 100);
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-dark flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/20 rounded-full blur-[100px] animate-pulse-slow"></div>
        <div className="relative z-10 flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-white font-bold tracking-widest text-xs uppercase animate-pulse">Initializing WorkA.out</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  if (!profile) {
    return (
      <div className="min-h-[100dvh] bg-dark relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-primary/10 blur-[120px] rounded-full"></div>
        <header className="p-8 text-center relative z-10">
          <div className="inline-block px-3 py-1 bg-white/5 rounded-full border border-white/10 mb-4 backdrop-blur-sm">
             <span className="text-[10px] text-primary font-bold uppercase tracking-wider">Setup Mode</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tighter">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-yellow-200">WORKA</span>.OUT
          </h1>
          <button onClick={handleSignOut} className="mt-6 text-xs text-gray-500 hover:text-white transition-colors">Abort Setup</button>
        </header>
        <div className="relative z-10">
          <Onboarding onComplete={(p) => { 
            setProfile(p); 
            fetchUserData(session.user.id);
          }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-dark text-gray-200 font-sans selection:bg-primary/30 overflow-hidden overscroll-y-contain">
      
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none z-0">
         <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/10 blur-[100px] rounded-full opacity-50"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[100px] rounded-full opacity-50"></div>
      </div>

      {showCheckInModal && (
        <CheckInDueModal 
          onConfirm={handleStartCheckIn}
          onDismiss={() => setShowCheckInModal(false)}
        />
      )}

      <main className="flex-1 overflow-hidden relative z-10 flex flex-col">
        {/* Added webkit-overflow-scrolling for smooth iOS scroll */}
        <div className="flex-1 overflow-y-auto scroll-smooth" style={{ WebkitOverflowScrolling: 'touch' }}>
          {currentTab === 'dashboard' && <Dashboard profile={profile} userId={session.user.id} workoutPlan={workoutPlan} onSignOut={handleSignOut} />}
          {currentTab === 'library' && <Library />}
          {currentTab === 'progress' && (
            <ProgressTracker 
              logs={progressLogs} 
              onAddLog={handleAddLog} 
              profile={profile} 
              launchScanner={autoLaunchScanner}
              onScannerLaunched={() => setAutoLaunchScanner(false)}
            />
          )}
        </div>
      </main>

      {/* Glass Bottom Nav */}
      <nav className="glass-heavy h-[80px] flex justify-around items-center px-6 z-50 shrink-0 pb-4 relative">
        <button 
          onClick={() => setCurrentTab('dashboard')}
          className={`group flex flex-col items-center p-2 w-16 transition-all duration-300 ${currentTab === 'dashboard' ? 'translate-y-[-5px]' : 'opacity-50 hover:opacity-80'}`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-1 transition-all ${currentTab === 'dashboard' ? 'bg-primary text-dark shadow-lg shadow-primary/40' : 'bg-transparent text-white'}`}>
            <i className="fas fa-chart-pie text-lg"></i>
          </div>
          <span className={`text-[10px] font-bold tracking-wide ${currentTab === 'dashboard' ? 'text-primary' : 'text-gray-400'}`}>PLAN</span>
        </button>

        <button 
          onClick={() => setCurrentTab('progress')}
          className={`group flex flex-col items-center p-2 w-16 transition-all duration-300 ${currentTab === 'progress' ? 'translate-y-[-5px]' : 'opacity-50 hover:opacity-80'}`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-1 transition-all ${currentTab === 'progress' ? 'bg-primary text-dark shadow-lg shadow-primary/40' : 'bg-transparent text-white'}`}>
             <i className="fas fa-chart-line text-lg"></i>
          </div>
          <span className={`text-[10px] font-bold tracking-wide ${currentTab === 'progress' ? 'text-primary' : 'text-gray-400'}`}>LOG</span>
        </button>

        <button 
          onClick={() => setCurrentTab('library')}
          className={`group flex flex-col items-center p-2 w-16 transition-all duration-300 ${currentTab === 'library' ? 'translate-y-[-5px]' : 'opacity-50 hover:opacity-80'}`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-1 transition-all ${currentTab === 'library' ? 'bg-primary text-dark shadow-lg shadow-primary/40' : 'bg-transparent text-white'}`}>
             <i className="fas fa-book text-lg"></i>
          </div>
          <span className={`text-[10px] font-bold tracking-wide ${currentTab === 'library' ? 'text-primary' : 'text-gray-400'}`}>LIB</span>
        </button>
      </nav>
    </div>
  );
};

export default App;