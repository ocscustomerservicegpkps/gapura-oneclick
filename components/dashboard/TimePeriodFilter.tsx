'use client';

import { useId, useState } from 'react';
import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TimePeriod = '7d' | '30d' | '3m' | '6m' | 'custom' | null;

interface TimePeriodFilterProps {
    value: TimePeriod;
    onChange: (period: TimePeriod, from?: string, to?: string) => void;
    className?: string;
}

const PERIOD_OPTIONS: { value: TimePeriod; label: string }[] = [
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: '3m', label: '3 Months' },
    { value: '6m', label: '6 Months' },
];

export function TimePeriodFilter({ value, onChange, className }: TimePeriodFilterProps) {
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const idPrefix = useId();
    const fromId = `${idPrefix}-from`;
    const toId = `${idPrefix}-to`;
    const datePickerId = `${idPrefix}-date-picker`;
    const isInvertedRange = Boolean(fromDate && toDate && fromDate > toDate);

    const handlePeriodClick = (period: TimePeriod) => {
        setShowDatePicker(false);
        if (period === value) {
            onChange(null);
        } else {
            onChange(period);
        }
    };

    const handleCustomApply = () => {
        if (fromDate && toDate && !isInvertedRange) {
            onChange('custom', fromDate, toDate);
            setShowDatePicker(false);
        }
    };

    return (
        <div className={cn('flex items-center gap-2 flex-wrap', className)}>
            {PERIOD_OPTIONS.map((opt) => (
                <button
                    key={opt.value}
                    onClick={() => handlePeriodClick(opt.value)}
                    aria-pressed={value === opt.value}
                    className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                        value === opt.value
                            ? 'bg-white text-emerald-700 shadow-sm'
                            : 'text-white/80 hover:text-white hover:bg-white/15'
                    )}
                >
                    {opt.label}
                </button>
            ))}

            <div className="relative">
                <button
                    onClick={() => setShowDatePicker(!showDatePicker)}
                    aria-expanded={showDatePicker}
                    aria-controls={datePickerId}
                    aria-pressed={value === 'custom'}
                    className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5',
                        value === 'custom'
                            ? 'bg-white text-emerald-700 shadow-sm'
                            : 'text-white/80 hover:text-white hover:bg-white/15'
                    )}
                >
                    <Calendar size={13} />
                    Custom
                </button>

                {showDatePicker && (
                    <div id={datePickerId} className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-50 w-[280px] max-w-[calc(100vw-32px)]">
                        <div className="space-y-3">
                            <div>
                                <label htmlFor={fromId} className="text-xs font-medium text-gray-500 block mb-1">From</label>
                                <input
                                    id={fromId}
                                    type="date"
                                    value={fromDate}
                                    onChange={(e) => setFromDate(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                                />
                            </div>
                            <div>
                                <label htmlFor={toId} className="text-xs font-medium text-gray-500 block mb-1">To</label>
                                <input
                                    id={toId}
                                    type="date"
                                    value={toDate}
                                    onChange={(e) => setToDate(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                                />
                            </div>
                            {isInvertedRange && (
                                <p className="text-xs font-medium text-red-500">End date must be on or after the start date.</p>
                            )}
                            <button
                                onClick={handleCustomApply}
                                disabled={!fromDate || !toDate || isInvertedRange}
                                className="w-full py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Apply
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
