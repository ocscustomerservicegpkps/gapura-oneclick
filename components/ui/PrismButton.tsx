'use client';

import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface PrismButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    isLoading?: boolean;
    leftIcon?: ReactNode;
    rightIcon?: ReactNode;
    iconOnly?: boolean;
    children: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
    primary: `
        bg-gradient-to-br from-[var(--brand-gradient-start)] to-[var(--brand-gradient-end)]
        text-[var(--text-on-brand)]
        shadow-[var(--shadow-brand-sm)]
        hover:shadow-[var(--shadow-brand-md)]
        hover:-translate-y-[3px] hover:scale-[1.02]
        active:translate-y-[-1px] active:scale-[0.98]
    `,
    secondary: `
        bg-[var(--surface-2)]
        text-[var(--text-primary)]
        hover:bg-[var(--surface-4)]
        hover:-translate-y-[2px]
    `,
    outline: `
        bg-transparent
        border-2 border-[var(--border-medium)]
        text-[var(--text-primary)]
        hover:border-[var(--brand-primary)]
        hover:text-[var(--brand-primary)]
        hover:-translate-y-[2px]
    `,
    ghost: `
        bg-transparent
        text-[var(--text-secondary)]
        hover:bg-[var(--surface-2)]
        hover:text-[var(--text-primary)]
    `,
    danger: `
        bg-gradient-to-br from-[var(--status-error)] to-[oklch(55%_0.22_25)]
        text-[var(--text-on-brand)]
        shadow-[0_2px_8px_-2px_oklch(60%_0.22_25_/_0.3)]
        hover:shadow-[0_8px_24px_-4px_oklch(60%_0.22_25_/_0.4)]
        hover:-translate-y-[3px] hover:scale-[1.02]
        active:translate-y-[-1px] active:scale-[0.98]
    `,
};

const sizeStyles: Record<ButtonSize, string> = {
    sm: 'px-[var(--space-sm)] py-[var(--gap-xs)] text-[var(--text-xs)] rounded-[var(--radius-lg)]',
    md: 'px-[var(--space-lg)] py-[var(--space-sm)] text-[var(--text-sm)] rounded-[var(--radius-xl)]',
    lg: 'px-[var(--space-xl)] py-[var(--space-md)] text-[var(--text-base)] rounded-[var(--radius-2xl)]',
};

const iconOnlyStyles: Record<ButtonSize, string> = {
    sm: 'w-8 h-8 p-0 grid place-items-center',
    md: 'w-10 h-10 p-0 grid place-items-center',
    lg: 'w-12 h-12 p-0 grid place-items-center',
};

const PrismButton = forwardRef<HTMLButtonElement, PrismButtonProps>(
    (
        {
            variant = 'primary',
            size = 'md',
            isLoading = false,
            leftIcon,
            rightIcon,
            iconOnly = false,
            children,
            className,
            disabled,
            ...props
        },
        ref
    ) => {
        const isDisabled = disabled || isLoading;

        return (
            <button
                ref={ref}
                disabled={isDisabled}
                className={cn(

                    'inline-flex items-center justify-center gap-[var(--gap-sm)]',
                    'font-[var(--font-display)] font-semibold',
                    'cursor-pointer border-none',
                    'transition-all duration-[var(--duration-normal)]',
                    'ease-[var(--spring-snappy)]',

                    variantStyles[variant],
                    iconOnly ? iconOnlyStyles[size] : sizeStyles[size],

                    isDisabled && 'opacity-50 cursor-not-allowed transform-none hover:transform-none',
                    className
                )}
                {...props}
            >
                {}
                {isLoading && (
                    <svg
                        className="animate-spin h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                    </svg>
                )}

                {}
                {!isLoading && leftIcon && (
                    <span className="flex-shrink-0">{leftIcon}</span>
                )}

                {}
                <span>{children}</span>

                {}
                {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
            </button>
        );
    }
);

PrismButton.displayName = 'PrismButton';

export { PrismButton };
export type { PrismButtonProps, ButtonVariant, ButtonSize };
