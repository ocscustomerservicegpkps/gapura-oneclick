'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ComparisonData, MonthlyBucket } from '@/types';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ExecutiveSummaryTablesProps {
    data: ComparisonData;
    className?: string;
}

export const ExecutiveSummaryTables: React.FC<ExecutiveSummaryTablesProps> = ({ data, className }) => {

    const { yearGroups, allYears } = useMemo(() => {
        const groups: Record<number, Record<string, MonthlyBucket & { monthKey: string }>> = {};
        const years = new Set<number>();

        data.monthlyTrend.forEach(bucket => {
            const parts = bucket.month.split(' ');
            if (parts.length >= 2) {
                const year = parseInt(parts[0], 10);
                const monthName = parts[1].toUpperCase();
                if (!isNaN(year)) {
                    years.add(year);
                    if (!groups[year]) groups[year] = {};
                    groups[year][monthName] = { ...bucket, monthKey: monthName };
                }
            }
        });

        return { 
            yearGroups: groups, 
            allYears: Array.from(years).sort((a, b) => b - a)
        };
    }, [data.monthlyTrend]);

    const latestYear = allYears[0];
    const prevYear = allYears[1];

    const monthsOrder = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

    const summaryMetrics = useMemo(() => {
        if (!latestYear) return [];

        const computeTotals = (y: number) => {
            const group = yearGroups[y] || {};
            return Object.values(group).reduce((acc, curr) => {
                const irregularity = acc.irregularity + curr.irregularity;
                const complaint = acc.complaint + curr.complaint;
                const compliment = acc.compliment + curr.compliment;
                return { total: irregularity + complaint + compliment, irregularity, complaint, compliment };
            }, { total: 0, irregularity: 0, complaint: 0, compliment: 0 });
        };

        const latestTotals = computeTotals(latestYear);
        const prevTotals = prevYear ? computeTotals(prevYear) : { total: 0, irregularity: 0, complaint: 0, compliment: 0 };

        const buildRow = (label: string, curr: number, prev: number, isGoodLogic: (val: number, diff: number) => boolean) => {
            const diff = curr - prev;
            const improvementPct = prev === 0 ? (curr > 0 ? 100 : 0) : (Math.abs(diff) / prev) * 100;
            const improvementStr = prev === 0 ? (curr > 0 ? '100%' : 'N/A') : `${improvementPct.toFixed(0)}%`;
            return { label, curr, prev, diff, improvementStr, isGood: isGoodLogic(curr, diff) };
        };

        return [
            buildRow('Irregularity', latestTotals.irregularity, prevTotals.irregularity, (_, diff) => diff < 0),
            buildRow('Complaint', latestTotals.complaint, prevTotals.complaint, (_, diff) => diff < 0),
            buildRow('Compliment', latestTotals.compliment, prevTotals.compliment, (_, diff) => diff > 0),
            buildRow('TOTAL', latestTotals.total, prevTotals.total, (_, diff) => diff < 0),
        ];
    }, [yearGroups, latestYear, prevYear]);

    if (!latestYear) return null;

    const renderMonthlyTable = (year: number) => {
        const group = yearGroups[year] || {};
        return (
            <div className="flex-1 min-w-[340px] flex flex-col items-center">
                <div className="text-center font-black text-[#1f2937] mb-5 text-[15px] tracking-[0.15em]">{year}</div>
                {}
                <div className="w-full relative rounded-2xl overflow-hidden bg-white/70 backdrop-blur-2xl border border-white/40 shadow-xl shadow-slate-200/50 before:absolute before:inset-0 before:bg-[url('/noise.svg')] before:opacity-[0.03] before:pointer-events-none">
                    <div className="overflow-x-auto">
                    <table className="w-full min-w-[420px] text-xs text-center border-collapse relative z-10">
                        {}
                        <thead className="bg-[#1f2937] text-slate-100">
                            <tr>
                                <th className="px-5 py-4 font-bold text-left border-r border-[#374151] tracking-widest text-[10px] md:text-[11px] uppercase">MONTH</th>
                                <th className="px-4 py-4 font-bold border-r border-[#374151] tracking-widest text-[10px] md:text-[11px] uppercase">IRREGULARITY</th>
                                <th className="px-4 py-4 font-bold border-r border-[#374151] tracking-widest text-[10px] md:text-[11px] uppercase">COMPLAINT</th>
                                <th className="px-4 py-4 font-bold border-r border-[#374151] tracking-widest text-[10px] md:text-[11px] uppercase">COMPLIMENT</th>
                                <th className="px-5 py-4 font-bold tracking-widest text-[10px] md:text-[11px] uppercase">TOTAL</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/60">
                            {monthsOrder.map((month, idx) => {
                                const row = group[month];
                                const irr = row?.irregularity || 0;
                                const comp = row?.complaint || 0;
                                const compl = row?.compliment || 0;
                                const total = irr + comp + compl;

                                return (
                                    <motion.tr 
                                        key={month} 
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.03, duration: 0.3 }}
                                        className="hover:bg-white/80 transition-colors group relative cursor-default"
                                    >
                                        <td className="px-5 py-4 text-[11px] font-bold text-slate-500 text-left border-r border-slate-200/60 tracking-wider bg-slate-50/30 group-hover:bg-transparent transition-colors">{month}</td>
                                        <td className="px-4 py-4 text-[13px] text-slate-700 font-medium border-r border-slate-200/60">{irr > 0 ? irr : '-'}</td>
                                        <td className="px-4 py-4 text-[13px] text-slate-700 font-medium border-r border-slate-200/60">{comp > 0 ? comp : '-'}</td>
                                        <td className={cn(
                                            "px-4 py-4 text-[13px] font-medium border-r border-slate-200/60",
                                            compl > 0 ? "text-[#0ea5e9] drop-shadow-sm font-semibold" : "text-emerald-500/30"
                                        )}>{compl > 0 ? compl : '-'}</td>
                                        <td className="px-5 py-4 text-[13px] font-black text-[#1e293b]">{total > 0 ? total : '-'}</td>
                                    </motion.tr>
                                );
                            })}
                        </tbody>
                    </table>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
            className={cn("flex flex-col gap-12 w-full max-w-[1600px] mx-auto", className)}
        >
            {}
            <div className="relative pl-5 py-1">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-500 rounded-full" />
                <h2 className="text-2xl font-black text-[#0f172a] tracking-tight">
                    Report Summary
                </h2>
                <div className="flex items-center gap-2 mt-1">
                    <div className="px-2.5 py-0.5 rounded-md bg-slate-100 border border-slate-200/60 text-xs font-bold text-slate-500 tracking-wider">
                        PERIODE
                    </div>
                    <p className="text-sm text-slate-600 font-semibold tracking-wide">
                        {prevYear ? `${prevYear} & ${latestYear}` : latestYear}
                    </p>
                </div>
            </div>

            <div className="flex flex-col 2xl:flex-row gap-8 lg:gap-14 items-start justify-between">

                {}
                <div className="flex flex-col lg:flex-row gap-8 lg:gap-10 w-full 2xl:w-[70%]">
                    {prevYear && renderMonthlyTable(prevYear)}
                    {renderMonthlyTable(latestYear)}
                </div>

                {}
                <div className="w-full lg:w-3/4 2xl:w-[30%] mt-4 lg:mt-11 mx-auto 2xl:mx-0">
                    <div className="rounded-2xl overflow-hidden bg-white/60 backdrop-blur-xl border border-white/40 shadow-2xl shadow-[#1e3a8a]/10 relative before:absolute before:inset-0 before:bg-[url('/noise.svg')] before:opacity-[0.03] before:pointer-events-none">
                        <div className="overflow-x-auto">
                        <table className="w-full min-w-[420px] text-sm border-collapse relative z-10">
                            {}
                            <thead className="bg-[#1e3a8a] text-white">
                                <tr>
                                    <th className="px-6 py-5 text-[11px] font-bold tracking-widest text-left uppercase text-white/90">CATEGORY</th>
                                    <th className="px-4 py-5 text-[11px] font-bold tracking-widest text-center text-white/90">{prevYear || '-'}</th>
                                    <th className="px-4 py-5 text-[11px] font-bold tracking-widest text-center text-white/90">{latestYear}</th>
                                    <th className="px-6 py-5 text-[11px] font-bold tracking-widest text-right uppercase text-white/90">IMPROVEMENT</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200/50">
                                {summaryMetrics.map((sm, idx) => {
                                    const isTotal = sm.label === 'TOTAL';
                                    if (isTotal) return null;
                                    return (
                                        <motion.tr 
                                            key={sm.label}
                                            initial={{ opacity: 0, x: 10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.2 + (idx * 0.05), duration: 0.3 }}
                                            className="hover:bg-white/80 transition-colors group cursor-default"
                                        >
                                            <td className="px-6 py-6 text-[13px] text-left font-bold text-slate-700/90 tracking-wide">{sm.label}</td>
                                            <td className="px-4 py-6 text-sm text-center font-semibold text-slate-500">{sm.prev}</td>
                                            <td className="px-4 py-6 text-sm text-center font-semibold text-slate-500">{sm.curr}</td>
                                            <td className="px-6 py-6 text-sm text-right">
                                                {sm.prev > 0 ? (
                                                    <div className="flex items-center justify-end gap-2">
                                                        {sm.diff === 0 ? (
                                                            <Minus size={18} className="text-slate-400" />
                                                        ) : sm.isGood ? (
                                                            <TrendingUp size={18} className="text-emerald-500 drop-shadow-sm" />
                                                        ) : (
                                                            <TrendingDown size={18} className="text-rose-500 drop-shadow-sm" />
                                                        )}
                                                        <span className={cn(
                                                            "font-black text-[15px] tracking-wide",
                                                            sm.diff === 0 ? "text-slate-500" : sm.isGood ? "text-emerald-500 drop-shadow-sm" : "text-rose-500 drop-shadow-sm"
                                                        )}>
                                                            {sm.improvementStr}
                                                        </span>
                                                    </div>
                                                ) : <span className="text-slate-300 font-medium">-</span>}
                                            </td>
                                        </motion.tr>
                                    );
                                })}
                            </tbody>
                            {}
                            <tfoot className="bg-gradient-to-r from-[#1e3a8a] to-[#2563eb] text-white">
                                {summaryMetrics.filter(sm => sm.label === 'TOTAL').map(sm => (
                                    <tr key={sm.label}>
                                        <td className="px-6 py-5 text-[15px] text-left font-black tracking-widest">{sm.label}</td>
                                        <td className="px-4 py-5 font-bold text-center text-white/90">{sm.prev}</td>
                                        <td className="px-4 py-5 font-bold text-center text-white/90">{sm.curr}</td>
                                        <td className="px-6 py-5 text-right">
                                            {sm.prev > 0 ? (
                                                <div className="flex items-center justify-end gap-2">
                                                    {sm.diff === 0 ? (
                                                        <Minus size={18} className="text-white/60" />
                                                    ) : sm.isGood ? (
                                                        <TrendingUp size={18} className="text-[#34d399] drop-shadow-md" />
                                                    ) : (
                                                        <TrendingDown size={18} className="text-[#fb7185] drop-shadow-md" />
                                                    )}
                                                    <span className={cn(
                                                        "font-black text-[15px] drop-shadow-md",
                                                        sm.diff === 0 ? "text-white/90" : sm.isGood ? "text-[#a7f3d0]" : "text-[#fecdd3]"
                                                    )}>
                                                        {sm.improvementStr}
                                                    </span>
                                                </div>
                                            ) : <span className="text-white/50">-</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tfoot>
                        </table>
                        </div>
                    </div>
                </div>

            </div>
        </motion.div>
    );
};
