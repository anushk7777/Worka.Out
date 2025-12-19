
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import Auth from './Auth';
import Onboarding from './Onboarding';
import { Dashboard } from './Dashboard';
import SupplementAdvisor from './SupplementAdvisor';
import ProgressTracker from './ProgressTracker';
import CheckInDueModal from './CheckInDueModal';
import ChatInterface from './ChatInterface'; 
import ProfileSettings from './ProfileSettings'; 
import { UserProfile, ProgressEntry, ActivityLevel, Goal, Gender, PersonalizedPlan } from '../types';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [workoutPlan, setWorkoutPlan] = useState<PersonalizedPlan | null>(null);
  const [progressLogs, setProgressLogs] = useState<ProgressEntry[]>([]);
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'supplements' | 'progress' | 'profile'>('dashboard');
  const [loading, setLoading] = useState(true);
  
  // Data Synchronization State
  const [planVersion, setPlanVersion] = useState(0);
  
  // Check-in logic states
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [autoLaunchScanner, setAutoLaunchScanner] = useState(false);
  
  // Chat State
  const [showChat, setShowChat] = useState(false);

  // Gesture State
  const touchStart = useRef<{x: number, y: number} | null>(null);

  // Contextual Background State
  const [timePhase, setTimePhase] = useState<'morning' | 'noon' | 'evening' | 'night'>('night');

  useEffect(() => {
    // Determine Time Phase for Ambient Background
    const updateTimePhase = () => {
        const h = new Date().getHours();
        if (h >= 5 && h < 11) setTimePhase('morning');
        else if (h >= 11 && h < 16) setTimePhase('noon');
        else if (h >= 16 && h < 20) setTimePhase('evening');
        else setTimePhase('night');
    };
    updateTimePhase();
    const interval = setInterval(updateTimePhase, 60000 * 30); // Check every 30 mins

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchUserData(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchUserData(session.user.id);
      else {
        setProfile(null);
        setWorkoutPlan(null);
        setLoading(false);
      }
    });

    return () => {
        subscription.unsubscribe();
        clearInterval(interval);
    };
  }, []);

  const fetchUserData = async (userId: string) => {
    setLoading(true);
    try {
      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (profileData) {
        setProfile({
          name: profileData.name,
          age: profileData.age,
          weight: profileData.weight,
          height: profileData.height,
          gender: profileData.gender as Gender,
          activityLevel: profileData.activity_level as ActivityLevel,
          goal: profileData.goal as Goal,
          dietary_preference: profileData.dietary_preference,
          bodyFat: profileData.body_fat,
          daily_calories: profileData.daily_calories,
          weekly_calories: profileData.weekly_calories
        });
      }

      const { data: planData } = await supabase.from('user_plans').select('*').eq('user_id', userId).single();
      if (planData) {
          setWorkoutPlan({ 
              workout: planData.workout_plan,
              supplement_stack: planData.diet_plan 
          });
      }

      const { data: logsData } = await supabase.from('progress_logs').select('*').eq('user_id', userId).order('created_at', { ascending: true });
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

        if (formattedLogs.length > 0) {
          const lastLog = formattedLogs[formattedLogs.length - 1];
          const lastLogDateStr = lastLog.created_at || lastLog.date;
          const lastLogDate = new Date(lastLogDateStr);
          if (!isNaN(lastLogDate.getTime())) {
            const now = new Date();
            const diffTime = Math.abs(now.getTime() - lastLogDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            if (diffDays >= 14) setShowCheckInModal(true);
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
    if (profile) setProfile({ ...profile, weight: log.weight });
    setShowCheckInModal(false);
  };

  const handleUpdateProfile = (updatedProfile: UserProfile) => setProfile(updatedProfile);

  const handlePlanRegenerated = () => {
    setPlanVersion(prev => prev + 1);
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
    setTimeout(() => setAutoLaunchScanner(true), 100);
  };

  // --- Gesture Navigation Logic ---
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    
    const xDiff = touchStart.current.x - touchEnd.x;
    const yDiff = touchStart.current.y - touchEnd.y;

    // Check for horizontal swipe vs vertical scroll
    if (Math.abs(xDiff) > Math.abs(yDiff) && Math.abs(xDiff) > 50) {
        const isLeftEdge = touchStart.current.x < 40;
        const isRightEdge = touchStart.current.x > window.innerWidth - 40;

        // Navigation Order
        const tabs: Array<typeof currentTab> = ['dashboard', 'supplements', 'progress', 'profile'];
        const idx = tabs.indexOf(currentTab);

        // Swipe Left (<-) : Next Tab (if started from Right Edge)
        if (xDiff > 0 && isRightEdge) {
            if (idx < tabs.length - 1) setCurrentTab(tabs[idx + 1]);
        }
        // Swipe Right (->) : Prev Tab (if started from Left Edge)
        else if (xDiff < 0 && isLeftEdge) {
            if (idx > 0) setCurrentTab(tabs[idx - 1]);
        }
    }
    touchStart.current = null;
  };

  // Determine Background Colors based on Time
  const getAmbientColors = () => {
      switch(timePhase) {
          case 'morning': return {
              orb1: 'bg-orange-500/20',
              orb2: 'bg-blue-500/10',
              orb3: 'bg-yellow-500/10'
          };
          case 'noon': return {
              orb1: 'bg-sky-400/20',
              orb2: 'bg-blue-600/10',
              orb3: 'bg-cyan-300/10'
          };
          case 'evening': return {
              orb1: 'bg-purple-600/20',
              orb2: 'bg-orange-600/20',
              orb3: 'bg-pink-600/10'
          };
          default: return { // Night
              orb1: 'bg-indigo-900/20',
              orb2: 'bg-blue-900/10',
              orb3: 'bg-slate-800/20'
          };
      }
  };

  const ambient = getAmbientColors();

  if (loading) {
    return (
      <div className="fixed inset-0 bg-dark flex flex-col items-center justify-center z-[9999]">
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 ${ambient.orb1} rounded-full blur-[100px] animate-pulse-slow`}></div>
        <div className="relative z-10 flex flex-col items-center">
            <div className="w-14 h-14 border-[3px] border-primary/20 border-t-primary rounded-full animate-spin mb-6"></div>
            <p className="text-white font-bold tracking-[0.2em] text-[10px] uppercase animate-pulse">Initializing MealMan</p>
        </div>
      </div>
    );
  }

  if (!session) return <Auth />;
  if (!profile) return (
      <div className="fixed inset-0 bg-dark overflow-y-auto overflow-x-hidden">
        <Onboarding onComplete={(p) => { setProfile(p); fetchUserData(session.user.id); }} onSignOut={handleSignOut} />
      </div>
  );

  return (
    <div 
        className="flex flex-col h-[100dvh] bg-dark text-gray-200 font-sans overflow-hidden relative selection:bg-primary/30"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
    >
      
      {/* Cinematic Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
         {/* Top Orb */}
         <div className={`absolute top-[-20%] left-[-10%] w-[80%] h-[80%] ${ambient.orb1} blur-[120px] rounded-full will-change-transform animate-[meshMove_20s_infinite_alternate] transition-colors duration-[3000ms]`}></div>
         {/* Bottom Orb */}
         <div className={`absolute bottom-[-20%] right-[-10%] w-[80%] h-[80%] ${ambient.orb2} blur-[120px] rounded-full will-change-transform animate-[meshMove_25s_infinite_alternate-reverse] transition-colors duration-[3000ms]`}></div>
         {/* Middle Accent */}
         <div className={`absolute top-1/3 left-1/3 w-[50%] h-[50%] ${ambient.orb3} blur-[100px] rounded-full opacity-50 will-change-transform animate-pulse-slow transition-colors duration-[3000ms]`}></div>
      </div>

      {showCheckInModal && <CheckInDueModal onConfirm={handleStartCheckIn} onDismiss={() => setShowCheckInModal(false)} />}
      
      {showChat && (
          <div className="fixed inset-0 z-[100] bg-dark/95 backdrop-blur-3xl animate-fade-in flex flex-col">
              <ChatInterface userProfile={profile} progressLogs={progressLogs} onClose={() => setShowChat(false)} />
          </div>
      )}

      {/* Content Area with Safe Area Padding */}
      <main className="flex-1 overflow-y-auto no-scrollbar scroll-smooth pb-[100px] pt-[var(--sat)] relative z-10 w-full max-w-lg mx-auto md:max-w-xl lg:max-w-2xl xl:max-w-4xl">
        <div className="animate-fade-in">
          {currentTab === 'dashboard' && (
             <Dashboard 
                profile={profile} 
                userId={session.user.id} 
                workoutPlan={workoutPlan} 
                logs={progressLogs} 
                onSignOut={handleSignOut} 
                onNavigate={setCurrentTab} 
                refreshTrigger={planVersion}
             />
          )}
          {currentTab === 'supplements' && (
             <SupplementAdvisor 
                profile={profile}
                userId={session.user.id}
                existingPlan={workoutPlan}
             />
          )}
          {currentTab === 'progress' && <ProgressTracker logs={progressLogs} onAddLog={handleAddLog} profile={profile} launchScanner={autoLaunchScanner} onScannerLaunched={() => setAutoLaunchScanner(false)} />}
          {currentTab === 'profile' && (
            <ProfileSettings 
                profile={profile} 
                onUpdateProfile={handleUpdateProfile} 
                onSignOut={handleSignOut}
                onPlanRegenerated={handlePlanRegenerated}
            />
          )}
        </div>
      </main>

      {/* Floating Chat Button */}
      {!showChat && (
        <button 
            onClick={() => setShowChat(true)}
            className="absolute bottom-24 right-5 w-14 h-14 bg-gradient-to-tr from-primary to-yellow-400 rounded-full shadow-2xl shadow-primary/30 flex items-center justify-center z-40 transition-transform active:scale-90 duration-300 ease-spring border-2 border-white/20 gpu hover:scale-105"
        >
            <i className="fas fa-robot text-dark text-2xl drop-shadow-sm"></i>
        </button>
      )}

      {/* Glass Bottom Nav */}
      <nav className="glass-heavy fixed bottom-0 left-0 right-0 h-[85px] pb-[var(--sab)] flex justify-around items-center px-2 z-50 border-t border-white/5">
        <button 
          onClick={() => setCurrentTab('dashboard')}
          className={`group flex flex-col items-center justify-center w-16 h-full active:scale-90 transition-transform duration-300 ease-spring`}
        >
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-1 transition-all duration-500 ease-spring ${currentTab === 'dashboard' ? 'bg-primary text-dark shadow-[0_0_20px_rgba(255,215,0,0.4)] translate-y-[-4px]' : 'bg-transparent text-gray-400 group-hover:bg-white/5'}`}>
            <i className={`fas fa-chart-pie text-lg ${currentTab === 'dashboard' ? 'scale-110' : ''}`}></i>
          </div>
          <span className={`text-[9px] font-black tracking-widest transition-colors duration-300 ${currentTab === 'dashboard' ? 'text-primary' : 'text-gray-500'}`}>PLAN</span>
        </button>

        <button 
          onClick={() => setCurrentTab('progress')}
          className={`group flex flex-col items-center justify-center w-16 h-full active:scale-90 transition-transform duration-300 ease-spring`}
        >
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-1 transition-all duration-500 ease-spring ${currentTab === 'progress' ? 'bg-primary text-dark shadow-[0_0_20px_rgba(255,215,0,0.4)] translate-y-[-4px]' : 'bg-transparent text-gray-400 group-hover:bg-white/5'}`}>
            <i className={`fas fa-chart-line text-lg ${currentTab === 'progress' ? 'scale-110' : ''}`}></i>
          </div>
          <span className={`text-[9px] font-black tracking-widest transition-colors duration-300 ${currentTab === 'progress' ? 'text-primary' : 'text-gray-500'}`}>LOG</span>
        </button>

        <button 
          onClick={() => setCurrentTab('supplements')}
          className={`group flex flex-col items-center justify-center w-16 h-full active:scale-90 transition-transform duration-300 ease-spring`}
        >
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-1 transition-all duration-500 ease-spring ${currentTab === 'supplements' ? 'bg-primary text-dark shadow-[0_0_20px_rgba(255,215,0,0.4)] translate-y-[-4px]' : 'bg-transparent text-gray-400 group-hover:bg-white/5'}`}>
            <i className={`fas fa-flask text-lg ${currentTab === 'supplements' ? 'scale-110' : ''}`}></i>
          </div>
          <span className={`text-[9px] font-black tracking-widest transition-colors duration-300 ${currentTab === 'supplements' ? 'text-primary' : 'text-gray-500'}`}>SUPP</span>
        </button>

        <button 
          onClick={() => setCurrentTab('profile')}
          className={`group flex flex-col items-center justify-center w-16 h-full active:scale-90 transition-transform duration-300 ease-spring`}
        >
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-1 transition-all duration-500 ease-spring ${currentTab === 'profile' ? 'bg-primary text-dark shadow-[0_0_20px_rgba(255,215,0,0.4)] translate-y-[-4px]' : 'bg-transparent text-gray-400 group-hover:bg-white/5'}`}>
            <i className={`fas fa-user text-lg ${currentTab === 'profile' ? 'scale-110' : ''}`}></i>
          </div>
          <span className={`text-[9px] font-black tracking-widest transition-colors duration-300 ${currentTab === 'profile' ? 'text-primary' : 'text-gray-500'}`}>YOU</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
