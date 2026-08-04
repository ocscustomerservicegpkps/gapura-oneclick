'use client';

import { FileText, Clock, CheckCircle2, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TimePeriodFilter, type TimePeriod } from './TimePeriodFilter';

interface DashboardHeaderProps {
    title: string;
    subtitle?: string;
    totalReports: number;
    pendingReports: number;
    resolvedReports: number;
    period: TimePeriod;
    onPeriodChange: (period: TimePeriod, from?: string, to?: string) => void;
    onCardClick?: (filter: 'all' | 'pending' | 'resolved') => void;
    className?: string;
}

interface StatCardProps {
    label: string;
    value: number;
    icon: LucideIcon;
    variant: 'default' | 'warning' | 'success';
    onClick?: () => void;
}

function StatCard({ label, value, icon: Icon, variant, onClick }: StatCardProps) {
    const variantStyles = {
        default: {
            bg: 'bg-white/95',
            iconBg: 'bg-emerald-100',
            iconColor: 'text-emerald-600',
            labelColor: 'text-slate-600',
            valueColor: 'text-slate-900',
        },
        warning: {
            bg: 'bg-white/95',
            iconBg: 'bg-amber-100',
            iconColor: 'text-amber-600',
            labelColor: 'text-slate-600',
            valueColor: 'text-slate-900',
        },
        success: {
            bg: 'bg-white/95',
            iconBg: 'bg-teal-100',
            iconColor: 'text-teal-600',
            labelColor: 'text-slate-600',
            valueColor: 'text-slate-900',
        },
    };
    const styles = variantStyles[variant];

    return (
        <button
            onClick={onClick}
            className={cn(
                'flex-1 min-w-[160px] rounded-2xl p-5 text-left transition-all duration-300',
                'hover:scale-[1.02] hover:shadow-lg',
                'backdrop-blur-xl border border-white/20',
                styles.bg
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                    <p className={cn('text-xs font-semibold uppercase tracking-wider', styles.labelColor)}>
                        {label}
                    </p>
                    <h3 className={cn('text-3xl font-bold mt-2 tabular-nums', styles.valueColor)}>
                        {value.toLocaleString('id-ID')}
                    </h3>
                </div>
                <div className={cn('p-3 rounded-xl', styles.iconBg)}>
                    <Icon size={22} className={styles.iconColor} />
                </div>
            </div>
        </button>
    );
}

export function DashboardHeader({
    title,
    subtitle,
    totalReports,
    pendingReports,
    resolvedReports,
    period,
    onPeriodChange,
    onCardClick,
    className,
}: DashboardHeaderProps) {
    return (
        <div 
            className={cn(
                'relative overflow-hidden rounded-3xl p-8',
                'bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-400',
                className
            )}
        >
            {}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-32 -left-20 w-80 h-80 bg-teal-300/20 rounded-full blur-3xl" />
            </div>

            {}
            <div className="relative z-10">
                {}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
                            {title}
                        </h1>
                        {subtitle && (
                            <p className="text-emerald-100/80 text-sm mt-1 font-medium">
                                {subtitle}
                            </p>
                        )}
                    </div>
                    <TimePeriodFilter value={period} onChange={onPeriodChange} />
                </div>

                {}
                <div className="flex flex-col sm:flex-row gap-4">
                    <StatCard
                        label="Total Reports"
                        value={totalReports}
                        icon={FileText}
                        variant="default"
                        onClick={() => onCardClick?.('all')}
                    />
                    <StatCard
                        label="Feedback Not Yet Given"
                        value={pendingReports}
                        icon={Clock}
                        variant="warning"
                        onClick={() => onCardClick?.('pending')}
                    />
                    <StatCard
                        label="Resolved"
                        value={resolvedReports}
                        icon={CheckCircle2}
                        variant="success"
                        onClick={() => onCardClick?.('resolved')}
                    />
                </div>
            </div>
        </div>
    );
}
