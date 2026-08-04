'use client';

import { forwardRef, InputHTMLAttributes, useState, useId } from 'react';
import { cn } from '@/lib/utils';

interface PrismInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
    label?: string;
    error?: string;
    hint?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    size?: 'sm' | 'md' | 'lg';
}

const sizeStyles = {
    sm: 'py-2 px-3 text-[var(--text-sm)]',
    md: 'py-3 px-4 text-[var(--text-base)]',
    lg: 'py-4 px-5 text-[var(--text-lg)]',
};

const PrismInput = forwardRef<HTMLInputElement, PrismInputProps>(
    (
        {
            label,
            error,
            hint,
            leftIcon,
            rightIcon,
            size = 'md',
            className,
            id,
            ...props
        },
        ref
    ) => {
        const [isFocused, setIsFocused] = useState(false);
        const generatedId = useId();
        const inputId = id || generatedId;
        const hasValue = Boolean(props.value || props.defaultValue);
        const isLabelFloating = isFocused || hasValue;

        return (
            <div className="relative w-full">
                {}
                <div className="relative">
                    {}
                    {leftIcon && (
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none z-10">
                            {leftIcon}
                        </div>
                    )}

                    {}
                    <input
                        ref={ref}
                        id={inputId}
                        onFocus={(e) => {
                            setIsFocused(true);
                            props.onFocus?.(e);
                        }}
                        onBlur={(e) => {
                            setIsFocused(false);
                            props.onBlur?.(e);
                        }}
                        className={cn(

                            'w-full',
                            'bg-[var(--surface-3)]',
                            'border-2 rounded-[var(--radius-xl)]',
                            'font-[var(--font-body)]',
                            'text-[var(--text-primary)]',
                            'placeholder:text-transparent',
                            'transition-all duration-[var(--duration-normal)] ease-[var(--spring-snappy)]',

                            sizeStyles[size],

                            leftIcon && 'pl-12',
                            rightIcon && 'pr-12',

                            label && 'pt-6 pb-2',

                            error
                                ? 'border-[var(--status-error)] focus:border-[var(--status-error)] focus:shadow-[0_0_0_4px_oklch(60%_0.22_25_/_0.15)]'
                                : 'border-[var(--border-subtle)] hover:border-[var(--border-medium)] focus:border-[var(--brand-primary)] focus:shadow-[0_0_0_4px_var(--border-focus)]',
                            'focus:outline-none',
                            className
                        )}
                        {...props}
                    />

                    {}
                    {label && (
                        <label
                            htmlFor={inputId}
                            className={cn(
                                'absolute left-4 pointer-events-none',
                                'font-[var(--font-display)] font-medium',
                                'transition-all duration-[var(--duration-fast)] ease-[var(--spring-snappy)]',
                                leftIcon && 'left-12',
                                isLabelFloating
                                    ? 'top-2 text-[var(--text-xs)] text-[var(--brand-primary)]'
                                    : 'top-1/2 -translate-y-1/2 text-[var(--text-base)] text-[var(--text-muted)]',
                                error && isLabelFloating && 'text-[var(--status-error)]'
                            )}
                        >
                            {label}
                        </label>
                    )}

                    {}
                    {rightIcon && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                            {rightIcon}
                        </div>
                    )}
                </div>

                {}
                {error && (
                    <p className="mt-2 text-[var(--text-sm)] text-[var(--status-error)] font-medium animate-spring-up">
                        {error}
                    </p>
                )}

                {}
                {hint && !error && (
                    <p className="mt-2 text-[var(--text-xs)] text-[var(--text-muted)]">
                        {hint}
                    </p>
                )}
            </div>
        );
    }
);

PrismInput.displayName = 'PrismInput';

export { PrismInput };
export type { PrismInputProps };
