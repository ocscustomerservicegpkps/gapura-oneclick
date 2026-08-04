'use client';

import { motion } from 'framer-motion';
import { ShieldAlert, ShieldX, ShieldCheck, Globe } from 'lucide-react';
import { ThreatActor } from '@/types/security';

interface ThreatActorAnalysisProps {
    actors: ThreatActor[];
    onToggleBlock: (ip: string, action: 'BLOCK' | 'UNBLOCK') => void;
    actionLoading: string | null;
}

export function ThreatActorAnalysis({ actors, onToggleBlock, actionLoading }: ThreatActorAnalysisProps) {
    return (
        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-xl space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-slate-800">Threat Actor Analysis</h3>
                    <p className="text-xs text-slate-400">High-risk IP addresses detected by boundary sensors</p>
                </div>
                <div className="p-2 bg-slate-50 rounded-xl">
                    <ShieldAlert className="w-5 h-5 text-rose-500" />
                </div>
            </div>

            <div className="space-y-4">
                {actors.length === 0 && (
                    <div className="text-center py-8 text-slate-400 text-sm italic">
                        No active threats detected in this window.
                    </div>
                )}
                {actors.map((actor, idx) => (
                    <motion.div 
                        key={actor.ip}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl group border border-transparent hover:border-slate-200 transition-all"
                    >
                        <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-xl ${actor.status === 'BLOCKED' ? 'bg-rose-100' : 'bg-white shadow-sm'}`}>
                                <Globe className={`w-4 h-4 ${actor.status === 'BLOCKED' ? 'text-rose-500' : 'text-slate-400'}`} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-sm font-bold text-slate-700">{actor.ip}</span>
                                    {actor.status === 'BLOCKED' && (
                                        <span className="text-[8px] font-black uppercase tracking-widest text-white bg-rose-500 px-1.5 py-0.5 rounded-sm">Blocked</span>
                                    )}
                                </div>
                                <div className="text-[10px] text-slate-400 font-medium">Seen {actor.eventCount} times • Last seen {new Date(actor.lastSeen).toLocaleTimeString()}</div>
                            </div>
                        </div>

                        <div className="flex items-center gap-6">
                            <div className="text-right hidden sm:block">
                                <div className="text-[10px] text-slate-400 uppercase font-black mb-1.5 tracking-wider">Risk Index</div>
                                <div className="flex items-center gap-3">
                                    <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden p-[1px] shadow-inner">
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${Math.min(100, actor.riskScore)}%` }}
                                            transition={{ type: 'spring', stiffness: 50, damping: 20 }}
                                            className={`h-full rounded-full shadow-sm ${
                                                actor.riskScore > 70 ? 'bg-gradient-to-r from-rose-400 to-rose-600' : 
                                                actor.riskScore > 30 ? 'bg-gradient-to-r from-orange-400 to-orange-500' : 
                                                'bg-gradient-to-r from-emerald-400 to-emerald-500'
                                            }`}
                                        />
                                    </div>
                                    <span className="text-xs font-black text-slate-800 tabular-nums">{Math.min(100, actor.riskScore)}</span>
                                </div>
                            </div>

                            <motion.button 
                                whileHover={{ scale: 1.1, rotate: actor.status === 'BLOCKED' ? -5 : 5 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => onToggleBlock(actor.ip, actor.status === 'BLOCKED' ? 'UNBLOCK' : 'BLOCK')}
                                disabled={actionLoading === actor.ip}
                                className={`p-3 rounded-2xl transition-shadow shadow-sm hover:shadow-md ${
                                    actor.status === 'BLOCKED' 
                                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                                        : 'bg-rose-50 text-rose-600 border border-rose-100'
                                }`}
                                title={actor.status === 'BLOCKED' ? "De-escalate & Unblock" : "Neutralize & Block IP"}
                            >
                                {actionLoading === actor.ip ? (
                                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                ) : actor.status === 'BLOCKED' ? (
                                    <ShieldCheck className="w-5 h-5" />
                                ) : (
                                    <ShieldX className="w-5 h-5" />
                                )}
                            </motion.button>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
