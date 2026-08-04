'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, Monitor, Shield, X, MapPin, Clock } from 'lucide-react';

interface Session {
    id: string;
    ip: string;
    ua: string;
    device: string;
    lastActive: string;
    isCurrent: boolean;
}

export function ActiveSessions() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSessions();
    }, []);

    const fetchSessions = async () => {
        try {
            const res = await fetch('/api/security/sessions');
            const data = await res.json();
            setSessions(data.sessions || []);
        } catch (err) {
            console.error('Failed to load sessions', err);
        } finally {
            setLoading(false);
        }
    };

    const handleRevoke = async (id: string) => {
        try {

            setSessions(prev => prev.filter(s => s.id !== id));

            const res = await fetch('/api/security/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: id })
            });
            if (!res.ok) throw new Error('revoke failed');
        } catch (err) {
            console.error('Failed to revoke session', err);
            fetchSessions();
        }
    };

    if (loading) return (
        <div className="h-64 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden p-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Shield className="w-5 h-5 text-emerald-500" />
                        Active Sessions
                    </h3>
                    <p className="text-sm text-slate-400">Manage authenticated devices and account access</p>
                </div>
            </div>

            <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                    {sessions.map((session) => (
                        <motion.div
                            key={session.id}
                            layout
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className={`p-6 rounded-2xl border transition-all duration-300 relative group
                                ${session.isCurrent ? 'bg-emerald-50/50 border-emerald-100 ring-1 ring-emerald-500/20' : 'bg-slate-50/50 border-slate-100 hover:border-slate-200'}
                            `}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex gap-4">
                                    <div className={`p-3 rounded-xl ${session.isCurrent ? 'bg-emerald-500 text-white' : 'bg-white shadow-sm text-slate-400'}`}>
                                        {session.ua.includes('Mobi') ? <Smartphone className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-800 text-base">{session.device}</span>
                                            {session.isCurrent && (
                                                <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-widest">
                                                    Current
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
                                            <span className="flex items-center gap-1">
                                                <MapPin className="w-3 h-3" /> {session.ip}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" /> Active {new Date(session.lastActive).toLocaleTimeString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {!session.isCurrent && (
                                    <button
                                        onClick={() => handleRevoke(session.id)}
                                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all duration-300 opacity-70 sm:opacity-0 sm:group-hover:opacity-100"
                                        title="Revoke Session"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {sessions.length === 0 && (
                    <div className="text-center py-12 text-slate-400 font-medium italic">
                        No active sessions found.
                    </div>
                )}
            </div>
        </div>
    );
}
