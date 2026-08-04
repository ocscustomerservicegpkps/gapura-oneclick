
'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';

import {
    Plus, MapPin, FileText,
    CheckCircle2,
    Search, History, MoreHorizontal, FileType, Eye
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { STATUS_CONFIG, type ReportStatus } from '@/lib/constants/report-status';
import { ReportDetailModal } from '@/components/dashboard/ReportDetailModal';
import { Report } from '@/types';
import { useReportsData } from '@/hooks/use-reports-cache';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

async function getPDFExporter() {
    const { generatePDF } = await import('@/lib/utils/document-generator');
    return generatePDF;
}

async function getWordExporter() {
    const { downloadLatestSavedWordOrGenerate } = await import('@/lib/utils/document-generator');
    return downloadLatestSavedWordOrGenerate;
}

export default function EmployeeDashboard() {
    const router = useRouter();
    const [selectedReport, setSelectedReport] = useState<Report | null>(null);
    const [, setExportingId] = useState<string | null>(null);

    const { reports } = useReportsData('/api/reports');

    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 17) return 'Good Afternoon';
        return 'Good Evening';
    }, []);

    const handleReportClick = useCallback((report: Report) => {
        setSelectedReport(report);
    }, []);

    const handleExportPDF = useCallback(async (report: Report) => {
        setExportingId(report.id);
        try {
            const exportFn = await getPDFExporter();
            await exportFn(report);
        } catch (err) {
            console.error('PDF export failed:', err);
        } finally {
            setExportingId(null);
        }
    }, []);

    const handleExportWord = useCallback(async (report: Report) => {
        setExportingId(report.id);
        try {
            const exportFn = await getWordExporter();
            await exportFn(report);
        } catch (err) {
            console.error('Word export failed:', err);
        } finally {
            setExportingId(null);
        }
    }, []);

    const stats = useMemo(() => ({
        total: reports.length,
        inProgress: reports.filter(r => r.status === 'ON PROGRESS').length,
        resolved: reports.filter(r => r.status === 'CLOSED').length,
    }), [reports]);

    const progressWidth = stats.total > 0 ? (stats.inProgress / stats.total) * 100 : 0;

    return (
        <div className="space-y-8 stagger-children p-6 md:p-8 pb-24">

            {}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-slate-100 pb-10">
                <div className="space-y-4 max-w-2xl">

                    <h1 className="text-5xl md:text-6xl font-light tracking-tight text-slate-900 leading-[1.1]">
                        {greeting}, <span className="italic font-medium text-slate-600">Staff.</span>
                    </h1>
                    <p className="text-[15px] font-medium text-slate-700 mt-4 leading-relaxed">
                        Welcome to your operational overview. Monitor real-time activities and manage irregularity reports with editorial precision.
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push('/dashboard/employee/new')}
                        className="group relative px-8 py-4 bg-slate-900 text-white rounded-full font-bold text-[12px] tracking-widest uppercase shadow-xl shadow-slate-200 hover:shadow-indigo-100 hover:-translate-y-1 transition-all duration-300 flex items-center gap-3"
                    >
                        <Plus size={18} strokeWidth={2.5} />
                        <span>Create Report</span>
                    </button>
                </div>
            </header>

            {}
            {}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {}
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm group hover:border-indigo-100 transition-all">
                    <div className="flex justify-between items-start mb-6">
                        <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                            <FileText size={20} />
                        </div>
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Total Lifecycle</span>
                    </div>
                    <div className="space-y-1">
                        <p className="text-5xl font-light text-slate-900 tracking-tighter">{stats.total}</p>
                        <p className="text-[13px] font-medium text-slate-700">Total active reports in system</p>
                    </div>
                </div>

                {}
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm group hover:border-amber-100 transition-all">
                    <div className="flex justify-between items-start mb-6">
                        <div className="p-3 bg-amber-50 rounded-2xl text-amber-600">
                            <History size={20} />
                        </div>
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">On Progress</span>
                    </div>
                    <div className="space-y-4">
                        <p className="text-5xl font-light text-slate-900 tracking-tighter">{stats.inProgress}</p>
                        <div className="h-1 w-full bg-slate-50 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-amber-500 rounded-full transition-all duration-1000 ease-out"
                                style={{ width: `${progressWidth}%` }}
                            />
                        </div>
                    </div>
                </div>

                {}
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm group hover:border-emerald-100 transition-all">
                    <div className="flex justify-between items-start mb-6">
                        <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
                            <CheckCircle2 size={20} />
                        </div>
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Resolved</span>
                    </div>
                    <div className="space-y-1">
                        <p className="text-5xl font-light text-slate-900 tracking-tighter">{stats.resolved}</p>
                        <p className="text-[13px] font-medium text-slate-700">Cases successfully archived</p>
                    </div>
                </div>
            </div>

            {}
            <div className="space-y-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-50">
                    <div>
                        <h3 className="text-2xl font-light text-slate-900 tracking-tight">
                            Report Archive
                        </h3>
                        <p className="text-[13px] text-slate-600 mt-1 font-medium">
                            Manage and track recent irregularity records
                        </p>
                    </div>

                    <div className="flex items-center gap-4 bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100 shadow-none group">
                        <Search size={16} className="text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search records..."
                            className="bg-transparent text-[13px] font-medium focus:outline-none placeholder:text-slate-300 w-full sm:w-48"
                        />
                    </div>
                </div>

                {}
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden transition-all duration-500">
                    {}
                    <div className="hidden md:grid grid-cols-12 gap-4 px-8 py-5 bg-slate-50/50 border-b border-slate-100">
                        <div className="col-span-2 text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]">Reference</div>
                        <div className="col-span-5 text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]">Issue Description</div>
                        <div className="col-span-2 text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]">Operations</div>
                        <div className="col-span-2 text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]">Status</div>
                        <div className="col-span-1 text-right text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]">Actions</div>
                    </div>

                    <div className="divide-y divide-slate-50">
                        {reports.length === 0 ? (
                            <div className="p-20 text-center flex flex-col items-center gap-6">
                                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-200">
                                    <History size={28} />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-base font-medium text-slate-800">Archive Empty</p>
                                    <p className="text-xs text-slate-400">No irregularity records found in your branch.</p>
                                </div>
                            </div>
                        ) : (
                            reports.map((report) => {
                                const statusConfig = STATUS_CONFIG[report.status as ReportStatus] || STATUS_CONFIG.OPEN;
                                const dateObj = new Date(report.date_of_event || report.event_date || report.created_at);

                                return (
                                    <div
                                        key={report.id}
                                        onClick={() => handleReportClick(report)}
                                        className="group grid grid-cols-1 md:grid-cols-12 gap-4 px-6 md:px-8 py-6 md:py-5 hover:bg-slate-50/80 transition-all duration-300 cursor-pointer items-center relative"
                                    >
                                        {}
                                        <div className="col-span-2 flex flex-row md:flex-col items-center md:items-start justify-between md:justify-center gap-2">
                                            <span className="text-[11px] font-bold text-indigo-500 tracking-wider font-mono">
                                                #{report.id.slice(0, 8).toUpperCase()}
                                            </span>
                                            <div className="text-[11px] md:text-[12px] font-semibold text-slate-600 flex items-center gap-2">
                                                <span>{dateObj.toLocaleDateString('en-GB', {day: '2-digit', month: 'short'})}</span>
                                                <span className="md:hidden opacity-50">|</span>
                                                <span className="md:text-[10px] md:opacity-80">{dateObj.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'})}</span>
                                            </div>
                                        </div>

                                        {}
                                        <div className="col-span-5 space-y-1.5 min-w-0">
                                            <div className="flex items-center gap-2">
                                                {(() => {
                                                    const cat = (report.category || 'General').toUpperCase();
                                                    let style = "bg-slate-700 text-white";
                                                    if (cat.includes('IRREGULARITY')) style = "bg-amber-600 text-white";
                                                    else if (cat.includes('COMPLAINT')) style = "bg-rose-700 text-white";
                                                    else if (cat.includes('COMPLIMENT')) style = "bg-emerald-700 text-white";

                                                    return (
                                                        <span className={cn(
                                                            "text-[9px] font-black uppercase tracking-[0.1em] px-2 py-0.5 rounded-md shadow-sm",
                                                            style
                                                        )}>
                                                            {cat}
                                                        </span>
                                                    );
                                                })()}
                                                {report.flight_number && (
                                                    <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-widest">
                                                        &bull; {report.flight_number}
                                                    </span>
                                                )}
                                            </div>
                                            <h4 className="text-[14px] md:text-[15px] font-bold text-slate-800 leading-snug truncate group-hover:text-indigo-600 transition-colors">
                                                {report.title || report.report || 'Untitled Report'}
                                            </h4>
                                        </div>

                                        {}
                                        <div className="col-span-2 hidden md:flex flex-col gap-1">
                                            <div className="flex items-center gap-1.5 text-[12px] font-bold text-slate-800">
                                                <MapPin size={12} className="text-indigo-600" />
                                                <span className="truncate">{report.location || report.branch || '-'}</span>
                                            </div>
                                            {report.airline && (
                                                <span className="text-[10px] text-slate-600 font-bold ml-4 uppercase tracking-tighter truncate">
                                                    {report.airline}
                                                </span>
                                            )}
                                        </div>

                                        {}
                                        <div className="col-span-2 flex items-center">
                                            <span className={cn(
                                                "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all duration-300 group-hover:shadow-sm",
                                                statusConfig.bgClass, statusConfig.textClass, statusConfig.borderClass
                                            )}>
                                                {statusConfig.label}
                                            </span>
                                        </div>

                                        {}
                                        <div className="col-span-1 flex justify-end items-center gap-3">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleReportClick(report); }}
                                                className="hidden md:flex w-8 h-8 rounded-full bg-white border border-slate-100 text-slate-400 items-center justify-center hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all duration-300"
                                            >
                                                <Eye size={14} />
                                            </button>

                                            <div onClick={(e) => e.stopPropagation()}>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <button className="w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:border-indigo-200 hover:text-indigo-600 transition-all duration-300 shadow-sm">
                                                            <MoreHorizontal size={14} />
                                                        </button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-48 rounded-2xl p-2 shadow-xl border-slate-100">
                                                        <DropdownMenuItem onClick={() => handleExportPDF(report)} className="rounded-xl p-3 text-xs font-bold uppercase tracking-widest text-rose-600 focus:bg-rose-50">
                                                            <FileType className="mr-3 h-4 w-4" /> Export PDF
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleExportWord(report)} className="rounded-xl p-3 text-xs font-bold uppercase tracking-widest text-indigo-600 focus:bg-indigo-50">
                                                            <FileText className="mr-3 h-4 w-4" /> Export DOCX
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {}
            <ReportDetailModal
                isOpen={!!selectedReport}
                onClose={() => setSelectedReport(null)}
                report={selectedReport}
            />
        </div>
    );
}
