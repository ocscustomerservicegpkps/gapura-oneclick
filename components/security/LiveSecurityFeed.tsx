'use client';

import { useEffect, useState } from 'react';
import { Activity, Globe, Clock, Fingerprint } from 'lucide-react';
import type { SecurityEvent } from '@/types/security';
import { PrettyPayload } from './PrettyPayload';

export function LiveSecurityFeed({ className }: { className?: string }) {
    const [events, setEvents] = useState<SecurityEvent[]>([]);

    useEffect(() => {
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | undefined;

        async function fetchLastEvents(): Promise<void> {
            const requestController = new AbortController();
            const requestTimeout = setTimeout(() => requestController.abort(), 8_000);
            try {
                const response = await fetch('/api/security/events', {
                    cache: 'no-store',
                    signal: requestController.signal,
                });
                if (!cancelled) {
                    if (response.ok) {
                        const payload = await response.json() as { events?: SecurityEvent[] };
                        setEvents(payload.events || []);
                    } else {
                        console.error(`[Security Feed] Poll failed with status ${response.status}`);
                    }
                }
            } catch (error) {
                if (!cancelled) {
                    console.error('[Security Feed] Poll failed:', error);
                }
            } finally {
                clearTimeout(requestTimeout);
                if (!cancelled) {
                    timer = setTimeout(fetchLastEvents, 10_000);
                }
            }
        }

        void fetchLastEvents();

        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
        };
    }, []);

    return (
        <div className={`bg-slate-900 rounded-3xl p-8 text-white shadow-2xl space-y-6 relative overflow-hidden flex flex-col ${className}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/20 rounded-lg">
                        <Activity className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold">Live Telemetry Feed</h3>
                        <p className="text-xs text-white/60">Real-time raw event influx from system boundaries</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <span className="text-[10px] font-bold text-emerald-500 uppercase">Stream Active</span>
                </div>
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar relative">
                {}
                <div className="absolute inset-0 pointer-events-none opacity-[0.03] mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />

                {events.map((event) => (
                        <div
                            key={event.created_at + event.id}
                            className="relative group overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <div className="relative bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-2xl p-4 flex items-start gap-4 transition-all duration-300 group-hover:bg-white/[0.07] group-hover:border-white/20 group-hover:translate-x-1">
                                <div className={`mt-1 p-2.5 rounded-xl shadow-inner transition-transform duration-500 group-hover:rotate-12 ${
                                    event.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/20' :
                                    event.severity === 'HIGH' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/20' :
                                    'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'
                                }`}>
                                    {event.event_type === 'login' ? <Fingerprint className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
                                </div>

                                <div className="flex-1 min-w-0 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/90">
                                                {event.event_type}
                                            </span>
                                            <div className="h-1 w-1 rounded-full bg-white/20" />
                                            <span className="text-[10px] text-white/60 font-mono tracking-tight">{event.source}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border tracking-wider ${
                                                event.severity === 'CRITICAL' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.1)]' : 
                                                event.severity === 'HIGH' ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' :
                                                'bg-white/5 border-white/10 text-white/40'
                                            }`}>
                                                {event.severity}
                                            </span>
                                            <div className="flex items-center gap-1.5 text-[10px] text-white/40 font-mono">
                                                <Clock className="w-3 h-3" />
                                                {new Date(event.created_at).toLocaleTimeString([], { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <span className="text-[11px] font-mono text-white/70 flex items-center gap-1.5">
                                            <Activity className="w-3 h-3 opacity-50" />
                                            {event.ip_address || 'system-internal'}
                                        </span>
                                        <PrettyPayload payload={event.payload} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
            </div>
        </div>
    );
}
