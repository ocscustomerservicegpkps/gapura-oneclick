'use client';

import { forwardRef, HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type GlassVariant = 'default' | 'frosted' | 'solid';

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
    variant?: GlassVariant;
    padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
    hover?: boolean;
    glow?: boolean;
    children: ReactNode;
}

const variantStyles: Record<GlassVariant, string> = {
    default: `
        bg-[var(--glass-bg)]
        backdrop-blur-[var(--glass-blur)]
        border border-[var(--glass-border)]
    `,
    frosted: `
        bg-[oklch(100%_0_0_/_0.5)]
        backdrop-blur-[30px]
        border border-[oklch(100%_0_0_/_0.4)]
    `,
    solid: `
        bg-[var(--surface-3)]
        border border-[var(--border-subtle)]
    `,
};

const paddingStyles = {
    none: '',
    sm: 'p-[var(--space-sm)]',
    md: 'p-[var(--space-md)]',
    lg: 'p-[var(--space-lg)]',
    xl: 'p-[var(--space-xl)]',
};

const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
    (
        {
            variant = 'default',
            padding = 'lg',
            hover = true,
            glow = false,
            className,
            children,
            ...props
        },
        ref
    ) => {
        return (
            <div
                ref={ref}
                className={cn(

                    'relative overflow-hidden',
                    'rounded-[var(--radius-2xl)]',
                    'shadow-[var(--shadow-elevated)]',
                    'transition-all duration-[var(--duration-normal)] ease-[var(--spring-snappy)]',

                    'container-query',

                    variantStyles[variant],

                    paddingStyles[padding],

                    hover && 'hover:shadow-[var(--shadow-neutral-lg)] hover:-translate-y-1 hover:scale-[1.01]',

                    glow && 'hover:shadow-[0_0_40px_oklch(55%_0.25_260_/_0.2)]',
                    className
                )}
                {...props}
            >
                {}
                <div
                    className="absolute inset-0 pointer-events-none opacity-[0.03] z-0"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
                    }}
                    aria-hidden="true"
                />

                {}
                <div className="relative z-10">{children}</div>
            </div>
        );
    }
);

GlassCard.displayName = 'GlassCard';

export { GlassCard };
export type { GlassCardProps, GlassVariant };
