'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
    Mail, Plus, Trash2, ToggleLeft, ToggleRight, 
    RefreshCw, AlertCircle, CheckCircle2, Send,
    Shield, BellRing, Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Recipient {
    id: string;
    entity: string;
    channel: string;
    recipient_email: string;
    enabled: boolean;
    created_at: string;
    updated_at?: string;
}

const ENTITIES = [
    { value: '', label: 'All Entities' },
    { value: 'REPORT_NEW_RECORD', label: 'New Record' },
    { value: 'GPKPSUNITOS', label: 'GPKPS Unit OS' },
];

export default function NotificationSettings() {
    const [recipients, setRecipients] = useState<Recipient[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [selectedEntity, setSelectedEntity] = useState('REPORT_NEW_RECORD');
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [testEmail, setTestEmail] = useState('');
    const [testLoading, setTestLoading] = useState(false);

    const showMsg = useCallback((type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 5000);
    }, []);

    // Guards against a slower, earlier entity's response landing after a
    // newer entity's and overwriting the fresher recipient list.
    const activeEntityRef = useRef(selectedEntity);

    const fetchRecipients = useCallback(async () => {
        const requestEntity = selectedEntity;
        setLoading(true);
        try {
            const url = requestEntity
                ? `/api/admin/notifications/recipients?entity=${encodeURIComponent(requestEntity)}`
                : '/api/admin/notifications/recipients';

            const res = await fetch(url);
            const data = await res.json();

            if (activeEntityRef.current !== requestEntity) return;

            if (!res.ok || !Array.isArray(data)) {
                if (data.error === 'Unauthorized') {
                    showMsg('error', 'Please log in to manage notifications');
                } else {
                    throw new Error(data.error || 'Failed to fetch data');
                }
                setRecipients([]);
            } else {
                setRecipients(data);
            }
        } catch (err) {
            if (activeEntityRef.current !== requestEntity) return;
            console.error(err);
            showMsg('error', 'Failed to load recipient list');
        } finally {
            if (activeEntityRef.current === requestEntity) setLoading(false);
        }
    }, [selectedEntity, showMsg]);

    useEffect(() => {
        activeEntityRef.current = selectedEntity;
        fetchRecipients();
    }, [selectedEntity, fetchRecipients]);

    const handleAddRecipient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEmail || !newEmail.includes('@')) {
            showMsg('error', 'Invalid email address');
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch('/api/admin/notifications/recipients', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: newEmail, entity: selectedEntity }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to add recipient');
            }

            setNewEmail('');
            showMsg('success', 'Recipient added successfully');
            fetchRecipients();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            showMsg('error', err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const toggleEnabled = async (id: string, currentStatus: boolean) => {
        try {
            const res = await fetch('/api/admin/notifications/recipients', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, enabled: !currentStatus }),
            });

            if (!res.ok) throw new Error('Failed to update status');

            setRecipients(current => current.map(r =>
                r.id === id ? { ...r, enabled: !currentStatus } : r
            ));
        } catch {
            showMsg('error', 'Failed to change status');
        }
    };

    const deleteRecipient = async (id: string) => {
        if (!confirm('Delete this recipient?')) return;

        try {
            const res = await fetch(`/api/admin/notifications/recipients?id=${id}`, {
                method: 'DELETE',
            });

            if (!res.ok) throw new Error('Failed to delete');

            showMsg('success', 'Recipient removed successfully');
            setRecipients(current => current.filter(r => r.id !== id));
        } catch {
            showMsg('error', 'Failed to delete recipient');
        }
    };

    const handleSendTest = async () => {
        if (!testEmail || !testEmail.includes('@')) {
            showMsg('error', 'Invalid test email address');
            return;
        }

        setTestLoading(true);
        try {
            const res = await fetch('/api/admin/notifications/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: testEmail }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to send test email');

            showMsg('success', `Test email sent successfully to ${testEmail}`);
            setTestEmail('');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            showMsg('error', err.message);
        } finally {
            setTestLoading(false);
        }
    };

    const getEntityLabel = (entity: string) => {
        return ENTITIES.find(e => e.value === entity)?.label || entity;
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <BellRing className="w-5 h-5 text-blue-600" />
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Konfigurasi Notifikasi</h1>
                    </div>
                    <p className="text-slate-500 text-sm">Kelola daftar email yang menerima pemberitahuan setiap ada record baru.</p>
                </div>

                <button 
                    onClick={fetchRecipients}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all text-sm font-medium self-start md:self-end"
                >
                    <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                    Refresh
                </button>
            </div>

            {}
            {message && (
                <div className={cn(
                    "flex items-center gap-3 p-4 rounded-xl border animate-in zoom-in-95 duration-300",
                    message.type === 'success' ? "bg-emerald-50 border-emerald-100 text-emerald-800" : "bg-red-50 border-red-100 text-red-800"
                )}>
                    {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
                    <p className="text-sm font-medium">{message.text}</p>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {}
                <div className="lg:col-span-2 space-y-6">
                    {}
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-3">
                            <Filter className="w-4 h-4 text-slate-400" />
                            <select
                                value={selectedEntity}
                                onChange={(e) => setSelectedEntity(e.target.value)}
                                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none transition-all text-sm font-medium"
                            >
                                {ENTITIES.map((entity) => (
                                    <option key={entity.value} value={entity.value}>
                                        {entity.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Daftar Penerima</h2>
                            <span className="px-2.5 py-1 bg-white rounded-full text-[10px] font-bold text-slate-500 border border-slate-100">
                                {recipients.length} Alamat
                            </span>
                        </div>

                        {loading ? (
                            <div className="p-12 text-center">
                                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
                                <p className="text-slate-400 text-sm">Loading data...</p>
                            </div>
                        ) : recipients.length === 0 ? (
                            <div className="p-16 text-center">
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed border-slate-200">
                                    <Mail className="w-8 h-8 text-slate-300" />
                                </div>
                                <h3 className="text-slate-900 font-bold">Belum Ada Penerima</h3>
                                <p className="text-slate-500 text-sm mt-1">Add recipient emails for notifications below.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-slate-50/30">
                                            <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-400 uppercase">Email</th>
                                            <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-400 uppercase">Entity</th>
                                            <th className="px-6 py-3 text-center text-[11px] font-bold text-slate-400 uppercase">Status</th>
                                            <th className="px-6 py-3 text-right text-[11px] font-bold text-slate-400 uppercase">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {recipients.map((r) => (
                                            <tr key={r.id} className="group hover:bg-slate-50/80 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={cn(
                                                            "w-8 h-8 rounded-lg flex items-center justify-center border transition-colors",
                                                            r.enabled ? "bg-blue-50 border-blue-100 text-blue-600" : "bg-slate-50 border-slate-100 text-slate-400 opacity-50"
                                                        )}>
                                                            <Mail className="w-4 h-4" />
                                                        </div>
                                                        <span className={cn("text-sm font-semibold transition-opacity italic", !r.enabled && "opacity-50 text-slate-400")}>
                                                            {r.recipient_email}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium">
                                                        {getEntityLabel(r.entity)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex justify-center">
                                                        <button 
                                                            onClick={() => toggleEnabled(r.id, r.enabled)}
                                                            className={cn(
                                                                "p-1 rounded-full transition-all duration-300 transform active:scale-90",
                                                                r.enabled ? "text-emerald-500 hover:text-emerald-600" : "text-slate-300 hover:text-slate-400"
                                                            )}
                                                            title={r.enabled ? "Deactivate" : "Activate"}
                                                        >
                                                            {r.enabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex justify-end opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                        <button 
                                                            onClick={() => deleteRecipient(r.id)}
                                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                            title="Delete"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                </div>

                {}
                <div className="space-y-6">
                    {}
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xl space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Plus className="w-4 h-4 text-emerald-600" />
                            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Add New</h2>
                        </div>

                        <form onSubmit={handleAddRecipient} className="space-y-3">
                            <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Entity</label>
                                <select
                                    value={selectedEntity}
                                    onChange={(e) => setSelectedEntity(e.target.value)}
                                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm font-semibold"
                                >
                                    {ENTITIES.filter(e => e.value).map((entity) => (
                                        <option key={entity.value} value={entity.value}>
                                            {entity.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Alamat Email</label>
                                <div className="relative group">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                    <input 
                                        type="email"
                                        placeholder="email@company.com"
                                        value={newEmail}
                                        onChange={(e) => setNewEmail(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm font-semibold"
                                        required
                                    />
                                </div>
                            </div>

                            <button 
                                type="submit"
                                disabled={submitting}
                                className={cn(
                                    "w-full py-3 rounded-xl font-bold text-sm tracking-wide transition-all shadow-sm active:scale-95 flex items-center justify-center gap-3",
                                    submitting 
                                        ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                                        : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200/50"
                                )}
                            >
                                {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                {submitting ? 'Menambah...' : 'Save Recipient'}
                            </button>
                        </form>
                    </div>

                    {}
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xl space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Shield className="w-4 h-4 text-blue-600" />
                            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Cek Koneksi SMTP</h2>
                        </div>

                        <p className="text-[11px] text-slate-500 leading-relaxed italic">
                            Pastikan pengaturan SMTP Gmail sudah benar dan dapat mengirim email dari sistem OneClick.
                        </p>

                        <div className="space-y-3 pt-2">
                            <input 
                                type="email"
                                placeholder="Email tujuan pengetesan"
                                value={testEmail}
                                onChange={(e) => setTestEmail(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none transition-all text-sm font-medium"
                            />

                            <button 
                                onClick={handleSendTest}
                                disabled={testLoading}
                                className={cn(
                                    "w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2",
                                    testLoading
                                        ? "bg-slate-100 text-slate-400"
                                        : "bg-white border-2 border-blue-600 text-blue-600 hover:bg-blue-50"
                                )}
                            >
                                {testLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                {testLoading ? 'Mengirim...' : 'Kirim Email Test'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
