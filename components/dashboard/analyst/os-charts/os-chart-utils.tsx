/* eslint-disable @typescript-eslint/no-explicit-any */

import { type ComponentProps, useState } from 'react';
import {
    ResponsiveContainer as RechartsResponsiveContainer,
} from 'recharts';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Report } from '@/types';

export const REFERENCE_COLORS = {
    irregularity: '#08ad6f',
    complaint: '#0f86c1',
    compliment: '#e49418',
    trend: '#007073',
    neutral: '#263033',
};

export const CHART_PALETTE = [
    '#08ad6f',
    '#0f86c1',
    '#e49418',
    '#79c77b',
    '#007073',
    '#a8bca6',
];

export const COLORS = [
    REFERENCE_COLORS.irregularity,
    REFERENCE_COLORS.complaint,
    REFERENCE_COLORS.compliment,
    '#79c77b',
    '#007073',
    '#8a8a8a',
    '#cfd8ce',
];

export const ENTERPRISE_COLORS = [
    '#1f2a2d',
    '#263033',
    '#48ad4f',
    '#e49418',
] as const;

export const OS_CARD_CLASS = 'border border-[#cfd8ce] bg-white shadow-[0_2px_10px_rgba(15,23,42,0.16)]';
export const OS_TABLE_HEADER_CLASS = 'bg-[#79c77b] text-[#17231c]';
export const OS_BORDER_CLASS = 'border-[#b9c5b8]';
export const OS_HOVER_CLASS = 'hover:bg-[#eef7ed]';

export function ResponsiveContainer(props: ComponentProps<typeof RechartsResponsiveContainer>) {
    return (
        <RechartsResponsiveContainer
            {...props}
            minWidth={props.minWidth ?? 1}
            minHeight={props.minHeight ?? 1}
        />
    );
}

interface AxisTickProps {
    x?: number;
    y?: number;
    payload?: {
        value?: string | number;
    };
}

export const WrappedXAxisTick = (props: AxisTickProps) => {
    const { x, y, payload } = props;
    const label = String(payload?.value ?? '');
    const words = label.split(/\s+/);
    const lines: string[] = [];
    let currentLine = words[0] || '';

    for (let i = 1; i < words.length; i++) {
        if ((currentLine + ' ' + words[i]).length < 15) {
            currentLine += ' ' + words[i];
        } else {
            lines.push(currentLine);
            currentLine = words[i];
        }
    }
    lines.push(currentLine);
    const displayLines = lines.slice(0, 3);
    if (lines.length > 3) displayLines[2] += '...';

    // Single-word labels (station/airline codes) never wrap, so on a narrow
    // chart width many of them collide edge-to-edge when centered. Rotating
    // them gives each one its own diagonal lane instead of touching its
    // neighbor.
    const rotate = displayLines.length === 1;

    return (
        <g transform={`translate(${x ?? 0},${y ?? 0})`}>
            {displayLines.map((line, i) => (
                <text
                    key={i}
                    x={0}
                    y={0}
                    dy={rotate ? 4 : 16 + (i * 12)}
                    dx={rotate ? -4 : 0}
                    textAnchor={rotate ? 'end' : 'middle'}
                    transform={rotate ? `rotate(-40)` : undefined}
                    fill="var(--text-muted)"
                    fontSize={10}
                    fontWeight={600}
                    className="tracking-tighter"
                >
                    {line}
                </text>
            ))}
        </g>
    );
};

export const WrappedYAxisTick = (props: AxisTickProps) => {
    const { x, y, payload } = props;
    const words = String(payload?.value ?? '').split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';
    const maxLineLength = 20;

    words.forEach((word: string) => {
        if ((currentLine + word).length > maxLineLength) {
            if (currentLine) lines.push(currentLine.trim());
            currentLine = word + ' ';
        } else {
            currentLine += word + ' ';
        }
    });
    if (currentLine) lines.push(currentLine.trim());

    return (
        <g transform={`translate(${x ?? 0},${y ?? 0})`}>
            {lines.map((line, i) => (
                <text
                    key={i}
                    x={-12}
                    y={i * 11}
                    dy={-((lines.length - 1) * 5.5)}
                    textAnchor="end"
                    fill="var(--text-primary)"
                    fontSize={10}
                    fontWeight={700}
                    className="tracking-tighter"
                >
                    {line}
                </text>
            ))}
        </g>
    );
};

export interface CustomTooltipProps {
    active?: boolean;
    payload?: Array<{
        name?: string;
        value?: number;
        color?: string;
        fill?: string;
        dataKey?: string;
        payload?: Record<string, unknown>;
    }>;
    label?: string;
}

export function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
    if (!active || !payload?.length) return null;

    return (
        <div className="border border-[#b9c9b6] bg-white p-3 shadow-[0_8px_20px_rgba(15,23,42,0.12)] min-w-[140px] font-black">
            {label && <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#007073] mb-2 border-b border-[#dfe7dd] pb-1">{label}</p>}
            <div className="space-y-1">
                {payload.map((entry, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-6">
                        <div className="flex items-center gap-1.5 text-[#3f4742]">
                            <div
                                className="w-2 h-2 shrink-0"
                                style={{ backgroundColor: entry.fill || entry.color || '#08ad6f' }}
                            />
                            <span className="text-[11px] font-semibold text-[#3f4742]">
                                {entry.name || 'Value'}
                            </span>
                        </div>
                        <span className="text-[11px] font-black text-[#1f2a2d]">
                            {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function heatColor(value: number, max: number): { bg: string; fg: string } {
    if (value === 0 || max === 0) return { bg: 'transparent', fg: 'var(--text-muted)' };
    const ratio = Math.min(1, Math.max(0, value / max));

    const l = 0.95 - (0.45 * ratio);
    const c = 0.03 + (0.17 * ratio);
    const h = 160;

    return {
        bg: `oklch(${l} ${c} ${h})`,
        fg: l < 0.65 ? '#ffffff' : '#0f172a',
    };
}

const DETAIL_PAGE_SIZE = 10;

export function DetailReportTable({ data }: { data: Report[] }) {
    const [page, setPage] = useState(0);
    const totalPages = Math.ceil(data.length / DETAIL_PAGE_SIZE);
    const pageItems = data.slice(page * DETAIL_PAGE_SIZE, (page + 1) * DETAIL_PAGE_SIZE);
    const startIdx = page * DETAIL_PAGE_SIZE + 1;
    const endIdx = Math.min((page + 1) * DETAIL_PAGE_SIZE, data.length);

    if (data.length === 0) {
        return <p className="text-xs text-[var(--text-muted)] text-center py-4">No data</p>;
    }

    return (
        <div className="sr-scope flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
                <table className="sr-table text-[12px]" style={{ width: '100%', minWidth: 1080, tableLayout: 'fixed' }}>
                    <thead>
                        <tr>
                            <th style={{ width: '9%', whiteSpace: 'normal' }}>Date</th>
                            <th style={{ width: '9%', whiteSpace: 'normal' }}>Tag</th>
                            <th style={{ width: '10%', whiteSpace: 'normal' }}>Category</th>
                            <th style={{ width: '8%', whiteSpace: 'normal' }}>Station</th>
                            <th style={{ width: '12%', whiteSpace: 'normal' }}>Airlines</th>
                            <th style={{ width: '8%', whiteSpace: 'normal' }}>Flight</th>
                            <th style={{ whiteSpace: 'normal' }}>Report</th>
                            <th style={{ width: '16%', whiteSpace: 'normal' }}>Root Caused</th>
                            <th style={{ width: '14%', whiteSpace: 'normal' }}>Action Taken</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pageItems.map((r, idx) => {
                            const date = r.date_of_event
                                ? new Date(r.date_of_event).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' })
                                : '-';
                             
                            const tag = (r as any).primary_tag || '-';
                            const tagColor = tag === 'Landside' ? 'bg-blue-100 text-blue-700' : tag === 'Airside' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600';
                            const branch = r.stations?.code || r.branch || '-';
                            return (
                                <tr key={`${r.id || idx}-${idx}`}>
                                    <td className="font-mono tabular-nums">{date}</td>
                                    <td className="sr-center">
                                        <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-bold ${tagColor}`}>{tag}</span>
                                    </td>
                                    <td>{r.category || r.main_category || '-'}</td>
                                    <td className="font-bold">{branch}</td>
                                    <td>{r.airlines || '-'}</td>
                                    <td className="font-mono tabular-nums">{(r as any).flight_number || '-'}</td>
                                    <td style={{ whiteSpace: 'normal', wordBreak: 'break-word', verticalAlign: 'top' }}>
                                        <p className="overflow-hidden whitespace-normal break-words leading-snug [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">{(r as any).description || (r as any).report || '-'}</p>
                                    </td>
                                    <td style={{ whiteSpace: 'normal', wordBreak: 'break-word', verticalAlign: 'top' }}>
                                        <p className="overflow-hidden whitespace-normal break-words leading-snug [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">{(r as any).root_caused || '-'}</p>
                                    </td>
                                    <td style={{ whiteSpace: 'normal', wordBreak: 'break-word', verticalAlign: 'top' }}>
                                        <p className="overflow-hidden whitespace-normal break-words leading-snug [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">{(r as any).action_taken || '-'}</p>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-[color:var(--sr-border)] bg-[color:var(--sr-overlay)] px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-[color:var(--sr-text-3)]">
                    <span>
                        {startIdx}-{endIdx} / {data.length} records
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            aria-label="Halaman sebelumnya"
                            className="inline-flex h-9 w-9 items-center justify-center border border-[color:var(--sr-border)] bg-[color:var(--sr-raised)] text-[color:var(--sr-text)] disabled:opacity-35"
                            disabled={page === 0}
                            onClick={() => setPage((p) => p - 1)}
                        >
                            <ChevronLeft size={14} aria-hidden="true" />
                        </button>
                        <span className="min-w-[4rem] text-center">{page + 1}/{totalPages}</span>
                        <button
                            aria-label="Halaman selanjutnya"
                            className="inline-flex h-9 w-9 items-center justify-center border border-[color:var(--sr-border)] bg-[color:var(--sr-raised)] text-[color:var(--sr-text)] disabled:opacity-35"
                            disabled={page >= totalPages - 1}
                            onClick={() => setPage((p) => p + 1)}
                        >
                            <ChevronRight size={14} aria-hidden="true" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
