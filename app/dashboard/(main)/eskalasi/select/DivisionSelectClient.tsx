'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { mutate } from 'swr';
import { logoutWithPwaCleanup } from '@/lib/pwa/logout';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
    Plane, BookOpen, GraduationCap, Shield,
    ArrowRight
} from 'lucide-react';

const divisionCards = [
    {
        code: 'OP',
        name: 'Operational Monitoring',
        description: 'Reports of Ground Handling, JOUMPA Services, GSE Performance and CGO Cargo',
        icon: Plane,
        gradient: 'from-cyan-500 via-cyan-600 to-teal-600',
        hoverShadow: 'hover:shadow-cyan-500/25',
        divisionLabel: 'UQ, HT, OP, OT & OS Division',
    },
    {
        // green Customer Service card — only shown to OCS division (and eskalasi).
        code: 'OCS',
        name: 'Customer Service Center',
        description: 'Services Reports',
        icon: Shield,
        gradient: 'from-emerald-500 via-emerald-600 to-teal-600',
        hoverShadow: 'hover:shadow-emerald-500/25',
        divisionLabel: 'OCS Division',
    },
    {
        code: 'HT',
        name: 'Performance Evaluation Monitoring',
        description: 'Quality Assessment Monitoring and Service Recovery',
        icon: GraduationCap,
        gradient: 'from-sky-500 via-blue-600 to-indigo-600',
        hoverShadow: 'hover:shadow-sky-500/25',
        divisionLabel: 'All Divisions',
        href: '/dashboard/eskalasi/performance-links',
    },
    {
        code: 'DOCUMENTS',
        name: 'Circulars & Materials',
        description: 'Manage and distribute HC documents to stations',
        icon: BookOpen,
        gradient: 'from-violet-500 via-purple-600 to-fuchsia-600',
        hoverShadow: 'hover:shadow-violet-500/25',
        divisionLabel: 'Head Office & All Stations',
        href: '/dashboard/eskalasi/documents',
    },
];

const ROLE_DIVISION: Record<string, string> = {
    DIVISI_OCS: 'OCS',
    DIVISI_OS: 'OS',
    DIVISI_OP: 'OP',
    DIVISI_OT: 'OT',
    DIVISI_UQ: 'UQ',
    DIVISI_HT: 'HT',
};

interface DivisionSelectClientProps {
    role: string;
    division: string | null;
}

export function DivisionSelectClient({ role, division }: DivisionSelectClientProps) {
    const [error, setError] = useState<string | null>(null);
    const [switchingCode, setSwitchingCode] = useState<string | null>(null);
    const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
    const router = useRouter();

    const isEskalasi = role === 'DIVISI_ESKALASI';
    const myDivision = ROLE_DIVISION[role] ?? division ?? null;
    // Green Customer Service card is visible to eskalasi and to OCS division only.
    // Role/division come from the session cookie resolved server-side, so there's
    // no client fetch in flight and thus no flash/reappear race.
    const showGreen = isEskalasi || myDivision === 'OCS';

    const visibleCards = useMemo(
        () => divisionCards.filter((card) => card.code !== 'OCS' || showGreen),
        [showGreen]
    );

    useEffect(() => {
        visibleCards.forEach((card) => {
            router.prefetch(card.href ?? `/dashboard/${card.code.toLowerCase()}`);
        });
    }, [router, visibleCards]);

    const switchDivision = async (code: string) => {
        try {
            setError(null);
            setSwitchingCode(code);

            const res = await fetch('/api/auth/switch-division', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ divisionCode: code }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data?.error || `Failed to switch to Division ${code}`);
            }

            // Sidebar's "Back to Workspace" button reads /api/auth/bundle (cached by
            // SWR with a 5-minute dedupe and no revalidateOnFocus/Reconnect) to decide
            // whether to show the real button or a plain link that skips restoring the
            // eskalasi session. The sidebar never remounts across this navigation, so
            // without this invalidation it keeps serving the pre-switch bundle, the
            // fallback link renders, and returning to /dashboard/eskalasi/select never
            // switches back to the eskalasi account — hiding the OCS-only green card.
            void mutate('/api/auth/bundle');

            const redirectPath = data?.redirectPath || `/dashboard/${code.toLowerCase()}`;
            router.replace(redirectPath);
            router.refresh();
        } catch (err) {
            console.error('Failed to switch division:', err);
            setError(err instanceof Error ? err.message : 'Failed to switch division account');
            setSwitchingCode(null);
        }
    };

    const handleCardClick = (code: string) => {
        setError(null);

        const card = divisionCards.find((item) => item.code === code);
        if (card?.href) {
            router.push(card.href);
            return;
        }

        // Eskalasi switches into the underlying division account; division users
        // already are that division and just navigate to the dashboard.
        if (isEskalasi) {
            void switchDivision(code === 'OCS' ? 'OCS' : 'OP');
            return;
        }

        if (code === 'OP') {
            router.push('/dashboard/op');
            return;
        }

        if (code === 'OCS') {
            router.push('/dashboard/ocs');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex flex-col">
            <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-10 md:mb-14"
                >
                    <h1 className="text-3xl md:text-5xl font-display font-extrabold text-gray-900 tracking-tight mb-3">
                        Choose Workspace
                    </h1>
                    <p className="text-gray-500 text-base md:text-lg max-w-md mx-auto">
                        Select the module you want to open
                    </p>
                </motion.div>

                <div className="w-full max-w-4xl">
                    {error && (
                        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                        {visibleCards.map((card, index) => {
                            const Icon = card.icon;
                            const isSwitching = switchingCode === card.code;
                            return (
                                <motion.button
                                    key={card.code}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    onClick={() => handleCardClick(card.code)}
                                    disabled={Boolean(switchingCode)}
                                    className={`
                                        relative group overflow-hidden
                                        bg-white rounded-2xl md:rounded-3xl
                                        border border-gray-100 shadow-sm
                                        p-6 md:p-8 text-left
                                        transition-all duration-300
                                        hover:shadow-xl hover:scale-[1.02] hover:-translate-y-1
                                        disabled:opacity-60 disabled:hover:scale-100 disabled:hover:translate-y-0
                                        ${card.hoverShadow}
                                    `}
                                >
                                    <div className={`
                                        absolute inset-0 opacity-0 group-hover:opacity-5
                                        bg-gradient-to-br ${card.gradient}
                                        transition-opacity duration-300
                                    `} />

                                    <div className="relative z-10">
                                        <div className={`
                                            inline-flex items-center justify-center
                                            w-12 h-12 md:w-14 md:h-14 rounded-full mb-4
                                            bg-gradient-to-br ${card.gradient}
                                            shadow-lg
                                        `}>
                                            <Icon className="w-6 h-6 md:w-7 md:h-7 text-white" />
                                        </div>

                                        <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
                                            {card.name}
                                            <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-1 transition-all" />
                                        </h3>

                                        <p className="text-sm text-gray-500">
                                            {card.description}
                                        </p>

                                        {card.divisionLabel ? (
                                            <div className="mt-4 pt-4 border-t border-gray-100">
                                                <span className={`
                                                    inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold
                                                    bg-gradient-to-r ${card.gradient} bg-clip-text text-transparent
                                                `}>
                                                    {isSwitching ? 'Opening...' : card.divisionLabel}
                                                </span>
                                            </div>
                                        ) : null}
                                    </div>
                                </motion.button>
                            );
                        })}
                        <motion.button
                            key="signout"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: visibleCards.length * 0.1 }}
                            onClick={() => setLogoutConfirmOpen(true)}
                            className={`
                                relative group overflow-hidden
                                bg-white rounded-2xl md:rounded-3xl
                                border border-gray-100 shadow-sm
                                p-6 md:p-8 text-left
                                transition-all duration-300
                                hover:shadow-xl hover:scale-[1.02] hover:-translate-y-1
                                hover:shadow-rose-500/25
                            `}
                        >
                            <div className={`
                                absolute inset-0 opacity-0 group-hover:opacity-5
                                bg-gradient-to-br from-rose-500 via-red-600 to-orange-600
                                transition-opacity duration-300
                            `} />
                            <div className="relative z-10">
                                <div className={`
                                    inline-flex items-center justify-center
                                    w-12 h-12 md:w-14 md:h-14 rounded-full mb-4
                                    bg-gradient-to-br from-rose-500 via-red-600 to-orange-600
                                    shadow-lg
                                `}>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 md:w-7 md:h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                                </div>
                                <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
                                    Sign Out
                                </h3>
                                <p className="text-sm text-gray-500">
                                    Sign out of your account
                                </p>
                            </div>
                        </motion.button>
                    </div>
                </div>

                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="mt-10 text-sm text-gray-400"
                >
                    Click a division card to continue
                </motion.p>
            </div>

            <ConfirmDialog
                open={logoutConfirmOpen}
                title="Sign out of your account?"
                confirmLabel="Sign Out"
                danger
                onConfirm={() => { setLogoutConfirmOpen(false); logoutWithPwaCleanup(); }}
                onCancel={() => setLogoutConfirmOpen(false)}
            />
        </div>
    );
}
