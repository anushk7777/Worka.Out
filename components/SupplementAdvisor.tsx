
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
        <div key={index} className="glass-card rounded-[28px] border border-white/10 relative overflow-hidden group animate-slide-up" style={{ animationDelay: `${index * 80}ms` }}>
            <div className="p-5 cursor-pointer relative z-10" onClick={() => toggleExpand(index)}>
                <div className="flex justify-between items-start mb-3">
                    <h3 className="font-black text-white text-xl tracking-tight leading-none">{supp.name}</h3>
                    <div className="flex items-center gap-2">
                        <span className={`text-[8px] uppercase font-black tracking-widest px-2.5 py-1 rounded-full border border-white/10 ${badgeClass}`}>
                            {supp.priority}
                        </span>
                        <div className={`w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center transition-transform duration-500 ${isExpanded ? 'rotate-180 bg-white/10' : ''}`}>
                            <i className="fas fa-chevron-down text-[10px] text-gray-400"></i>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-1.5 text-[9px] mb-3">
                    <span className="bg-black/30 px-2.5 py-1.5 rounded-xl text-gray-300 border border-white/5 flex items-center font-black tracking-widest">
                        <i className="fas fa-capsules mr-1.5 text-primary"></i> {supp.dosage}
                    </span>
                    <span className="bg-black/30 px-2.5 py-1.5 rounded-xl text-gray-300 border border-white/5 flex items-center font-black tracking-widest">
                        <i className="fas fa-clock mr-1.5 text-primary"></i> {supp.timing}
                    </span>
                </div>
                
                <p className="text-xs text-gray-500 leading-relaxed font-medium line-clamp-2 italic">
                    "{supp.reason}"
                </p>
            </div>

            <div className={`overflow-hidden transition-all duration-700 ease-liquid ${isExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="p-5 pt-0 space-y-6 animate-fade-in">
                    <div className="h-px bg-white/5 w-full"></div>
                    <div>
                        <h4 className="text-[9px] uppercase font-black text-primary mb-2 tracking-[0.2em] flex items-center gap-2">
                            <i className="fas fa-microscope"></i> Bio-Pathway
                        </h4>
                        <p className="text-xs text-gray-200 leading-relaxed font-medium bg-black/30 p-4 rounded-[20px] border border-white/5">
                            {supp.mechanism}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        <div className="glass-liquid p-4 rounded-[24px] border-green-500/20">
                            <h4 className="text-[9px] uppercase font-black text-green-400 mb-3 tracking-widest flex items-center gap-2">
                                <i className="fas fa-plus"></i> Advantages
                            </h4>
                            <ul className="space-y-2">
                                {(supp.benefits || []).map((b, i) => (
                                    <li key={i} className="text-xs text-gray-300 flex items-start gap-2">
                                        <div className="w-1 h-1 bg-green-500 rounded-full mt-1.5 shrink-0"></div>
                                        {b}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="glass-liquid p-4 rounded-[24px] border-red-500/20">
                            <h4 className="text-[9px] uppercase font-black text-red-400 mb-3 tracking-widest flex items-center gap-2">
                                <i className="fas fa-shield-virus"></i> Contra-indications
                            </h4>
                            <ul className="space-y-2">
                                {(supp.side_effects || []).map((s, i) => (
                                    <li key={i} className="text-xs text-gray-300 flex items-start gap-2">
                                        <div className="w-1 h-1 bg-red-500 rounded-full mt-1.5 shrink-0"></div>
                                        {s}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-[60px] -mr-12 -mt-12 pointer-events-none opacity-20 ${accentColor}`}></div>
        </div>
    );
  };

  return (
    <div className="space-y-6 pb-10">
      <header className="flex items-center justify-between px-1">
        <div>
            <h2 className="text-3xl font-black text-white tracking-tighter">Stack</h2>
            <p className="text-[9px] text-gray-500 font-black mt-0.5 uppercase tracking-[0.2em]">{profile.goal} Optimized</p>
        </div>
        <button onClick={generateStack} disabled={loading} className="w-12 h-12 rounded-[20px] bg-white/[0.04] border border-white/10 flex items-center justify-center text-primary transition-all haptic-press shadow-lg">
          <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-dna'} text-xl`}></i>
        </button>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-6 animate-fade-in">
            <div className="w-14 h-14 border-[3px] border-primary/10 border-t-primary rounded-full animate-spin"></div>
            <p className="text-white font-black text-[10px] tracking-[0.3em] uppercase animate-pulse">Synthesizing Protocol</p>
        </div>
      ) : (
        <div className="space-y-8">
            <div className="space-y-4">
                <div className="flex items-center gap-3 pl-1">
                    <span className="text-[9px] text-primary font-black uppercase tracking-[0.3em]">Tier 1 Essentials</span>
                    <div className="h-px bg-white/5 flex-1"></div>
                </div>
                {(stack || []).filter(s => s.priority === 'Essential').map((supp, i) => 
                    renderSuppCard(supp, i, 'bg-primary', 'bg-primary/20 text-primary border-primary/30')
                )}
            </div>

            <div className="space-y-4">
                <div className="flex items-center gap-3 pl-1">
                    <span className="text-[9px] text-accent font-black uppercase tracking-[0.3em]">Performance Tier</span>
                    <div className="h-px bg-white/5 flex-1"></div>
                </div>
                {(stack || []).filter(s => s.priority === 'Performance' || s.priority === 'Optional').map((supp, i) => 
                    renderSuppCard(supp, i + 100, 'bg-accent', 'bg-accent/20 text-accent border-accent/30')
                )}
            </div>
            
            <footer className="glass-liquid p-5 rounded-[24px] flex gap-3 items-start border border-blue-500/15">
                <i className="fas fa-shield-alt text-accent text-base mt-0.5"></i>
                <p className="text-[10px] text-gray-400 leading-relaxed font-bold italic">
                    AI WARNING: Indexed for {profile.weight}kg metabolic weight. Consult healthcare professionals before deploying.
                </p>
            </footer>
        </div>
      )}
    </div>
  );
};

export default SupplementAdvisor;
