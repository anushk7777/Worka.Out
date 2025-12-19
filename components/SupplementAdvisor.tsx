
import React, { useEffect, useState } from 'react';
import { UserProfile, SupplementRecommendation, PersonalizedPlan } from '../types';
import { generateSupplementStack } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';

interface Props {
  profile: UserProfile;
  userId: string;
  existingPlan: PersonalizedPlan | null;
}

const SupplementAdvisor: React.FC<Props> = ({ profile, userId, existingPlan }) => {
  const [stack, setStack] = useState<SupplementRecommendation[]>(existingPlan?.supplement_stack || []);
  const [loading, setLoading] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!existingPlan?.supplement_stack || existingPlan.supplement_stack.length === 0) {
        generateStack();
    } else {
        setStack(existingPlan.supplement_stack || []);
    }
  }, [existingPlan]);

  const generateStack = async () => {
    setLoading(true);
    try {
        const newStack = await generateSupplementStack(profile);
        if (newStack && newStack.length > 0) {
            setStack(newStack);
            await supabase.from('user_plans').upsert({
                user_id: userId,
                workout_plan: existingPlan?.workout,
                diet_plan: newStack 
            });
        }
    } catch (e) {
        console.error("Failed to generate supplements", e);
    } finally {
        setLoading(false);
    }
  };

  const toggleExpand = (index: number) => {
    const newSet = new Set(expandedItems);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setExpandedItems(newSet);
  };

  const renderSuppCard = (supp: SupplementRecommendation, index: number, accentColor: string, badgeClass: string) => {
    const isExpanded = expandedItems.has(index);
    
    return (
        <div key={index} className="glass-card rounded-[32px] border border-white/10 relative overflow-hidden group transition-all duration-500 hover:border-white/30 animate-slide-up gpu" style={{ animationDelay: `${index * 0.1}s` }}>
            <div 
                className="p-6 cursor-pointer relative z-10"
                onClick={() => toggleExpand(index)}
            >
                <div className="flex justify-between items-start mb-4">
                    <h3 className="font-black text-white text-2xl tracking-tight group-hover:text-primary transition-colors">{supp.name}</h3>
                    <div className="flex items-center gap-3">
                        <span className={`text-[9px] uppercase font-black tracking-widest px-3 py-1.5 rounded-full border border-white/10 ${badgeClass} shadow-lg`}>
                            {supp.priority}
                        </span>
                        <div className={`w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center transition-transform duration-500 ease-spring ${isExpanded ? 'rotate-180 bg-white/20' : ''}`}>
                            <i className="fas fa-chevron-down text-xs text-gray-400"></i>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 text-[10px] mb-4">
                    <span className="bg-black/40 px-3 py-2 rounded-xl text-white border border-white/5 flex items-center font-black tracking-wider uppercase">
                        <i className="fas fa-capsules mr-2 text-primary"></i> {supp.dosage}
                    </span>
                    <span className="bg-black/40 px-3 py-2 rounded-xl text-white border border-white/5 flex items-center font-black tracking-wider uppercase">
                        <i className="fas fa-clock mr-2 text-primary"></i> {supp.timing}
                    </span>
                </div>
                
                <p className="text-sm text-gray-400 leading-relaxed font-medium line-clamp-2 italic">
                    "{supp.reason}"
                </p>
            </div>

            <div className={`overflow-hidden transition-all duration-700 ease-liquid ${isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="p-6 pt-0 space-y-8 animate-fade-in">
                    <div className="h-px bg-white/5 w-full"></div>
                    <div>
                        <h4 className="text-[10px] uppercase font-black text-primary mb-3 tracking-[0.2em] flex items-center gap-2">
                            <i className="fas fa-microscope"></i> Bio-Pathway
                        </h4>
                        <p className="text-sm text-gray-200 leading-relaxed font-medium bg-black/30 p-4 rounded-2xl border border-white/5">
                            {supp.mechanism}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="glass-liquid p-5 rounded-3xl border-green-500/20">
                            <h4 className="text-[10px] uppercase font-black text-green-400 mb-4 tracking-widest flex items-center gap-2">
                                <i className="fas fa-plus"></i> Advantages
                            </h4>
                            <ul className="space-y-3">
                                {(supp.benefits || []).map((b, i) => (
                                    <li key={i} className="text-xs text-gray-300 flex items-start gap-3">
                                        <i className="fas fa-circle text-[6px] text-green-500 mt-1.5"></i>
                                        {b}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="glass-liquid p-5 rounded-3xl border-red-500/20">
                            <h4 className="text-[10px] uppercase font-black text-red-400 mb-4 tracking-widest flex items-center gap-2">
                                <i className="fas fa-shield-virus"></i> Contra-indications
                            </h4>
                            <ul className="space-y-3">
                                {(supp.side_effects || []).map((s, i) => (
                                    <li key={i} className="text-xs text-gray-300 flex items-start gap-3">
                                        <i className="fas fa-exclamation text-[8px] text-red-500 mt-1.5"></i>
                                        {s}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className={`absolute top-0 right-0 w-48 h-48 rounded-full blur-[80px] -mr-16 -mt-16 pointer-events-none transition-opacity duration-700 opacity-20 ${accentColor}`}></div>
        </div>
    );
  };

  return (
    <div className="space-y-8 pb-10">
      <header className="flex items-center justify-between px-1">
        <div>
            <h2 className="text-4xl font-black text-white tracking-tighter">Stack</h2>
            <p className="text-[10px] text-gray-500 font-black mt-1 uppercase tracking-[0.25em]">{profile.goal} Optimized</p>
        </div>
        <button 
          onClick={generateStack}
          disabled={loading}
          className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-primary shadow-xl hover:bg-white/10 active:scale-90 transition-all"
        >
          <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-dna'} text-xl`}></i>
        </button>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-8 animate-fade-in">
            <div className="relative w-24 h-24">
                <div className="absolute inset-0 border-[3px] border-primary/10 rounded-full"></div>
                <div className="absolute inset-0 border-[3px] border-primary border-t-transparent rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <i className="fas fa-atom text-primary text-3xl animate-pulse"></i>
                </div>
            </div>
            <div className="text-center">
                <p className="text-white font-black text-sm tracking-[0.2em] uppercase animate-pulse">Synthesizing Protocol</p>
                <div className="mt-4 flex flex-col gap-1">
                    <span className="text-[9px] text-gray-600 font-black uppercase tracking-widest">Cross-referencing PubMed...</span>
                    <span className="text-[9px] text-gray-600 font-black uppercase tracking-widest delay-150">Verifying interactions...</span>
                </div>
            </div>
        </div>
      ) : (
        <div className="space-y-10">
            <div className="space-y-5">
                <div className="flex items-center gap-4 pl-1">
                    <span className="text-[10px] text-primary font-black uppercase tracking-[0.3em]">Tier 1 Essentials</span>
                    <div className="h-px bg-white/5 flex-1"></div>
                </div>
                
                {(stack || []).filter(s => s.priority === 'Essential').map((supp, i) => 
                    renderSuppCard(supp, i, 'bg-primary', 'bg-primary/20 text-primary border-primary/40')
                )}
            </div>

            <div className="space-y-5">
                <div className="flex items-center gap-4 pl-1">
                    <span className="text-[10px] text-accent font-black uppercase tracking-[0.3em]">Performance Tier</span>
                    <div className="h-px bg-white/5 flex-1"></div>
                </div>

                {(stack || []).filter(s => s.priority === 'Performance' || s.priority === 'Optional').map((supp, i) => 
                    renderSuppCard(supp, i + 100, 'bg-accent', 'bg-accent/20 text-accent border-accent/40')
                )}
            </div>
            
            <footer className="glass-liquid p-6 rounded-[32px] flex gap-4 items-start border border-blue-500/20">
                <i className="fas fa-shield-alt text-accent text-lg mt-1"></i>
                <p className="text-[11px] text-gray-400 leading-relaxed font-bold italic">
                    AI WARNING: Dosages indexed against {profile.weight}kg metabolic weight. Consult healthcare professionals before deploying this stack.
                </p>
            </footer>
        </div>
      )}
    </div>
  );
};

export default SupplementAdvisor;
