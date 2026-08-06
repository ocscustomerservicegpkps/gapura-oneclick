'use client';

import { useState } from 'react';
import Link from 'next/link';
import { X, ExternalLink, ArrowRight, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { QRCodeWithLogo } from '@/components/ui/QRCodeWithLogo';
import { QAIcon } from '@/components/quick-access/QAIcon';
import {
    sanitizeColor,
    type QuickAccessTileDTO,
    type QAFormField,
} from '@/lib/quick-access';

interface QuickAccessTileModalProps {
    tile: QuickAccessTileDTO | null;
    onClose: () => void;
}

function EmptyContent() {
    return (
        <div className="py-12 text-center">
            <p className="text-sm font-bold text-black/50">Konten belum dikonfigurasi</p>
            <p className="text-xs text-black/40 mt-1">Hubungi admin untuk melengkapi akses cepat ini.</p>
        </div>
    );
}

function QRMode({ content }: { content: { qrLinks: { label: string; url: string }[] } }) {
    return (
        <div className={`grid gap-8 ${content.qrLinks.length > 1 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'} place-items-center`}>
            {content.qrLinks.map((item, idx) => (
                <div key={idx} className="space-y-4 w-full max-w-sm rounded-3xl border border-black/10 bg-white p-5 shadow">
                    <div className="aspect-square rounded-3xl overflow-hidden bg-white border border-black/10 p-6 shadow-sm flex items-center justify-center">
                        <QRCodeWithLogo value={item.url} size={256} fgColor="#0ea5a6" />
                    </div>
                    <div className="text-center">
                        <h4 className="text-lg font-extrabold">{item.label}</h4>
                    </div>
                    <div className="space-y-2 rounded-2xl border border-cyan-100 bg-cyan-50/70 p-3">
                        <label className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">Link {item.label}</label>
                        <input readOnly value={item.url} className="w-full px-3 py-2 rounded-lg border border-black/10 bg-white text-sm font-semibold" />
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => navigator.clipboard.writeText(item.url)}
                                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold active:scale-95"
                            >
                                Copy Link
                            </button>
                            <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 rounded-lg bg-white text-black text-center text-sm font-bold border border-black/10 active:scale-95"
                            >
                                Click Here
                            </a>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

function LinksMode({ content, iconName, color }: { content: { links: { label: string; sublabel?: string; url: string }[] }; iconName: string; color: string }) {
    return (
        <div className="flex flex-col gap-4 w-full max-w-2xl">
            {content.links.map((link, i) => (
                <a
                    key={i}
                    href={link.url}
                    target={link.url.startsWith('/') ? undefined : '_blank'}
                    rel={link.url.startsWith('/') ? undefined : 'noopener noreferrer'}
                    className="group flex items-center gap-4 p-5 rounded-2xl bg-white border border-black/10 hover:border-emerald-500/40 transition"
                >
                    <QAIcon name={iconName} className="w-6 h-6" style={{ color }} />
                    <div className="flex-1">
                        <div className="text-base font-extrabold">{link.label}</div>
                        {link.sublabel ? <div className="text-xs text-black/60 font-bold">{link.sublabel}</div> : null}
                    </div>
                    <ExternalLink className="w-5 h-5 text-black/20 group-hover:text-emerald-600" />
                </a>
            ))}
        </div>
    );
}

function RedirectMode({ content }: { content: { label: string; url: string } }) {
    const internal = content.url.startsWith('/');
    return (
        <div className="space-y-4">
            <div className="text-sm text-black/70 font-bold">
                Gunakan akses cepat untuk membuka {content.label.toLowerCase()}.
            </div>
            <div className="flex flex-wrap items-center gap-3">
                {internal ? (
                    <Link
                        href={content.url}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 text-white font-black"
                    >
                        {content.label}
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                ) : (
                    <a
                        href={content.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 text-white font-black"
                    >
                        {content.label}
                        <ArrowRight className="w-4 h-4" />
                    </a>
                )}
            </div>
        </div>
    );
}

function FormMode({ tile, content }: { tile: QuickAccessTileDTO; content: { formTitle?: string; fields: QAFormField[] } }) {
    const [values, setValues] = useState<Record<string, unknown>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/quick-access/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tileId: tile.id, data: values }),
            });
            if (res.ok) {
                setSuccess(true);
                return;
            }
            const data = await res.json().catch(() => ({}));
            setError(data.error || 'Gagal menyimpan data. Coba lagi.');
        } catch {
            setError('Gagal menyimpan data. Coba lagi.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="py-12 text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                <h4 className="text-lg font-extrabold">Terima kasih!</h4>
                <p className="text-sm text-black/60 font-bold">Data Anda berhasil disimpan.</p>
                <button
                    onClick={() => { setSuccess(false); setValues({}); }}
                    className="mt-2 px-4 py-2 rounded-xl border border-black/10 text-sm font-bold hover:bg-black/5"
                >
                    Isi Lagi
                </button>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-2xl">
            {content.formTitle ? (
                <h4 className="text-lg font-extrabold">{content.formTitle}</h4>
            ) : null}
            {content.fields.map((field) => (
                <div key={field.key}>
                    <label className="block text-xs font-black uppercase tracking-widest text-black/50 mb-1.5">
                        {field.label}{field.required ? ' *' : ''}
                    </label>
                    {field.type === 'textarea' ? (
                        <textarea
                            value={String(values[field.key] ?? '')}
                            onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                            required={field.required}
                            rows={3}
                            className="w-full px-3 py-2.5 rounded-xl border border-black/10 text-sm focus:border-emerald-500/50 outline-none transition-all"
                        />
                    ) : field.type === 'select' ? (
                        <select
                            value={String(values[field.key] ?? '')}
                            onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                            required={field.required}
                            className="w-full px-3 py-2.5 rounded-xl border border-black/10 text-sm bg-white focus:border-emerald-500/50 outline-none transition-all"
                        >
                            <option value="">— Pilih —</option>
                            {(field.options || []).map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                    ) : (
                        <input
                            type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                            value={String(values[field.key] ?? '')}
                            onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                            required={field.required}
                            className="w-full px-3 py-2.5 rounded-xl border border-black/10 text-sm focus:border-emerald-500/50 outline-none transition-all"
                        />
                    )}
                </div>
            ))}
            {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-bold">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
            )}
            <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white text-sm font-black hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-50"
            >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Kirim'}
            </button>
        </form>
    );
}

export function QuickAccessTileModal({ tile, onClose }: QuickAccessTileModalProps) {
    if (!tile) return null;

    const color = sanitizeColor(tile.color);
    const content = tile.content as Record<string, unknown>;

    const renderContent = () => {
        switch (tile.display_mode) {
            case 'qr':
                return Array.isArray(content.qrLinks) && content.qrLinks.length > 0
                    ? <QRMode content={content as { qrLinks: { label: string; url: string }[] }} />
                    : <EmptyContent />;
            case 'links':
                return Array.isArray(content.links) && content.links.length > 0
                    ? <LinksMode content={content as { links: { label: string; sublabel?: string; url: string }[] }} iconName={tile.icon} color={color} />
                    : <EmptyContent />;
            case 'redirect':
                return typeof content.url === 'string' && content.url
                    ? <RedirectMode content={content as { label: string; url: string }} />
                    : <EmptyContent />;
            case 'form':
                return Array.isArray(content.fields) && content.fields.length > 0
                    ? <FormMode tile={tile} content={content as { formTitle?: string; fields: QAFormField[] }} />
                    : <EmptyContent />;
            default:
                return <EmptyContent />;
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-6">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-4xl bg-white rounded-t-3xl md:rounded-3xl border border-black/10 shadow-xl overflow-hidden max-h-[90dvh] flex flex-col">
                <div className="flex items-center justify-between p-5 border-b border-black/10 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}20` }}>
                            <QAIcon name={tile.icon} className="w-5 h-5" style={{ color }} />
                        </div>
                        <h3 className="text-lg font-extrabold">{tile.title}</h3>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-black/5" aria-label="Close">
                        <X className="w-5 h-5 text-black/60" />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto">{renderContent()}</div>
            </div>
        </div>
    );
}
