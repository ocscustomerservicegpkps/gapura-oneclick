'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText, CheckCircle2, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { type Report } from '@/types';
import { STATUS_CONFIG, type ReportStatus, normalizeSeverityLevel, isHighSeverityLevel } from '@/lib/constants/report-status';
import { cn } from '@/lib/utils';
import { ReportDetailModal } from '@/components/dashboard/ReportDetailModal';

interface DrilldownDetailViewProps {
    title: string;
    subtitle?: string;
    backHref: string;
    reports: Report[];
    loading: boolean;
    userRole?: string;
    breakdownChart?: React.ReactNode;
}

function resolveSeverityLevel(report: Report): string {
    const raw = (report as Record<string, unknown>)['severity_level']
        || (report as Record<string, unknown>)['Severity Level']
        || (report as Record<string, unknown>)['Severity_Level']
        || report.severity;
    return normalizeSeverityLevel(raw);
}

export function DrilldownDetailView({
    title,
    subtitle,
    backHref,
    reports,
    loading,
    userRole = 'SUPER_ADMIN',
    breakdownChart,
}: DrilldownDetailViewProps) {
    const [selectedReport, setSelectedReport] = useState<Report | null>(null);

    const totalCount = reports.length;
    const resolvedCount = reports.filter(r => r.status === 'CLOSED').length;
    const pendingCount = reports.filter(r => r.status === 'OPEN').length;
    const highCount = reports.filter(r => isHighSeverityLevel(resolveSeverityLevel(r))).length;

    if (loading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-[var(--brand-primary)]" />
                <p className="text-sm text-[var(--text-muted)] mt-4">Loading data...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-24">
            {}
            <div className="flex items-center gap-3">
                <Link
                    href={backHref}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-all"
                >
                    <ArrowLeft size={16} />
                    Back
                </Link>
            </div>

            {}
            <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-[var(--text-primary)]">{title}</h1>
                {subtitle && <p className="text-sm text-[var(--text-muted)] mt-1">{subtitle}</p>}
            </div>

            {}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <SummaryCard icon={FileText} label="Total" value={totalCount} color="blue" />
                <SummaryCard icon={CheckCircle2} label="Resolved" value={resolvedCount} color="green" />
                <SummaryCard icon={Clock} label="Pending" value={pendingCount} color="amber" />
                <SummaryCard icon={AlertTriangle} label="High Severity" value={highCount} color="red" />
            </div>

            {}
            {breakdownChart && (
                <div className="card-solid p-6">
                    {breakdownChart}
                </div>
            )}

            {}
            <div className="card-solid p-0 overflow-hidden">
                <div className="p-5 border-b border-[var(--surface-4)]">
                    <h3 className="font-bold text-[var(--text-primary)]">
                        {totalCount} Reports Found
                    </h3>
                </div>

                {totalCount === 0 ? (
                    <div className="py-16 text-center">
                        <FileText size={40} className="mx-auto mb-4 opacity-30 text-[var(--text-muted)]" />
                        <p className="text-[var(--text-muted)]">No matching reports</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-[var(--surface-4)]">
                                    <th className="text-left text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] p-4">ID</th>
                                    <th className="text-left text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] p-4">Title</th>
                                    <th className="text-left text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] p-4">Status</th>
                                    <th className="text-left text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] p-4">Severity</th>
                                    <th className="text-left text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] p-4">Station</th>
                                    <th className="text-left text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] p-4">Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reports.map((r) => (
                                    <tr
                                        key={r.id}
                                        className="border-b border-[var(--surface-4)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
                                        onClick={() => setSelectedReport(r)}
                                    >
                                        <td className="p-4 font-mono text-sm text-[var(--text-secondary)]">
                                            {r.id.slice(0, 8)}
                                        </td>
                                        <td className="p-4 text-sm font-medium text-[var(--text-primary)] max-w-[300px] truncate">
                                            {r.title}
                                        </td>
                                        <td className="p-4">
                                            <span
                                                className="px-2 py-1 rounded-full text-[10px] font-bold uppercase"
                                                style={{
                                                    color: STATUS_CONFIG[r.status as ReportStatus]?.color,
                                                    backgroundColor: STATUS_CONFIG[r.status as ReportStatus]?.bgColor,
                                                }}
                                            >
                                                {STATUS_CONFIG[r.status as ReportStatus]?.label || r.status}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            {(() => {
                                                const severityLevel = resolveSeverityLevel(r);
                                                const isHigh = isHighSeverityLevel(severityLevel);
                                                return (
                                            <span
                                                className={cn(
                                                    'px-2 py-1 rounded-full text-[10px] font-bold uppercase',
                                                    isHigh
                                                        ? 'bg-red-100 text-red-700'
                                                        : severityLevel === 'MEDIUM'
                                                        ? 'bg-amber-100 text-amber-700'
                                                        : 'bg-green-100 text-green-700'
                                                )}
                                            >
                                                {severityLevel || '-'}
                                            </span>
                                                );
                                            })()}
                                        </td>
                                        <td className="p-4 text-sm text-[var(--text-secondary)]">
                                            {r.stations?.code || '-'}
                                        </td>
                                        <td className="p-4 text-sm text-[var(--text-muted)]">
                                            {new Date(r.created_at).toLocaleDateString('en-US')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <ReportDetailModal
                isOpen={!!selectedReport}
                onClose={() => setSelectedReport(null)}
                report={selectedReport}
                userRole={userRole}
            />
        </div>
    );
}

export function SummaryCard({
    icon: Icon,
    label,
    value,
    color,
}: {
    icon: React.ElementType;
    label: string;
    value: number;
    color: 'blue' | 'green' | 'amber' | 'red';
}) {
    const colorMap = {
        blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100' },
        green: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' },
        amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' },
        red: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-100' },
    };
    const c = colorMap[color];

    return (
        <div className={cn('card-solid p-4 border', c.border)}>
            <div className={cn('p-1.5 rounded-lg w-fit mb-2', c.bg)}>
                <Icon size={14} className={c.text} />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-0.5">
                {label}
            </p>
            <p className="text-xl font-bold text-[var(--text-primary)]">{value}</p>
        </div>
    );
}
