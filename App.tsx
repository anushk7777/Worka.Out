
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

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [workoutPlan, setWorkoutPlan] = useState<PersonalizedPlan | null>(null);
  const [progressLogs, setProgressLogs] = useState<ProgressEntry[]>([]);
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'supplements' | 'progress' | 'profile'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [planVersion, setPlanVersion] = useState(0);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [autoLaunchScanner, setAutoLaunchScanner] = useState(false);
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
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

    return () => subscription.unsubscribe();
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
  const handlePlanRegenerated = () => setPlanVersion(prev => prev + 1);

  const handleSignOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
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

  if (loading) {
    return (
      <div className="fixed inset-0 bg-dark flex flex-col items-center justify-center z-[9999]">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-primary/20 rounded-full blur-[110px] animate-pulse-slow"></div>
        <div className="relative z-10 flex flex-col items-center">
            <div className="w-16 h-16 border-[4px] border-primary/5 border-t-primary rounded-full animate-spin mb-10"></div>
            <p className="text-white font-black tracking-[0.4em] text-[10px] uppercase animate-pulse">Initializing Neural Link</p>
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
    <div className="flex flex-col h-[100dvh] bg-transparent text-gray-200 font-sans overflow-hidden relative selection:bg-primary/30">
      
      {showCheckInModal && <CheckInDueModal onConfirm={handleStartCheckIn} onDismiss={() => setShowCheckInModal(false)} />}
      
      {showChat && (
          <div className="fixed inset-0 z-[100] bg-dark/95 backdrop-blur-3xl animate-fade-in flex flex-col">
              <ChatInterface userProfile={profile} progressLogs={progressLogs} onClose={() => setShowChat(false)} />
          </div>
      )}

      <main className="flex-1 overflow-y-auto no-scrollbar scroll-smooth pb-[140px] pt-[calc(var(--sat)+1rem)] relative z-10 w-full max-w-lg mx-auto md:max-w-xl lg:max-w-2xl xl:max-w-4xl px-5 scroll-glow">
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

      {!showChat && (
        <button 
            onClick={() => setShowChat(true)}
            className="fixed bottom-[115px] right-6 w-14 h-14 bg-gradient-to-tr from-primary to-yellow-400 rounded-full shadow-[0_15px_35px_rgba(255,215,0,0.35)] flex items-center justify-center z-40 transition-transform haptic-press duration-300 ease-spring border border-white/40 gpu"
        >
            <i className="fas fa-robot text-dark text-2xl drop-shadow-sm"></i>
        </button>
      )}

      {/* Modern Floating Dock */}
      <nav className="fixed bottom-8 left-6 right-6 h-[72px] z-50 flex justify-center">
        <div className="liquid-dock w-full max-w-sm rounded-[36px] px-2 flex justify-around items-center h-full inner-glow transform active:scale-[0.99] transition-transform duration-500">
          {[
            { id: 'dashboard', icon: 'fa-chart-pie', label: 'PLAN' },
            { id: 'progress', icon: 'fa-chart-line', label: 'LOG' },
            { id: 'supplements', icon: 'fa-flask', label: 'SUPP' },
            { id: 'profile', icon: 'fa-user', label: 'YOU' }
          ].map((tab) => (
            <button 
              key={tab.id}
              onClick={() => setCurrentTab(tab.id as any)} 
              className={`group flex flex-col items-center justify-center w-14 h-14 transition-all duration-500 ease-spring haptic-press`}
            >
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-500 ease-spring ${currentTab === tab.id ? 'bg-primary text-dark shadow-[0_6px_20px_rgba(255,215,0,0.4)] scale-110' : 'text-gray-500 group-hover:bg-white/5'}`}>
                <i className={`fas ${tab.icon} text-lg`}></i>
              </div>
              <span className={`text-[8px] font-black tracking-[0.2em] mt-1 transition-all duration-500 ${currentTab === tab.id ? 'opacity-100 translate-y-0 text-primary' : 'opacity-0 -translate-y-1'}`}>{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default App;
