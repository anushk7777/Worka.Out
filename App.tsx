
import React, { useState, useEffect } from 'react';
import { supabase } from './services/supabaseClient';
import Auth from './components/Auth';
import Onboarding from './components/Onboarding';
import { Dashboard } from './components/Dashboard';
import SupplementAdvisor from './components/SupplementAdvisor';
import ProgressTracker from './components/ProgressTracker';
import CheckInDueModal from './components/CheckInDueModal';
import ChatInterface from './components/ChatInterface'; 
import ProfileSettings from './components/ProfileSettings'; 
import { UserProfile, ProgressEntry, ActivityLevel, Goal, Gender, PersonalizedPlan } from './types';
import { useDrag } from '@use-gesture/react';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [workoutPlan, setWorkoutPlan] = useState<PersonalizedPlan | null>(null);
  const [progressLogs, setProgressLogs] = useState<ProgressEntry[]>([]);
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'supplements' | 'progress' | 'profile'>('dashboard');
  const [loading, setLoading] = useState(true);
  
  // Data Synchronization State
  const [planVersion, setPlanVersion] = useState(0);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  
  // Check-in logic states
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [autoLaunchScanner, setAutoLaunchScanner] = useState(false);
  
  // Chat State
  const [showChat, setShowChat] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

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
      else if (!isGuest) setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        setIsGuest(false);
        fetchUserData(session.user.id);
      } else {
        if (!isGuest) {
          setProfile(null);
          setWorkoutPlan(null);
        }
        setLoading(false);
      }
    });

    return () => {
        subscription.unsubscribe();
        clearInterval(interval);
    };
  }, [isGuest]);

  const fetchUserData = async (userId: string) => {
    setLoading(true);
    setFetchError(null);
    try {
      const { data: profileData, error: profileError } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (profileError) throw profileError;
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

      const { data: planData, error: planError } = await supabase.from('user_plans').select('*').eq('user_id', userId).single();
      if (planError && planError.code !== 'PGRST116') throw planError; // Ignore "not found" error
      if (planData) {
          setWorkoutPlan({ 
              workout: planData.workout_plan,
              supplement_stack: planData.diet_plan 
          });
      }

      const { data: logsData, error: logsError } = await supabase.from('progress_logs').select('*').eq('user_id', userId).order('created_at', { ascending: true });
      if (logsError) throw logsError;
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
      }
    } catch (error: any) {
      console.error("Error fetching data:", error);
      setFetchError(error.message || "Network error. Failed to fetch user data.");
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = () => {
      setIsGuest(true);
      setLoading(false);
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
    if (!isGuest) await supabase.auth.signOut();
    setIsGuest(false);
    setProfile(null);
    setWorkoutPlan(null);
    setProgressLogs([]);
    setShowCheckInModal(false);
    setLoading(false);
  };

  const handleStartCheckIn = () => {
    setShowCheckInModal(false);
    setCurrentTab('progress');
    setTimeout(() => setAutoLaunchScanner(true), 100);
  };

  // --- Gesture Navigation Logic ---
  const bindDrag = useDrag(({ swipe: [swipeX], tap, event }) => {
    if (tap) return;
    
    // Ignore swipes on elements that need their own horizontal scrolling/swiping
    const target = event.target as HTMLElement;
    if (target.closest('.swiper') || target.closest('canvas') || target.closest('[data-no-swipe]')) {
      return;
    }

    const tabs: Array<typeof currentTab> = ['dashboard', 'supplements', 'progress', 'profile'];
    const idx = tabs.indexOf(currentTab);

    if (swipeX === -1) {
        // Swiped left -> go to next tab
        if (idx < tabs.length - 1) setCurrentTab(tabs[idx + 1]);
    } else if (swipeX === 1) {
        // Swiped right -> go to previous tab
        if (idx > 0) setCurrentTab(tabs[idx - 1]);
    }
  }, { axis: 'x', filterTaps: true, swipe: { distance: 50, velocity: 0.3 } });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentTab]);

  const getAmbientColors = () => {
      switch(timePhase) {
          case 'morning': return { orb1: 'from-amber-500/20 to-transparent', orb2: 'from-orange-400/20 to-transparent', orb3: 'from-yellow-600/20 to-transparent' };
          case 'noon': return { orb1: 'from-orange-300/20 to-transparent', orb2: 'from-amber-400/20 to-transparent', orb3: 'from-yellow-500/20 to-transparent' };
          case 'evening': return { orb1: 'from-rose-500/20 to-transparent', orb2: 'from-orange-500/20 to-transparent', orb3: 'from-amber-600/20 to-transparent' };
          default: return { orb1: 'from-indigo-500/20 to-transparent', orb2: 'from-purple-500/20 to-transparent', orb3: 'from-slate-500/20 to-transparent' };
      }
  };

  const ambient = getAmbientColors();
  const userId = session?.user?.id || (isGuest ? 'guest-user' : '');

  if (loading) {
    return (
      <div className="fixed inset-0 bg-dark flex flex-col items-center justify-center z-[9999]">
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] ${ambient.orb1} rounded-full animate-pulse-slow transform-gpu`}></div>
        <div className="relative z-10 flex flex-col items-center">
            <div className="w-14 h-14 border-[3px] border-primary/20 border-t-primary rounded-full animate-spin mb-6"></div>
            <p className="text-white font-bold tracking-[0.2em] text-[10px] uppercase animate-pulse">Initializing Neural Link</p>
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="fixed inset-0 bg-dark flex flex-col items-center justify-center z-[9999] p-6 text-center">
        <div className="glass-premium p-8 rounded-[32px] border border-red-500/30 max-w-sm w-full">
          <i className="fas fa-wifi text-4xl text-red-500 mb-4"></i>
          <h2 className="text-xl font-black text-white mb-2">Connection Error</h2>
          <p className="text-gray-400 text-sm mb-6">{fetchError}</p>
          <button 
            onClick={() => {
                if (session) fetchUserData(session.user.id);
                else setFetchError(null);
            }}
            className="w-full py-4 rounded-2xl bg-primary text-dark font-black text-xs uppercase tracking-widest hover:brightness-110 transition-all"
          >
            Retry Connection
          </button>
          <button 
            onClick={handleSignOut}
            className="w-full py-4 mt-3 rounded-2xl bg-white/5 text-white font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (!session && !isGuest) return <Auth onGuestLogin={handleGuestLogin} />;
  
  if (!profile) return (
      <div className="fixed inset-0 bg-dark overflow-y-auto overflow-x-hidden">
        <Onboarding 
            isGuest={isGuest}
            onComplete={(p, wp) => { 
                setProfile(p); 
                if (wp) {
                    setWorkoutPlan({ workout: wp, supplement_stack: [] });
                }
                if (!isGuest && session) fetchUserData(session.user.id); 
            }} 
            onSignOut={handleSignOut} 
        />
      </div>
  );

  return (
    <div 
        {...bindDrag()}
        className="flex flex-col min-h-[100dvh] bg-dark text-gray-200 font-sans relative selection:bg-primary/30 bg-noise touch-pan-y"
    >
      
      {/* Cinematic Dynamic Background - Optimized for mobile */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden transform-gpu">
         <div className={`absolute top-[-20%] left-[-10%] w-[80%] h-[80%] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] ${ambient.orb1} rounded-full transition-colors duration-[3000ms] opacity-60`}></div>
         <div className={`absolute bottom-[-20%] right-[-10%] w-[80%] h-[80%] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] ${ambient.orb2} rounded-full transition-colors duration-[3000ms] opacity-60`}></div>
         <div className={`absolute top-1/3 left-1/3 w-[50%] h-[50%] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] ${ambient.orb3} rounded-full opacity-30 transition-colors duration-[3000ms]`}></div>
      </div>

      {isGuest && (
          <div className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-500 via-red-500 to-yellow-500 z-[9999]"></div>
      )}

      {showCheckInModal && <CheckInDueModal onConfirm={handleStartCheckIn} onDismiss={() => setShowCheckInModal(false)} />}
      
      {showChat && (
          <div className="fixed inset-0 z-[100] bg-dark/95 backdrop-blur-sm animate-fade-in flex flex-col transform-gpu">
              <ChatInterface userProfile={profile} progressLogs={progressLogs} onClose={() => setShowChat(false)} />
          </div>
      )}

      {/* Content Area with Safe Area Padding */}
      <main className="flex-1 pb-[100px] pt-[var(--sat)] relative z-10 w-full max-w-lg mx-auto md:max-w-xl lg:max-w-2xl xl:max-w-4xl">
        <div key={currentTab} className="relative z-10">
          {currentTab === 'dashboard' && (
            <Dashboard 
                profile={profile} 
                userId={userId} 
                workoutPlan={workoutPlan} 
                logs={progressLogs} 
                onSignOut={handleSignOut} 
                onNavigate={setCurrentTab} 
                refreshTrigger={planVersion}
                isGeneratingPlan={isGeneratingPlan}
                setIsGeneratingPlan={setIsGeneratingPlan}
            />
          )}
          {currentTab === 'supplements' && (
            <SupplementAdvisor 
                profile={profile}
                userId={userId}
                existingPlan={workoutPlan}
                isGuest={isGuest}
            />
          )}
          {currentTab === 'progress' && (
            <ProgressTracker logs={progressLogs} onAddLog={handleAddLog} profile={profile} launchScanner={autoLaunchScanner} onScannerLaunched={() => setAutoLaunchScanner(false)} workoutPlan={workoutPlan} isGuest={isGuest} />
          )}
          {currentTab === 'profile' && (
            <ProfileSettings 
                profile={profile} 
                onUpdateProfile={handleUpdateProfile} 
                onSignOut={handleSignOut}
                onPlanRegenerated={handlePlanRegenerated}
                isGuest={isGuest}
            />
          )}
        </div>
      </main>

      {/* Floating Chat Button */}
      {!showChat && (
        <div className="fixed bottom-[100px] left-0 right-0 z-40 pointer-events-none flex justify-center px-4">
            <div className="w-full max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-4xl relative">
                <button 
                    onClick={() => setShowChat(true)}
                    className="absolute bottom-0 right-0 w-14 h-14 bg-gradient-to-tr from-primary to-accent rounded-full shadow-2xl shadow-primary/30 flex items-center justify-center pointer-events-auto transition-transform active:scale-90 duration-300 ease-spring border-2 border-white/20 gpu hover:scale-105 shine-effect"
                >
                    <i className="fas fa-robot text-dark text-2xl drop-shadow-sm"></i>
                </button>
            </div>
        </div>
      )}

      {/* Glass Bottom Nav */}
      <nav className="glass-premium fixed bottom-0 left-0 right-0 h-[85px] pb-[var(--sab)] flex justify-around items-center px-2 z-50 border-t border-white/5">
        {[
          { id: 'dashboard', icon: 'fa-chart-pie', label: 'PLAN' },
          { id: 'progress', icon: 'fa-chart-line', label: 'LOG' },
          { id: 'supplements', icon: 'fa-flask', label: 'SUPP' },
          { id: 'profile', icon: 'fa-user', label: 'YOU' },
        ].map((tab) => (
          <button 
            key={tab.id}
            onClick={() => setCurrentTab(tab.id as any)}
            className={`group relative flex flex-col items-center justify-center w-16 h-full active:scale-90 transition-transform duration-300 ease-spring`}
          >
            <div className={`relative w-10 h-10 rounded-full flex items-center justify-center mb-1 transition-all duration-500 ease-spring ${currentTab === tab.id ? 'text-dark translate-y-[-4px]' : 'text-gray-400 group-hover:bg-white/5'}`}>
              {currentTab === tab.id && (
                <div
                  className="absolute inset-0 bg-primary rounded-full shadow-[0_0_20px_rgba(255,51,102,0.4)] transition-all duration-300"
                />
              )}
              <i className={`fas ${tab.icon} text-lg relative z-10 ${currentTab === tab.id ? 'scale-110' : ''} transition-transform duration-300`}></i>
            </div>
            <span className={`text-[9px] font-black tracking-widest transition-colors duration-300 ${currentTab === tab.id ? 'text-primary' : 'text-gray-500'}`}>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default App;
