'use client';

import { type ReactNode } from 'react';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PresentationSlideProps {
    title?: string;
    subtitle?: string;
    icon?: LucideIcon;
    children: ReactNode;
    className?: string;
    hint?: string;
    style?: React.CSSProperties;
}

export function PresentationSlide({
    title,
    subtitle,
    icon: Icon,
    children,
    className,
    hint,
    style,
}: PresentationSlideProps) {
    return (
        <section
            style={style}
            className={cn(
                'bg-white rounded-2xl shadow-sm border border-[var(--surface-4)] p-6 lg:p-8 min-h-[40vh] snap-start',
                className
            )}
        >
            {(title || subtitle) && (
                <div className="flex items-center gap-3 mb-6">
                    {Icon && (
                        <div
                            className="p-2.5 rounded-xl"
                            style={{ background: 'oklch(0.55 0.18 160 / 0.1)' }}
                        >
                            <Icon size={20} style={{ color: 'var(--brand-primary)' }} />
                        </div>
                    )}
                    <div>
                        {title && (
                            <h2 className="text-lg lg:text-xl font-bold text-[var(--text-primary)]">
                                {title}
                            </h2>
                        )}
                        {subtitle && (
                            <p className="text-xs text-[var(--text-muted)]">{subtitle}</p>
                        )}
                    </div>
                </div>
            )}

            {children}

            {hint && (
                <p className="text-[10px] text-[var(--text-muted)] text-center mt-6 opacity-60">
                    {hint}
                </p>
            )}
        </section>
    );
}
