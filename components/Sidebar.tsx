
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { LogOut, Menu, Undo2, UserCog, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect, useMemo, memo, useCallback } from 'react';

import { resolveNavGroups, type NavGroupConfig as NavGroup } from '@/lib/nav-config';
import { CommentNotificationBell } from '@/components/dashboard/CommentNotificationBell';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { performOptimisticLogout } from '@/lib/auth/client-logout';
import { useStaticData } from '@/lib/swr';
import { isSidebarNavItemActive } from '@/lib/sidebar-nav-active';

declare global {
    interface Window {
        toggleMobileSidebar: () => void;
    }
}

interface NavContentProps {

    groups: NavGroup[];

    pathname: string;

    searchParams: URLSearchParams;

    role: string;

    onLogout: () => void;

    onReturnToOrigin: () => void;

    canReturnToOrigin: boolean;

    loading: boolean;

    switchingOrigin: boolean;

    showBell: boolean;

    setMobileOpen: (value: boolean) => void;

    /** Signed-in user's own name; falls back to the role label until it loads. */
    displayName: string | null;
}

const ROLE_DISPLAY: Record<string, string> = {
    DIVISI_OS: 'Unit Service', DIVISI_OCS: 'Unit Service', DIVISI_OT: 'Operational Service', DIVISI_UQ: 'Operational Service',
    PARTNER_OS: 'Unit Service',
    DIVISI_OP: 'Operational Service',
    PARTNER_OP: 'Operational Service',
    DIVISI_HT: 'HT Division',
    PARTNER_HT: 'HT Division',
    DIVISI_HC: 'Employee',
    PARTNER_HC: 'Employee',
    DIVISI_ESKALASI: 'Escalation',
    MANAGER_CABANG: 'Station Manager',
    STAFF_CABANG: 'Station Staff',
    SUPER_ADMIN: 'Super Admin',
    ANALYST: 'Analyst',
};

function resolveRoleDisplayName(role: string): string {
    const upper = role.toUpperCase();
    return ROLE_DISPLAY[upper] ?? role.replace(/_/g, ' ');
}

const NavContent = memo(function NavContent({
    groups,
    pathname,
    searchParams,
    role,
    onLogout,
    onReturnToOrigin,
    canReturnToOrigin,
    loading,
    switchingOrigin,
    showBell,
    setMobileOpen,
    displayName
}: NavContentProps) {
    const roleLabel = resolveRoleDisplayName(role);
    const primaryName = displayName || roleLabel;
    const isProfileActive = pathname === '/dashboard/settings/profile';
    return (<div className="flex flex-col h-full bg-[var(--surface-1)] text-[var(--text-primary)]">
        <div className="p-4 border-b border-dashed border-gray-200 flex justify-center md:p-6 md:pb-6">
             <Image
                src="/logo.png"
                alt="Gapura Logo"
                width={180}
                height={60}
                className="object-contain w-[120px] md:w-[140px]"
                style={{ width: 'auto', height: 'auto' }}
                priority
            />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 md:px-4 md:py-6 touch-scroll hide-scrollbar">
            <div className="space-y-6 md:space-y-8">
                {groups.map((group) => (
                    <div key={group.title} className="relative">
                        <div className="flex items-center gap-2 px-2 mb-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] opacity-50" />
                            <h3 className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                                {group.title}
                            </h3>
                        </div>

                        <div className="relative pl-2.5 ml-1 border-l border-dashed border-gray-200 space-y-0.5 md:space-y-1">
                            {group.items.map((link, index) => {
                                const isExternal = link.external || /^https?:\/\//.test(link.href);
                                const isActive = !isExternal && isSidebarNavItemActive({
                                    href: link.href,
                                    pathname,
                                    reportsViewSelected: searchParams.get('view') === 'reports',
                                    siblingItems: group.items,
                                });
                                const Icon = link.icon;
                                const itemKey = `${group.title}:${link.label}:${link.href}:${index}`;
                                if (link.comingSoon) {
                                    return (
                                        <button
                                            key={itemKey}
                                            type="button"
                                            onClick={() => {
                                                setMobileOpen(false);
                                                alert('Feature is in development');
                                            }}
                                            className="block w-full text-left relative group pl-4"
                                        >
                                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-px bg-gray-200 group-hover:bg-gray-400 transition-colors" />
                                            <div
                                                className={cn(
                                                    "relative flex items-center gap-2 md:gap-3 px-2.5 md:px-3 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-all duration-200",
                                                    "text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-secondary)]",
                                                    "hover:translate-x-1"
                                                )}
                                            >
                                                <Icon size={14} className="shrink-0 text-[var(--text-muted)] md:size-4" />
                                                <span className="flex-1">{link.label}</span>
                                                <span className="rounded-md bg-[var(--surface-3)] px-1.5 py-0.5 text-[8px] md:text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                                                    Soon
                                                </span>
                                            </div>
                                        </button>
                                    );
                                }
                                return isExternal ? (
                                    <a
                                        key={itemKey}
                                        href={link.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={() => setMobileOpen(false)}
                                        className="block relative group pl-4"
                                    >
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-px bg-gray-200 group-hover:bg-gray-400 transition-colors" />
                                        <div
                                            className={cn(
                                                "relative flex items-center gap-2 md:gap-3 px-2.5 md:px-3 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-all duration-200",
                                                "text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]",
                                                "hover:translate-x-1"
                                            )}
                                        >
                                            <Icon size={14} className="shrink-0 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] md:size-4" />
                                            <span className="flex-1">{link.label}</span>
                                        </div>
                                    </a>
                                ) : (
                                    <Link
                                        key={itemKey}
                                        href={link.href}
                                        onClick={() => setMobileOpen(false)}
                                        className="block relative group pl-4"
                                    >
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-px bg-gray-200 group-hover:bg-gray-400 transition-colors" />

                                        <div
                                            className={cn(
                                                "relative flex items-center gap-2 md:gap-3 px-2.5 md:px-3 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-all duration-200",
                                                isActive
                                                    ? "bg-[var(--surface-2)] text-[var(--text-primary)] shadow-sm ring-1 ring-gray-200"
                                                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]",
                                                "hover:translate-x-1"
                                            )}
                                        >
                                            <Icon size={14} className={cn(
                                                "shrink-0 md:size-4",
                                                isActive ? "text-[var(--brand-primary)]" : "text-[var(--text-muted)] group-hover:text-[var(--text-primary)]"
                                            )} />

                                            <span className="flex-1">{link.label}</span>

                                            {link.count && (
                                                <span className="px-1.5 py-0.5 rounded-md bg-[var(--surface-3)] font-mono text-[9px] md:text-[10px] font-bold tabular-nums text-[var(--text-secondary)]">
                                                    {link.count}
                                                </span>
                                            )}

                                            {isActive && (
                                                 <div
                                                    className="absolute right-2 w-1.5 h-1.5 rounded-full bg-[var(--brand-primary)]"
                                                 />
                                            )}
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </nav>

        <div className="p-3 border-t border-dashed border-gray-200 bg-[var(--surface-1)] md:p-4">
             <div className="bg-[var(--surface-2)] rounded-xl p-2.5 md:p-3 border border-gray-100 shadow-sm relative">
                {/* The identity row IS the way into profile settings — the
                    conventional place users look, instead of a separate button
                    competing with Sign Out. */}
                <div className="flex items-center gap-1 mb-2 md:mb-3">
                    <Link
                        href="/dashboard/settings/profile"
                        onClick={() => setMobileOpen(false)}
                        aria-label="Open profile settings"
                        aria-current={isProfileActive ? 'page' : undefined}
                        className={cn(
                            "group/user flex min-w-0 flex-1 items-center gap-2 md:gap-3 rounded-lg p-1 -m-1 transition-colors",
                            isProfileActive ? "bg-[var(--surface-3)]" : "hover:bg-[var(--surface-3)]"
                        )}
                    >
                        <div className="relative shrink-0">
                            <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-[10px] md:text-xs font-bold text-white shadow-sm">
                                {primaryName.charAt(0).toUpperCase()}
                            </div>
                            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[var(--surface-2)]" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[11px] md:text-xs font-bold text-[var(--text-primary)] truncate group-hover/user:text-[var(--brand-primary)] transition-colors">
                                {primaryName}
                            </p>
                            <p className="text-[9px] md:text-[10px] text-[var(--text-muted)] truncate">{roleLabel}</p>
                        </div>
                        <UserCog
                            size={14}
                            className={cn(
                                "shrink-0 transition-colors",
                                isProfileActive
                                    ? "text-[var(--brand-primary)]"
                                    : "text-[var(--text-muted)] group-hover/user:text-[var(--brand-primary)]"
                            )}
                        />
                    </Link>
                    {showBell && <CommentNotificationBell role={role} />}
                </div>

                {role.startsWith('DIVISI_') && (
                    canReturnToOrigin ? (
                        <button
                            onClick={onReturnToOrigin}
                            disabled={switchingOrigin || loading}
                            className="group/back w-full mb-1.5 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs md:text-sm font-bold text-white bg-gradient-to-br from-orange-500 to-amber-600 border border-orange-600/30 shadow-[0_4px_12px_rgba(249,115,22,0.35)] hover:shadow-[0_6px_18px_rgba(249,115,22,0.45)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[0_2px_8px_rgba(249,115,22,0.35)] transition-all duration-200 disabled:opacity-60"
                        >
                            <Undo2 size={16} className="shrink-0 transition-transform duration-200 group-hover/back:-translate-x-0.5" />
                            {switchingOrigin ? '...' : 'Back to Workspace'}
                        </button>
                    ) : (
                        <Link
                            href="/dashboard/eskalasi/select"
                            onClick={() => setMobileOpen(false)}
                            className="group/back w-full mb-1.5 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs md:text-sm font-bold text-white bg-gradient-to-br from-orange-500 to-amber-600 border border-orange-600/30 shadow-[0_4px_12px_rgba(249,115,22,0.35)] hover:shadow-[0_6px_18px_rgba(249,115,22,0.45)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[0_2px_8px_rgba(249,115,22,0.35)] transition-all duration-200"
                        >
                            <Undo2 size={16} className="shrink-0 transition-transform duration-200 group-hover/back:-translate-x-0.5" />
                            Back to Workspace
                        </Link>
                    )
                )}

                <button
                    onClick={onLogout}
                    disabled={loading || switchingOrigin}
                    className="w-full flex items-center justify-center gap-1.5 md:gap-2 py-1.5 rounded-lg text-[9px] md:text-[10px] font-bold uppercase tracking-wide text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors"
                >
                    <LogOut size={12} />
                    {loading ? '...' : 'Sign Out'}
                </button>
             </div>
        </div>
    </div>
);
});

export default function Sidebar({ role, division }: { role: string; division?: string | null }) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [switchingOrigin, setSwitchingOrigin] = useState(false);

    const { data: bundleInfo } = useStaticData<{
        active: string | null;
        origin: string | null;
        accounts: Array<{
            id: string;
            role: string;
            isCurrent: boolean;
            isOrigin: boolean;
        }>;
    } | null>(role ? '/api/auth/bundle' : null);

    // /api/auth/me resolves the ACTIVE account, so an escalation user who has
    // switched into another workspace sees that account's name here.
    const { data: currentUser } = useStaticData<{ full_name?: string | null }>(
        role ? '/api/auth/me' : null
    );

    const isOcsOrOs = role === 'DIVISI_OCS' || role === 'PARTNER_OCS' || role === 'DIVISI_OS' || role === 'PARTNER_OS';

    // ponytail: OCS/OS users keep their Schedule/calendar links only off Operational
    // Monitoring (/dashboard/operasional) and off the shared create-report page when it was
    // opened in ground-handling mode (not ?type=joumpa) — otherwise navigating there
    // from Operational Monitoring would snap the sidebar back to Customer Service.
    // Calendar stays visible on their own All Reports list — it's a real nav item,
    // not something tied to the ground-handling report view.
    const isOnOperationalMonitoring = isOcsOrOs && pathname.startsWith('/dashboard/operasional');
    const isOnOperationalCreateReport = isOcsOrOs
        && pathname === '/dashboard/employee/new' && searchParams.get('type') !== 'joumpa';
    const isOperationalContext = isOnOperationalMonitoring || isOnOperationalCreateReport;
    const hideSchedule = isOcsOrOs && isOperationalContext;

    const groups = useMemo(() => {
        const base = resolveNavGroups(role || '', division);
        const withoutSchedule = hideSchedule ? base.filter((g) => g.title !== 'Schedule') : base;

        // The nav config is fixed per role, so "Dashboard"/"All Reports" always
        // point at the user's own division. While actually browsing Operational
        // Monitoring (or filing a ground-handling report from it), repoint those
        // two links at /dashboard/operasional so they don't yank the user back to their
        // own Customer Service dashboard mid-browse.
        if (!isOperationalContext) return withoutSchedule;
        return withoutSchedule.map((group) => group.title !== 'Monitoring' ? group : {
            ...group,
            items: group.items.map((item) => ({
                ...item,
                href: item.label === 'Dashboard' ? '/dashboard/operasional'
                    : item.label === 'All Reports' ? '/dashboard/operasional/reports'
                    : item.href,
            })),
        });
    }, [role, division, hideSchedule, isOperationalContext]);
    // Non-OCS analysts lose the comment-notification bell along with their other OCS-only features.
    const showBell = !(role === 'ANALYST' && (division || '').toUpperCase() !== 'OCS');

    const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
    const handleLogout = useCallback(() => {
        setLogoutConfirmOpen(true);
    }, []);
    const confirmLogout = useCallback(() => {
        setLogoutConfirmOpen(false);
        setLoading(true);
        void performOptimisticLogout();
    }, []);

    const handleReturnToOrigin = useCallback(async () => {
        if (!bundleInfo?.origin) return;

        try {
            setSwitchingOrigin(true);
            const res = await fetch('/api/auth/switch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: bundleInfo.origin }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error || 'Failed to switch back to escalation');
            }

            router.push('/dashboard/eskalasi/select');
            router.refresh();
        } catch (error) {
            console.error('Failed to switch back to eskalasi:', error);
            setSwitchingOrigin(false);
            window.alert(error instanceof Error ? error.message : 'Failed to switch back to escalation');
        }
    }, [bundleInfo?.origin, router]);

    const canReturnToOrigin = Boolean(
        bundleInfo?.origin &&
        bundleInfo?.active &&
        bundleInfo.origin !== bundleInfo.active
    );

    const navContentProps = useMemo(() => ({
        groups,
        pathname,
        searchParams,
        role,
        displayName: currentUser?.full_name?.trim() || null,
        onLogout: handleLogout,
        onReturnToOrigin: handleReturnToOrigin,
        canReturnToOrigin,
        loading,
        switchingOrigin,
        showBell,
        setMobileOpen
    }), [groups, pathname, searchParams, role, currentUser, handleLogout, handleReturnToOrigin, canReturnToOrigin, loading, switchingOrigin, showBell]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.toggleMobileSidebar = () => setMobileOpen(prev => !prev);
        }
    }, []);

    const isEskalasi = role === 'DIVISI_ESKALASI';
    // ponytail: collapse to mobile nav below xl (1280) so portrait tablets
    // (e.g. iPad 820px, iPad Pro 12.9" @ 1024px) get the bottom nav, not the
    // squeezed desktop sidebar. lg (1024) used to be the cutoff, but iPad Pro
    // portrait is exactly 1024px wide so it matched lg: and wrongly got the sidebar.
    // NOTE: breakpoint prefix must be a literal `xl:` string — Tailwind's
    // scanner can't see classes built via `${var}:block` template interpolation,
    // so an interpolated prefix silently never generates the override rule.

    return (
        <>
            <div className={cn('xl:hidden fixed top-4 left-4 z-50', isEskalasi ? '' : 'pointer-events-none opacity-0')} aria-hidden={!isEskalasi}>
                <button
                    onClick={() => setMobileOpen(true)}
                    aria-label="Open menu"
                    tabIndex={isEskalasi ? 0 : -1}
                    className="p-2.5 bg-white rounded-xl shadow-md border border-gray-200 text-[var(--text-primary)] active:scale-95 transition-transform"
                >
                    <Menu size={20} />
                </button>
            </div>

            {}
            <div
                className={cn('fixed inset-0 bg-black/20 backdrop-blur-sm z-40 xl:hidden transition-opacity duration-300', mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none')}
                onClick={() => setMobileOpen(false)}
            />
            <div
                className={cn('fixed inset-y-0 left-0 w-[280px] max-w-[85vw] z-50 shadow-2xl xl:hidden transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]', mobileOpen ? 'translate-x-0' : '-translate-x-full')}
            >
                 <NavContent {...navContentProps} />
                  <button
                    onClick={() => setMobileOpen(false)}
                    className="absolute top-3 right-3 p-1.5 bg-[var(--surface-2)] rounded-lg text-[var(--text-muted)] active:bg-[var(--surface-3)]"
                >
                    <X size={16} />
                </button>
            </div>

            <div className="hidden xl:block fixed top-0 left-0 h-screen w-[240px] lg:w-[260px] z-40 border-r border-dashed border-gray-200 shadow-[2px_0_24px_rgba(0,0,0,0.02)]">
                <NavContent {...navContentProps} />
            </div>

            <ConfirmDialog
                open={logoutConfirmOpen}
                title="Sign out of your account?"
                confirmLabel="Sign Out"
                danger
                onConfirm={confirmLogout}
                onCancel={() => setLogoutConfirmOpen(false)}
            />
        </>
    );
}
