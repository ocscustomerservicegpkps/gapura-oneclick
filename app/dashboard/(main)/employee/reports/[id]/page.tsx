
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeft, Plane, Wrench,
    AlertCircle, CheckCircle, Loader2, Send, MessageSquare, Link, ExternalLink, FileText
} from 'lucide-react';
import Image from 'next/image';
import { STATUS_CONFIG, canPerformAction, type ReportStatus } from '@/lib/constants/report-status';
import { DocxEditorModal } from '@/components/dashboard/DocxEditorModal';
import { canEditReport } from '@/lib/permissions';

interface Report {
    id: string;
    user_id: string;
    station_id: string;
    title: string;
    description: string;
    status: ReportStatus;
    esklasi_divisi: string | null;
    area: string;
    specific_location: string;
    incident_date: string;
    incident_time: string;
    is_flight_related: boolean;
    flight_number: string | null;
    aircraft_reg: string | null;
    is_gse_related: boolean;
    gse_number: string | null;
    main_category: string;
    sub_category: string;
    immediate_action: string | null;
    evidence_urls: string[] | null;
    partner_evidence_urls: string[] | null;
    partner_response_notes: string | null;
    validation_notes: string | null;
    created_at: string;
    acknowledged_at: string | null;
    started_at: string | null;
    validated_at: string | null;
    users: { id: string; full_name: string; email: string } | null;
    branch: string | null;
    stations: { id: string; code: string; name: string } | null;
    acknowledged_user: { id: string; full_name: string } | null;
    validated_user: { id: string; full_name: string } | null;
    comments: Comment[];
}

interface Comment {
    id: string;
    content: string;
    is_system_message: boolean;
    created_at: string;
    attachments: string[] | null;
    users: { id: string; full_name: string; role: string } | null;
}

interface UserSession {
    id: string;
    role: string;
    division?: string;
    station_id?: string;
}

export default function EmployeeReportDetailPage() {
    const params = useParams();
    const router = useRouter();
    const reportId = params.id as string;

    const [report, setReport] = useState<Report | null>(null);
    const [loading, setLoading] = useState(true);
    const [, setError] = useState('');
    const [user, setUser] = useState<UserSession | null>(null);

    const [newComment, setNewComment] = useState('');
    const [sendingComment, setSendingComment] = useState(false);
    const commentsEndRef = useRef<HTMLDivElement>(null);
    const [isDocxModalOpen, setIsDocxModalOpen] = useState(false);

    useEffect(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [report?.comments]);

    const fetchUser = useCallback(async (signal?: AbortSignal) => {
        try {
            const res = await fetch('/api/auth/me', { signal });
            if (res.ok) {
                const data = await res.json();
                setUser({ id: data.id, role: data.role, division: data.division, station_id: data.station_id });
            }
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') return;
            console.error('Failed to fetch user:', err);
        }
    }, []);

    const fetchReport = useCallback(async (signal?: AbortSignal) => {
        try {
            const res = await fetch(`/api/reports/${reportId}`, { signal });
            if (!res.ok) throw new Error('Failed to fetch report');
            const data = await res.json();
            setReport(data);
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') return;
            setError('Failed to load reports');
        } finally {
            setLoading(false);
        }
    }, [reportId]);

    useEffect(() => {
        const controller = new AbortController();
        const { signal } = controller;

        fetchReport(signal);
        fetchUser(signal);

        // `report_comments` RLS no longer grants the anon client a reachable
        // SELECT policy, so a Postgres Realtime `postgres_changes`
        // subscription on it would silently receive zero events. Poll the
        // report (which includes comments) instead so new replies still
        // show up without a manual refresh.
        const interval = setInterval(() => {
            fetchReport();
        }, 10_000);

        return () => {
            controller.abort();
            clearInterval(interval);
        };
    }, [reportId, fetchReport, fetchUser]);

    const sendComment = async () => {
        if (!newComment.trim()) return;

        setSendingComment(true);
        try {
            const res = await fetch(`/api/reports/${reportId}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: newComment }),
            });

            if (res.ok) {
                setNewComment('');
                await fetchReport();
            }
        } catch (err) {
            console.error('Failed to send comment:', err);
        } finally {
            setSendingComment(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    if (!report) {
        return (
            <div className="text-center py-20">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
                <p className="text-lg font-medium">Report not found</p>
                <button
                    onClick={() => router.push('/dashboard/employee')}
                    className="mt-4 btn-secondary"
                >
                    Back to Dashboard
                </button>
            </div>
        );
    }

    const statusConfig = STATUS_CONFIG[report.status];
    const canComment = user && canPerformAction('comment', report.status, user.role);
    const canEdit = user && report && canEditReport(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        user.role as any,
        user.id,
        report.user_id,
        user.station_id,
        report.station_id
    );
    const isClosed = report.status === 'CLOSED';

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-24">
            {}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1">
                    <h1 className="text-xl font-bold">{report.title}</h1>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        Your Report
                    </p>
                </div>
                <div 
                    className="px-4 py-2 rounded-full font-medium text-sm"
                    style={{ background: statusConfig.bgColor, color: statusConfig.color }}
                >
                    {statusConfig.label}
                </div>
                {canEdit && !isClosed && (
                    <button
                        onClick={() => setIsDocxModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-sm font-bold hover:bg-blue-100 transition-colors shadow-sm"
                    >
                        <FileText className="w-4 h-4" />
                        Edit DOCX
                    </button>
                )}
            </div>

            {}
            <div className="card-solid p-6" style={{ background: 'var(--surface-2)' }}>
                <h3 className="font-bold mb-4">Report Status</h3>
                <div className="flex items-center gap-2">
                    {['OPEN', 'ACKNOWLEDGED', 'ON_PROGRESS', 'WAITING_VALIDATION', 'CLOSED'].map((s, idx) => {
                        const isPassed = ['OPEN', 'ACKNOWLEDGED', 'ON_PROGRESS', 'WAITING_VALIDATION', 'CLOSED']
                            .indexOf(report.status) >= idx;
                        return (
                            <div key={s} className="flex-1 flex items-center">
                                <div className={`h-2 flex-1 rounded-full transition-all ${
                                    isPassed ? 'bg-emerald-500' : 'bg-slate-200'
                                }`} />
                            </div>
                        );
                    })}
                </div>
                <p className="text-sm mt-3" style={{ color: 'var(--text-secondary)' }}>
                    {statusConfig.description}
                </p>
            </div>

            {}
            <div className="card-solid p-6" style={{ background: 'var(--surface-2)' }}>
                <h2 className="font-bold text-lg mb-4">Report Detail</h2>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="space-y-1">
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Station</p>
                        <p className="font-medium text-sm">{report.stations?.code || report.branch || '-'}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Date</p>
                        <p className="font-medium text-sm">{report.incident_date || '-'}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Area</p>
                        <p className="font-medium text-sm">{report.area || '-'}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Ditangani oleh</p>
                        <p className="font-bold text-sm" style={{ color: 'var(--brand-primary)' }}>
                            {report.esklasi_divisi ? `Divisi ${report.esklasi_divisi}` : '-'}
                        </p>
                    </div>
                </div>

                {report.is_flight_related && (
                    <div className="flex items-center gap-4 p-3 rounded-xl bg-blue-50 mb-4">
                        <Plane className="w-5 h-5 text-blue-500" />
                        <div>
                            <p className="text-sm font-medium">Flight: {report.flight_number}</p>
                            {report.aircraft_reg && <p className="text-xs text-blue-600">Reg: {report.aircraft_reg}</p>}
                        </div>
                    </div>
                )}

                {report.is_gse_related && (
                    <div className="flex items-center gap-4 p-3 rounded-xl bg-amber-50 mb-4">
                        <Wrench className="w-5 h-5 text-amber-500" />
                        <p className="text-sm font-medium">GSE: {report.gse_number}</p>
                    </div>
                )}

                <div className="space-y-2 mb-4">
                    <p className="text-sm font-medium">Kronologis:</p>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        {report.description}
                    </p>
                </div>

                {report.evidence_urls && report.evidence_urls.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-sm font-medium">Link Bukti:</p>
                        <div className="space-y-2">
                            {report.evidence_urls.map((url, idx) => (
                                <a
                                    key={idx}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl border border-blue-200 hover:bg-blue-100 transition-colors"
                                >
                                    <Link className="w-4 h-4 text-blue-500 shrink-0" />
                                    <span className="text-sm text-blue-700 truncate flex-1">{url}</span>
                                    <ExternalLink className="w-4 h-4 text-blue-400 shrink-0" />
                                </a>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {}
            {report.partner_evidence_urls && report.partner_evidence_urls.length > 0 && (
                <div className="card-solid p-6 border-2 border-purple-200" style={{ background: 'oklch(0.55 0.22 280 / 0.05)' }}>
                    <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-purple-500" />
                        Tanggapan dari Divisi {report.esklasi_divisi}
                    </h2>
                    {report.partner_response_notes && (
                        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                            {report.partner_response_notes}
                        </p>
                    )}
                    <div className="space-y-2">
                        {report.partner_evidence_urls.map((url, idx) => (
                            <a
                                key={idx}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 p-3 bg-purple-50 rounded-xl border border-purple-200 hover:bg-purple-100 transition-colors"
                            >
                                <Link className="w-4 h-4 text-purple-500 shrink-0" />
                                <span className="text-sm text-purple-700 truncate flex-1">{url}</span>
                                <ExternalLink className="w-4 h-4 text-purple-400 shrink-0" />
                            </a>
                        ))}
                    </div>
                </div>
            )}

            {}
            <div className="card-solid p-6" style={{ background: 'var(--surface-2)' }}>
                <h2 className="font-bold text-lg mb-4">Timeline</h2>

                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                            <MessageSquare className="w-4 h-4 text-slate-500" />
                        </div>
                        <div>
                            <p className="text-sm">Anda membuat laporan</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {new Date(report.created_at).toLocaleString('id-ID')}
                            </p>
                        </div>
                    </div>

                    {report.acknowledged_at && (
                        <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center shrink-0">
                                <CheckCircle className="w-4 h-4 text-yellow-600" />
                            </div>
                            <div>
                                <p className="text-sm">
                                    Report acknowledged by <span className="font-medium">{report.acknowledged_user?.full_name}</span>
                                </p>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                    {new Date(report.acknowledged_at).toLocaleString('id-ID')}
                                </p>
                            </div>
                        </div>
                    )}

                    {report.comments?.map((comment) => {
                        const isMe = user && comment.users?.id === user.id;
                        const isSystem = comment.is_system_message;

                        if (isSystem) {
                            return (
                                <div key={comment.id} className="flex justify-center my-2">
                                    <div className="bg-slate-100 rounded-full px-3 py-1 text-xs text-slate-500">
                                        {comment.content}
                                    </div>
                                </div>
                            );
                        }

                        if (isMe) {
                            return (
                                <div key={comment.id} className="flex gap-3 justify-end">
                                    <div className="flex-1 max-w-[80%] space-y-1">
                                        <div className="flex items-baseline justify-end gap-2">
                                            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                                {new Date(comment.created_at).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}
                                            </span>
                                            <span className="text-xs font-bold text-emerald-600">Anda</span>
                                        </div>
                                        <div className="bg-emerald-500 text-white p-3 rounded-2xl rounded-tr-none text-sm leading-relaxed">
                                            {comment.content}
                                            {comment.attachments?.map((url, idx) => (
                                                <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-1.5 text-xs underline opacity-80 hover:opacity-100">
                                                    <Link className="w-3 h-3 shrink-0" />{url.length > 40 ? url.slice(0, 40) + '...' : url}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 text-white text-xs font-bold">
                                        {comment.users?.full_name?.charAt(0)}
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div key={comment.id} className="flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-slate-600 text-xs font-bold">
                                    {comment.users?.full_name?.charAt(0)}
                                </div>
                                <div className="flex-1 max-w-[80%] space-y-1">
                                    <div className="flex items-baseline justify-between">
                                        <span className="text-xs font-bold">{comment.users?.full_name}</span>
                                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                            {new Date(comment.created_at).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}
                                        </span>
                                    </div>
                                    <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-tl-none text-sm leading-relaxed">
                                        {comment.content}
                                        {comment.attachments?.map((url, idx) => (
                                            <div key={idx} className="relative mt-2 rounded-lg max-h-32 border overflow-hidden aspect-video">
                                                <Image
                                                    src={url}
                                                    alt={`Attachment ${idx + 1}`}
                                                    fill
                                                    sizes="(max-width: 768px) 100vw, 50vw"
                                                    className="object-cover"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={commentsEndRef} />
                </div>

                {}
                {canComment && (
                    <div className="mt-4 pt-4 border-t flex gap-2">
                        <input
                            type="text"
                            placeholder="Balas atau tambah informasi..."
                            className="input-field flex-1"
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && sendComment()}
                        />
                        <button
                            onClick={sendComment}
                            disabled={sendingComment || !newComment.trim()}
                            className="btn-primary px-4"
                        >
                            {sendingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </button>
                    </div>
                )}
            </div>

            {}
            <DocxEditorModal
                isOpen={isDocxModalOpen}
                onClose={() => setIsDocxModalOpen(false)}
                reportData={report}
                onSuccess={(updatedReport) => {
                    setReport(updatedReport);
                }}
            />
        </div>
    );
}
