'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ShieldAlert, ShieldCheck, Activity, Users, Globe, Lock, AlertTriangle } from 'lucide-react';
import { SecurityStats, SecurityAlert, AuthMetrics, NetworkStatus } from '@/types/security';
import { LiveSecurityFeed } from '@/components/security/LiveSecurityFeed';
import { ThreatActorAnalysis } from '@/components/security/ThreatActorAnalysis';
import { ActiveSessions } from '@/components/security/ActiveSessions';
import { ThreatActor } from '@/types/security';
import dynamic from 'next/dynamic';

const ThreatPatternHeatMap = dynamic(
    () => import('@/components/security/ThreatPatternHeatMap').then(m => m.ThreatPatternHeatMap),
    { ssr: false, loading: () => <div className="h-64 bg-slate-50 animate-pulse rounded-3xl" /> }
);

export default function SecurityDashboardPage() {
    const [data, setData] = useState<{
        stats: SecurityStats;
        alerts: SecurityAlert[];
        auth: AuthMetrics;
        network: NetworkStatus;
        threatActors: ThreatActor[];
        isDemo?: boolean;
    } | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const acknowledgeAlert = async (alertId: string) => {
        setActionLoading(alertId);
        try {
            const res = await fetch('/api/security/actions/alert-control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alertId, action: 'ACKNOWLEDGE' })
            });
            if (res.ok) {
                const { status } = await res.json();
                setData(prev => prev ? {
                    ...prev,
                    alerts: prev.alerts.map(a => a.id === alertId ? { ...a, status } : a)
                } : null);
            }
        } finally {
            setActionLoading(null);
        }
    };

    const toggleBlockIp = async (ip: string, action: 'BLOCK' | 'UNBLOCK') => {
        setActionLoading(ip);
        try {
            const res = await fetch('/api/security/actions/ip-control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ip, action })
            });
            if (res.ok) {
                setData(prev => prev ? {
                    ...prev,
                    threatActors: prev.threatActors.map(a => a.ip === ip ? { ...a, status: action === 'BLOCK' ? 'BLOCKED' : 'ACTIVE' } : a)
                } : null);
            }
        } finally {
            setActionLoading(null);
        }
    };

    useEffect(() => {
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | undefined;

        // `security_alerts`/`security_events` are RLS-locked for the anon
        // client (no reachable SELECT policy), so a Postgres Realtime
        // `postgres_changes` subscription here would silently receive zero
        // events. Poll the same dashboard-data endpoint instead, mirroring
        // LiveSecurityFeed's fetch-on-interval pattern.
        async function fetchMetrics(isInitial: boolean) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8_000);
            if (isInitial) setLoading(true);
            try {
                const res = await fetch('/api/security/dashboard-data', { signal: controller.signal, cache: 'no-store' });
                if (!cancelled && res.ok) {
                    const json = await res.json();
                    setData(json);
                }
            } catch (err) {
                if (cancelled) return;
                if (err instanceof DOMException && err.name === 'AbortError') return;
                console.error('Security metrics poll failed', err);
            } finally {
                clearTimeout(timeout);
                if (!cancelled) {
                    if (isInitial) setLoading(false);
                    timer = setTimeout(() => fetchMetrics(false), 15_000);
                }
            }
        }

        fetchMetrics(true);

        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
        };
    }, []);

    if (loading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <motion.div 
                    animate={{ scale: [1, 1.1, 1], rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="p-8 rounded-full bg-emerald-500/10 border border-emerald-500/20"
                >
                    <Shield className="w-12 h-12 text-emerald-500" />
                </motion.div>
            </div>
        );
    }

    if (!data) return <div className="p-12 text-center text-gray-500">Access Denied or System Offline.</div>;

    const healthScore = data.stats.vulnerabilityScore;

    return (
        <div className="space-y-8 p-6 md:p-10 overflow-hidden w-full">
            {}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-2">
                    <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-2 text-emerald-500 font-medium tracking-wider text-xs uppercase"
                    >
                        <Lock className="w-3 h-3" />
                        Admin Security Protocol v3
                    </motion.div>
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 flex items-center gap-4">
                        Security <span className="text-slate-400 font-light italic">Intelligence</span>
                        <div className="flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                             <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Live</span>
                        </div>
                        {data.isDemo && (
                            <motion.span 
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-[10px] bg-amber-500 text-white px-3 py-1 rounded-full uppercase tracking-[0.2em] font-black shadow-lg shadow-amber-500/20"
                            >
                                Demo Mode
                            </motion.span>
                        )}
                    </h1>
                </div>

                {}
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="relative group cursor-pointer"
                >
                    <div className="absolute inset-0 bg-emerald-500 blur-2xl opacity-10 group-hover:opacity-20 transition-opacity" />
                    <div className="relative flex items-center gap-4 bg-white/80 backdrop-blur-xl border border-white/20 shadow-2xl rounded-2xl p-4 pr-8">
                        <div className="relative w-14 h-14 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle
                                    cx="28" cy="28" r="24"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                    fill="transparent"
                                    className="text-gray-100"
                                />
                                <motion.circle
                                    cx="28" cy="28" r="24"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                    fill="transparent"
                                    strokeDasharray={150.7}
                                    initial={{ strokeDashoffset: 150.7 }}
                                    animate={{ strokeDashoffset: 150.7 * (1 - healthScore / 100) }}
                                    transition={{ duration: 1.5, ease: "easeOut" }}
                                    className="text-emerald-500"
                                />
                            </svg>
                            <span className="absolute text-sm font-bold text-slate-700">{healthScore}%</span>
                        </div>
                        <div>
                            <div className="text-xs text-slate-400 font-medium uppercase tracking-widest">System Health</div>
                            <div className="text-lg font-bold text-slate-800">Operational Good</div>
                        </div>
                    </div>
                </motion.div>
            </div>

            {}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-20">

                {}
                <div className="lg:col-span-3 space-y-8">
                    {}
                    <div className="space-y-6">
                        <StatCard 
                            title="Blocked Attacks" 
                            value={data.stats.totalBlocked} 
                            icon={<ShieldAlert className="text-rose-500" />}
                            trend="+12% vs last 24h"
                            color="oklch(0.65 0.25 20)"
                        />
                         <StatCard 
                            title="Intrusion Attempts" 
                            value={data.stats.intrusionAttempts} 
                            icon={<Activity className="text-amber-500" />}
                            trend="-5% vs last 24h"
                            color="oklch(0.7 0.2 60)"
                        />
                        <StatCard 
                            title="Malware Detected" 
                            value={data.stats.malwareDetected} 
                            icon={<AlertTriangle className="text-red-600" />}
                            trend="Stable"
                            color="oklch(0.6 0.2 30)" 
                        />
                    </div>

                    {}
                    <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl border border-white/5">
                        <div className="absolute top-0 right-0 p-6 opacity-10">
                            <Users className="w-16 h-16" />
                        </div>
                        <div className="relative z-10 space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-bold text-white/90">Auth Pulse</h3>
                                <span className="text-[9px] font-black text-emerald-400 border border-emerald-400/30 px-2 py-0.5 rounded-full">LIVE</span>
                            </div>
                            <div className="space-y-4">
                                <AuthItem label="Failed Logins" value={data.auth.failedAttempts} color="text-rose-400" />
                                <AuthItem label="Suspicious Action" value={data.auth.suspiciousActivities} color="text-amber-400" />
                                <div className="pt-4 border-t border-white/10">
                                    <div className="text-[9px] text-white/30 uppercase tracking-[0.2em] font-black mb-1">Threat Origin</div>
                                    <div className="text-lg font-medium text-white/80">{data.auth.lastAttackOrigin}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {}
                    <div className="bg-emerald-50 rounded-3xl p-8 border border-emerald-100 shadow-xl space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-emerald-500/10 rounded-2xl">
                                <ShieldCheck className="text-emerald-600 w-5 h-5" />
                            </div>
                            <h3 className="text-base font-bold text-slate-800">Compliance</h3>
                        </div>
                        <div className="space-y-4">
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-600 font-medium italic">Patch Health</span>
                                <span className="font-bold text-emerald-700">{((data.stats.patchStatusCount / data.stats.totalSystems) * 100).toFixed(1)}%</span>
                            </div>
                            <div className="h-2.5 bg-emerald-200/50 rounded-full overflow-hidden">
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(data.stats.patchStatusCount / data.stats.totalSystems) * 100}%` }}
                                    transition={{ duration: 1.5, delay: 0.5 }}
                                    className="h-full bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {}
                <div className="lg:col-span-6 space-y-8">
                    {}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                                <Globe className="w-5 h-5 text-indigo-500" />
                                Threat Propagation Matrix
                            </h2>
                            <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Low</div>
                                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-500" /> High</div>
                            </div>
                        </div>
                        <ThreatPatternHeatMap events={data.alerts} />
                    </div>

                    {}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <h2 className="text-xl font-black text-slate-800 tracking-tight">System Intervention Required</h2>
                            <button className="text-[10px] font-black text-emerald-600 hover:text-emerald-700 transition-colors uppercase tracking-[0.2em] px-4 py-2 bg-emerald-50 rounded-full border border-emerald-100">Audit Flow</button>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <AnimatePresence>
                                {data.alerts.slice(0, 6).map((alert, idx) => (
                                    <IncidentCard key={alert.id} alert={alert} index={idx} onAcknowledge={acknowledgeAlert} />
                                ))}
                            </AnimatePresence>
                        </div>
                    </div>

                    {}
                    <div className="space-y-4">
                         <div className="flex items-center justify-between px-2">
                            <h2 className="text-xl font-black text-slate-800 tracking-tight">Threat Actor Analysis</h2>
                            <span className="text-[10px] bg-rose-500/10 text-rose-600 px-3 py-1 rounded-full font-bold uppercase tracking-widest border border-rose-500/10">High Correlation</span>
                        </div>
                        <ThreatActorAnalysis 
                            actors={data.threatActors || []} 
                            onToggleBlock={toggleBlockIp}
                            actionLoading={actionLoading}
                        />
                    </div>

                    {}
                    <div className="space-y-4">
                        <ActiveSessions />
                    </div>
                </div>

                {}
                <div className="lg:col-span-3 space-y-8">
                     {}
                    <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-xl space-y-6 relative overflow-hidden group">
                        <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-colors" />
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-indigo-50 rounded-2xl">
                                <Globe className="text-indigo-600 w-5 h-5 shadow-inner" />
                            </div>
                            <h3 className="text-base font-bold text-slate-800">Traffic Node</h3>
                        </div>
                        <div className="space-y-6">
                            <div>
                                <div className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-1">Inbound Stream</div>
                                <div className="text-3xl font-black text-slate-800 tracking-tighter">{(data.network.trafficIn / 1e6).toFixed(1)} <span className="text-xs font-light text-slate-400 tracking-normal ml-1">Mbps</span></div>
                            </div>
                            <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                                <div className="text-[9px] text-slate-400 uppercase font-black tracking-widest">Active Nodes</div>
                                <div className="text-xl font-bold text-indigo-600">{data.network.activeConnections.toLocaleString()}</div>
                            </div>
                        </div>
                    </div>

                    {}
                    <div className="h-[calc(100vh-280px)] min-h-[600px] sticky top-8">
                        <LiveSecurityFeed className="h-full" />
                    </div>
                </div>

            </div>
        </div>
    );
}

function StatCard({ title, value, icon, trend, color }: { title: string, value: number, icon: React.ReactNode, trend: string, color: string }) {
    return (
        <motion.div 
            whileHover={{ y: -5 }}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-lg space-y-4 transition-all"
        >
            <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-2xl bg-slate-50">
                    {icon}
                </div>
                <div className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md uppercase tracking-wider">{trend}</div>
            </div>
            <div>
                <div className="text-sm font-medium text-slate-400 tracking-wide uppercase">{title}</div>
                <div className="text-3xl font-black text-slate-800 mt-1">{value.toLocaleString()}</div>
            </div>
            <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                 <motion.div 
                    initial={{ x: '-100%' }}
                    animate={{ x: '0%' }}
                    transition={{ duration: 1, delay: 0.2 }}
                    className="h-full" 
                    style={{ backgroundColor: color }} 
                />
            </div>
        </motion.div>
    );
}

function AuthItem({ label, value, color }: { label: string, value: number, color: string }) {
    return (
        <div className="flex items-center justify-between hover:bg-white/5 p-2 rounded-xl transition-colors group">
            <span className="text-sm text-white/50 group-hover:text-white/80 transition-colors uppercase tracking-widest text-[10px] font-bold">{label}</span>
            <span className={`text-xl font-bold ${color}`}>{value}</span>
        </div>
    );
}

function IncidentCard({ alert, index, onAcknowledge }: { alert: SecurityAlert, index: number, onAcknowledge: (id: string) => void }) {
    const severityColors = {
        CRITICAL: 'bg-rose-500 text-white border-rose-600',
        HIGH: 'bg-orange-500 text-white border-orange-600',
        MEDIUM: 'bg-amber-400 text-slate-900 border-amber-500',
        LOW: 'bg-blue-400 text-white border-blue-500'
    };

    return (
        <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xl group hover:shadow-2xl transition-all border-l-4"
            style={{ borderLeftColor: alert.severity === 'CRITICAL' ? '#f43f5e' : alert.severity === 'HIGH' ? '#f97316' : '#fbbf24' }}
        >
            <div className="flex items-start justify-between mb-4">
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${severityColors[alert.severity]}`}>
                    {alert.severity}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">15m ago</span>
            </div>
            <h4 className="text-lg font-bold text-slate-800 mb-2 group-hover:text-emerald-600 transition-colors">{alert.title}</h4>
            <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed mb-6">{alert.description}</p>
            <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-500">I</div>
                    <span className="text-xs font-semibold text-slate-600 italic">Incident ID: {alert.id.slice(0, 8)}</span>
                </div>
                <button 
                    onClick={() => onAcknowledge(alert.id)}
                    disabled={alert.status === 'INVESTIGATING' || alert.status === 'RESOLVED'}
                    className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${
                        alert.status === 'INVESTIGATING' ? 'text-amber-500' : 
                        alert.status === 'RESOLVED' ? 'text-emerald-500' : 
                        'text-slate-400 hover:text-rose-500 cursor-pointer'
                    }`}
                >
                    {alert.status === 'INVESTIGATING' ? 'Acknowledged' : alert.status === 'RESOLVED' ? 'Resolved' : 'Acknowledge'}
                </button>
            </div>
        </motion.div>
    );
}
