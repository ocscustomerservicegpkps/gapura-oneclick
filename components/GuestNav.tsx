
'use client';

import Image from 'next/image';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { QrCode, ClipboardList, BookOpen, ChevronUp, Menu as MenuIcon, Bot, Monitor, Lock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { QuickAccessPasswordModal } from '@/components/QuickAccessPasswordModal';
import { useExternalLinks } from '@/lib/hooks/useExternalLinks';
import { getLinkUrl } from '@/lib/external-links';

type GuestItemBase = {

    label: string;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    icon: any;
};

type GuestLinkItem = GuestItemBase & { href: string; action?: never; protected?: boolean; external?: boolean };

type GuestActionItem = GuestItemBase & { href?: never; action: () => void; protected?: never };

type GuestItem = GuestLinkItem | GuestActionItem;

const isLinkItem = (item: GuestItem): item is GuestLinkItem => 'href' in item && !!item.href;

export default function GuestNav({ hideSidebar = false, hideMobileNav = false }: { hideSidebar?: boolean; hideMobileNav?: boolean }) {
    const pathname = usePathname();
    const [expanded, setExpanded] = useState(false);

    const [modal, setModal] = useState<{ label: string; href: string; external: boolean } | null>(null);

    const externalLinks = useExternalLinks();

    const items: GuestItem[] = [
        {
            label: 'AI Chatbot',
            icon: Bot,
            href: '/virtual-assistant',
        },
        {
            label: 'Chat Bot I\'m In Charge',
            icon: Bot,
            href: getLinkUrl(externalLinks, 'chat-bot-openai'),
            external: true,
            protected: true,
        },
        {
            label: 'Customer Feedback JOUMPA',
            icon: QrCode,
            href: '/auth/joumpa',
        },
        {
            label: 'Survey Penumpang',
            icon: QrCode,
            href: '/auth/survey-penumpang',
        },
        {
            label: 'Staff JOUMPA Report',
            icon: ClipboardList,
            href: getLinkUrl(externalLinks, 'staff-joumpa-report'),
            external: true,
        },
        {
            label: 'Pengisian Inspeksi Report SLA',
            icon: ClipboardList,
            href: '/auth/sla',
        },
        {
            label: 'Handbook SLA',
            icon: BookOpen,
            href: getLinkUrl(externalLinks, 'handbook-sla'),
            external: true,
            protected: true,
        },
        {
            label: 'WSN Dashboard',
            icon: Monitor,
            href: '/dashboard/ocs/wsn',
            protected: true,
        },
        {
            label: 'HSSE Report',
            icon: AlertTriangle,
            href: getLinkUrl(externalLinks, 'hsse-report-guestnav'),
            external: true,
            protected: true,
        },
    ];

    const handleItemClick = (item: GuestItem, e: React.MouseEvent) => {
        if ('protected' in item && item.protected && item.href) {
            e.preventDefault();
            setModal({ label: item.label, href: item.href, external: item.external ?? false });
        }
    };

    const renderDesktopLink = (item: GuestItem) => {
        const Icon = item.icon;
        const isProtectedItem = isLinkItem(item) && item.protected;

        if (isLinkItem(item)) {
            const isExternal = item.external || /^https?:\/\//i.test(item.href);
            return (
                <a
                    key={item.label}
                    href={item.href}
                    target={isExternal && !isProtectedItem ? '_blank' : undefined}
                    rel={isExternal ? 'noopener noreferrer' : undefined}
                    onClick={(e) => handleItemClick(item, e)}
                    className="flex items-start gap-3 px-3 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] transition-colors"
                >
                    <Icon size={16} className="text-[var(--text-muted)] mt-0.5 shrink-0" />
                    <span className="whitespace-normal break-words leading-snug flex-1">{item.label}</span>
                    {isProtectedItem && <Lock size={12} className="text-[var(--text-muted)] mt-0.5 shrink-0" />}
                </a>
            );
        }
        return (
            <button
                key={item.label}
                onClick={(item as GuestActionItem).action}
                className="w-full flex items-start gap-3 px-3 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] transition-colors"
            >
                <Icon size={16} className="text-[var(--text-muted)] mt-0.5" />
                <span className="whitespace-normal break-words leading-snug text-left">{item.label}</span>
            </button>
        );
    };

    const renderMobileTile = (item: GuestItem) => {
        const Icon = item.icon;
        const isProtectedItem = isLinkItem(item) && item.protected;
        const isActive = isLinkItem(item) && !item.external &&
            (pathname === item.href || pathname.startsWith(item.href + '/'));

        const Tile = (
            <div
                className={cn(
                    'flex flex-col items-center justify-center gap-1.5 px-2 py-2 rounded-xl transition-all',
                    isActive
                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                        : 'bg-white/80 text-gray-700 ring-1 ring-black/5 hover:ring-gray-300 active:scale-95'
                )}
            >
                <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-white/80 ring-1 ring-black/5">
                    <Icon size={18} className={cn(isActive ? 'text-emerald-600' : 'text-gray-600')} />
                    {isProtectedItem && (
                        <Lock size={9} className="absolute -top-1 -right-1 text-gray-400" />
                    )}
                </div>
                <span
                    className="block text-[11px] font-semibold tracking-wide leading-[1.15] text-center whitespace-normal break-words"
                    style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                    }}
                >
                    {item.label}
                </span>
            </div>
        );

        if (isLinkItem(item)) {
            return (
                <a
                    key={item.label}
                    href={item.href}
                    target={item.external && !isProtectedItem ? '_blank' : undefined}
                    rel={item.external ? 'noopener noreferrer' : undefined}
                    className="no-underline"
                    onClick={(e) => handleItemClick(item, e)}
                >
                    {Tile}
                </a>
            );
        }
        return (
            <button
                key={item.label}
                onClick={(item as GuestActionItem).action}
                className="appearance-none bg-transparent p-0 border-0"
            >
                {Tile}
            </button>
        );
    };

    return (
        <>
            {}

            {}
            {modal && (
                <QuickAccessPasswordModal
                    isOpen
                    onClose={() => setModal(null)}
                    label={modal.label}
                    href={modal.href}
                    external={modal.external}
                />
            )}

            {}
            {!hideSidebar && (
                <aside className="hidden md:flex fixed top-0 left-0 h-screen w-[240px] border-r border-dashed border-gray-200 bg-[var(--surface-1)] z-30">
                    <div className="flex flex-col w-full">
                        <div className="p-5 border-b border-dashed border-gray-200 flex items-center justify-center">
                            <Image
                                src="/logo.png"
                                alt="Gapura"
                                width={140}
                                height={48}
                                className="object-contain"
                                style={{ width: 'auto', height: 'auto' }}
                                priority
                            />
                        </div>
                        <div className="px-4 py-5 flex-1 overflow-y-auto">
                            <div className="mb-3 px-2">
                                <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Quick Access</h3>
                            </div>
                            <div className="space-y-1">
                                {items.map(renderDesktopLink)}
                            </div>
                        </div>
                        <div className="p-3 border-t border-dashed border-gray-200 text-center text-[10px] text-[var(--text-muted)]">
                            OneClick - Guest Mode
                        </div>
                    </div>
                </aside>
            )}

            {}
            {!hideMobileNav && (
                <div className="md:hidden fixed inset-x-0 bottom-0 z-50 pointer-events-none">
                    <div className="mx-4 mb-[calc(env(safe-area-inset-bottom,0)+0.75rem)] pointer-events-auto">
                        <nav
                            data-hide-mobile-nav
                            className={cn(
                                'relative rounded-2xl px-2 py-2',
                                'backdrop-blur-xl border border-white/40 shadow-[0_8px_40px_rgba(0,0,0,0.12)]',
                                'bg-[linear-gradient(180deg,rgba(255,255,255,0.85)_0%,rgba(250,250,250,0.75)_100%)]'
                            )}
                            aria-label="Guest Navigation"
                        >
                            {!expanded ? (
                                <button
                                    onClick={() => setExpanded(true)}
                                    className={cn(
                                        'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl',
                                        'bg-white/90 backdrop-blur border border-white/60 shadow-sm',
                                        'active:scale-[0.99] transition-all'
                                    )}
                                    aria-label="Buka MENU"
                                >
                                    <MenuIcon size={16} className="text-emerald-700" />
                                    <span className="text-[12px] font-extrabold tracking-[0.2em] text-emerald-700">MENU</span>
                                </button>
                            ) : (
                                <>
                                    <div className="absolute -top-[1px] left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent pointer-events-none" />
                                    <div className="flex items-center justify-between px-1 pb-1">
                                        <span className="text-[10px] font-black tracking-[0.25em] text-emerald-700">MENU</span>
                                        <button
                                            onClick={() => setExpanded(false)}
                                            className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-white/80 ring-1 ring-black/5 active:scale-95 transition-all"
                                            aria-label="Close menu"
                                        >
                                            <ChevronUp size={16} className="text-emerald-700 rotate-0" />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 px-1">
                                        {items.map(renderMobileTile)}
                                    </div>
                                </>
                            )}
                        </nav>
                    </div>
                </div>
            )}
        </>
    );
}
