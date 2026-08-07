'use client';

import { useState } from 'react';
import { X, Plus, Trash2, Loader2, AlertCircle } from 'lucide-react';
import {
    SPAN_LABELS,
    FORM_FIELD_TYPES,
    FORM_FIELD_TYPE_LABELS,
    type QASpan,
    type QAFormField,
    type QAFormFieldType,
    type QATileContent,
    type QuickAccessAdminTile,
} from '@/lib/quick-access';

/** Dialog type = display mode, wizard forms merged in (no separate wizard_category select). */
type DialogType = 'qr' | 'links' | 'redirect' | 'form' | 'wizard-Irregularity' | 'wizard-JOUMPA';

const DIALOG_TYPES: { value: DialogType; label: string }[] = [
    { value: 'qr', label: 'QR Code + Link' },
    { value: 'links', label: 'Daftar Link' },
    { value: 'redirect', label: 'Tombol Redirect' },
    { value: 'form', label: 'Form Built-in' },
    { value: 'wizard-Irregularity', label: 'Form Irregularity (Wizard)' },
    { value: 'wizard-JOUMPA', label: 'Form JOUMPA (Wizard)' },
];

interface TileEditorModalProps {
    tile: QuickAccessAdminTile | null; // null → create new
    sectionId: string;
    onClose: () => void;
    onSave: (body: Record<string, unknown>) => Promise<void>;
    isSaving: boolean;
}

interface LinkRow { label: string; sublabel?: string; url: string }
interface QrRow { label: string; url: string }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-black/50 mb-1">{label}</label>
            {children}
        </div>
    );
}

const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-black/10 text-sm focus:border-emerald-500/50 outline-none transition-all';
const selectCls = 'w-full px-3 py-2.5 rounded-xl border border-black/10 text-sm bg-white focus:border-emerald-500/50 outline-none transition-all';

function initialDialogType(tile: QuickAccessAdminTile | null): DialogType {
    if (tile?.wizard_category) return `wizard-${tile.wizard_category}` as DialogType;
    return (tile?.display_mode as DialogType) || 'links';
}

export function TileEditorModal({ tile, sectionId, onClose, onSave, isSaving }: TileEditorModalProps) {
    const [title, setTitle] = useState(tile?.title || '');
    const [description, setDescription] = useState(tile?.description || '');
    const [dialogType, setDialogType] = useState<DialogType>(() => initialDialogType(tile));
    const [span, setSpan] = useState<QASpan>(tile?.span || '1x1');
    const [isVisible, setIsVisible] = useState(tile?.is_visible ?? true);
    const [isMaintenance, setIsMaintenance] = useState(tile?.is_maintenance ?? false);

    const existingContent = tile?.content as Record<string, unknown> | undefined;
    const [qrLinks, setQrLinks] = useState<QrRow[]>(
        Array.isArray(existingContent?.qrLinks) ? (existingContent.qrLinks as QrRow[]).map((r) => ({ ...r })) : [{ label: '', url: '' }]
    );
    const [links, setLinks] = useState<LinkRow[]>(
        Array.isArray(existingContent?.links) ? (existingContent.links as LinkRow[]).map((r) => ({ ...r })) : [{ label: '', url: '' }]
    );
    const [redirectLabel, setRedirectLabel] = useState(typeof existingContent?.label === 'string' ? existingContent.label : 'Buka');
    const [redirectUrl, setRedirectUrl] = useState(typeof existingContent?.url === 'string' ? existingContent.url : '');
    const [formTitle, setFormTitle] = useState(typeof existingContent?.formTitle === 'string' ? existingContent.formTitle : '');
    const [formFields, setFormFields] = useState<QAFormField[]>(
        Array.isArray(existingContent?.fields) ? (existingContent.fields as QAFormField[]).map((f) => ({ ...f, options: [...(f.options || [])] })) : []
    );

    const [password, setPassword] = useState('');
    const [clearPassword, setClearPassword] = useState(false);
    const [error, setError] = useState('');

    const isWizard = dialogType.startsWith('wizard-');

    const buildContent = (): QATileContent | null => {
        switch (dialogType) {
            case 'qr': {
                const rows = qrLinks.filter((r) => r.label.trim() && r.url.trim());
                if (rows.length === 0) { setError('Minimal satu link QR wajib diisi.'); return null; }
                return { qrLinks: rows };
            }
            case 'links': {
                const rows = links.filter((r) => r.label.trim() && r.url.trim());
                if (rows.length === 0) { setError('Minimal satu link wajib diisi.'); return null; }
                return { links: rows };
            }
            case 'redirect':
                if (!redirectUrl.trim()) { setError('URL redirect wajib diisi.'); return null; }
                return { label: redirectLabel.trim() || 'Buka', url: redirectUrl.trim() };
            case 'form': {
                const fields = formFields.filter((f) => f.key.trim() && f.label.trim());
                if (fields.length === 0) { setError('Minimal satu field form wajib diisi.'); return null; }
                return { formTitle: formTitle.trim() || undefined, fields };
            }
            default:
                return {} as QATileContent; // ponytail: wizard tiles carry no content; server stores {} and ignores it
        }
    };

    const handleSave = () => {
        setError('');
        if (!title.trim()) { setError('Judul tile wajib diisi.'); return; }
        const content = buildContent();
        if (content === null) return;

        const body: Record<string, unknown> = {
            title: title.trim(),
            description: description.trim(),
            span,
            display_mode: isWizard ? 'links' : dialogType,
            wizard_category: isWizard ? dialogType.slice('wizard-'.length) : null,
            content,
            is_visible: isVisible,
            is_maintenance: isMaintenance,
            section_id: sectionId,
        };
        if (tile) body.id = tile.id;
        if (password.trim()) body.password = password.trim();
        if (clearPassword) body.clearPassword = true;

        void onSave(body);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full max-h-[90dvh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-black/5 shrink-0">
                    <h3 className="text-lg font-extrabold">{tile ? 'Edit Tile' : 'Tambah Tile'}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-lg transition-colors" aria-label="Close">
                        <X size={20} />
                    </button>
                </div>

                <div className="px-6 py-5 overflow-y-auto space-y-5">
                    {error && (
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-bold">
                            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                        </div>
                    )}

                    <Field label="Judul *">
                        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nama tile" className={inputCls} />
                    </Field>
                    <Field label="Deskripsi">
                        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Deskripsi singkat" className={inputCls} />
                    </Field>

                    <Field label="Jenis Dialog *">
                        <select value={dialogType} onChange={(e) => setDialogType(e.target.value as DialogType)} className={selectCls}>
                            {DIALOG_TYPES.map((d) => (
                                <option key={d.value} value={d.value}>{d.label}</option>
                            ))}
                        </select>
                    </Field>

                    {isWizard ? (
                        <p className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                            Klik tile langsung membuka form laporan ({dialogType.slice('wizard-'.length)}) — konten tidak diperlukan.
                        </p>
                    ) : dialogType === 'qr' ? (
                        <div>
                            <span className="block text-[10px] font-black uppercase tracking-widest text-black/50 mb-2">Link QR Code</span>
                            <div className="space-y-3">
                                {qrLinks.map((row, i) => (
                                    <div key={i} className="flex gap-2 items-start">
                                        <div className="flex-1 space-y-2">
                                            <input value={row.label} onChange={(e) => setQrLinks((rows) => rows.map((r, j) => j === i ? { ...r, label: e.target.value } : r))} placeholder="Label (mis. Staff JOUMPA Report)" className={inputCls} />
                                            <input value={row.url} onChange={(e) => setQrLinks((rows) => rows.map((r, j) => j === i ? { ...r, url: e.target.value } : r))} placeholder="https://..." className={`${inputCls} font-mono`} />
                                        </div>
                                        <button type="button" onClick={() => setQrLinks((rows) => rows.filter((_, j) => j !== i))} className="p-2.5 rounded-xl border border-black/10 text-red-500 hover:bg-red-50 mt-1" aria-label="Hapus">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                                {qrLinks.length < 10 && (
                                    <button type="button" onClick={() => setQrLinks((rows) => [...rows, { label: '', url: '' }])} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-black/20 text-sm font-bold text-black/60 hover:border-emerald-500/50 hover:text-emerald-600">
                                        <Plus size={14} /> Tambah Link
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : dialogType === 'links' ? (
                        <div>
                            <span className="block text-[10px] font-black uppercase tracking-widest text-black/50 mb-2">Daftar Link</span>
                            <div className="space-y-3">
                                {links.map((row, i) => (
                                    <div key={i} className="flex gap-2 items-start">
                                        <div className="flex-1 space-y-2">
                                            <div className="grid grid-cols-2 gap-2">
                                                <input value={row.label} onChange={(e) => setLinks((rows) => rows.map((r, j) => j === i ? { ...r, label: e.target.value } : r))} placeholder="Label" className={inputCls} />
                                                <input value={row.sublabel || ''} onChange={(e) => setLinks((rows) => rows.map((r, j) => j === i ? { ...r, sublabel: e.target.value } : r))} placeholder="Sublabel (opsional)" className={inputCls} />
                                            </div>
                                            <input value={row.url} onChange={(e) => setLinks((rows) => rows.map((r, j) => j === i ? { ...r, url: e.target.value } : r))} placeholder="https://... atau /path-internal" className={`${inputCls} font-mono`} />
                                        </div>
                                        <button type="button" onClick={() => setLinks((rows) => rows.filter((_, j) => j !== i))} className="p-2.5 rounded-xl border border-black/10 text-red-500 hover:bg-red-50 mt-1" aria-label="Hapus">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                                {links.length < 10 && (
                                    <button type="button" onClick={() => setLinks((rows) => [...rows, { label: '', url: '' }])} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-black/20 text-sm font-bold text-black/60 hover:border-emerald-500/50 hover:text-emerald-600">
                                        <Plus size={14} /> Tambah Link
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : dialogType === 'redirect' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Field label="Label Tombol">
                                <input value={redirectLabel} onChange={(e) => setRedirectLabel(e.target.value)} placeholder="Buka" className={inputCls} />
                            </Field>
                            <Field label="URL / Path *">
                                <input value={redirectUrl} onChange={(e) => setRedirectUrl(e.target.value)} placeholder="https://... atau /auth/public-report" className={`${inputCls} font-mono`} />
                            </Field>
                        </div>
                    ) : (
                        <div>
                            <span className="block text-[10px] font-black uppercase tracking-widest text-black/50 mb-2">Form Built-in</span>
                            <div className="space-y-3">
                                <Field label="Judul Form (opsional)">
                                    <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Judul form" className={inputCls} />
                                </Field>
                                {formFields.map((field, i) => (
                                    <div key={i} className="p-4 rounded-xl border border-black/10 space-y-2">
                                        <div className="grid grid-cols-2 gap-2">
                                            <input value={field.key} onChange={(e) => setFormFields((fields) => fields.map((f, j) => j === i ? { ...f, key: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_') } : f))} placeholder="key (mis. nama)" className={`${inputCls} font-mono`} />
                                            <input value={field.label} onChange={(e) => setFormFields((fields) => fields.map((f, j) => j === i ? { ...f, label: e.target.value } : f))} placeholder="Label (mis. Nama Lengkap)" className={inputCls} />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <select value={field.type} onChange={(e) => setFormFields((fields) => fields.map((f, j) => j === i ? { ...f, type: e.target.value as QAFormFieldType } : f))} className={`${selectCls} w-36`}>
                                                {FORM_FIELD_TYPES.map((t) => (
                                                    <option key={t} value={t}>{FORM_FIELD_TYPE_LABELS[t]}</option>
                                                ))}
                                            </select>
                                            <label className="flex items-center gap-2 text-xs font-bold text-black/60 cursor-pointer">
                                                <input type="checkbox" checked={!!field.required} onChange={(e) => setFormFields((fields) => fields.map((f, j) => j === i ? { ...f, required: e.target.checked } : f))} className="accent-emerald-600" />
                                                Wajib
                                            </label>
                                            <button type="button" onClick={() => setFormFields((fields) => fields.filter((_, j) => j !== i))} className="ml-auto p-2 rounded-lg text-red-500 hover:bg-red-50" aria-label="Hapus field">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                        {field.type === 'select' && (
                                            <div className="flex flex-wrap gap-2">
                                                {(field.options || []).map((opt, k) => (
                                                    <span key={k} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-black/5 text-xs font-bold">
                                                        {opt}
                                                        <button type="button" onClick={() => setFormFields((fields) => fields.map((f, j) => j === i ? { ...f, options: (f.options || []).filter((_, m) => m !== k) } : f))} className="text-black/40 hover:text-red-500">
                                                            <X size={12} />
                                                        </button>
                                                    </span>
                                                ))}
                                                <input
                                                    placeholder="+ Opsi"
                                                    className="px-2 py-1 rounded-lg border border-dashed border-black/20 text-xs outline-none w-20"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                                                            const val = (e.target as HTMLInputElement).value.trim();
                                                            setFormFields((fields) => fields.map((f, j) => j === i ? { ...f, options: [...(f.options || []), val] } : f));
                                                            (e.target as HTMLInputElement).value = '';
                                                        }
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {formFields.length < 20 && (
                                    <button type="button" onClick={() => setFormFields((fields) => [...fields, { key: '', label: '', type: 'text', required: false }])} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-black/20 text-sm font-bold text-black/60 hover:border-emerald-500/50 hover:text-emerald-600">
                                        <Plus size={14} /> Tambah Field
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field label="Ukuran Tile">
                            <select value={span} onChange={(e) => setSpan(e.target.value as QASpan)} className={selectCls}>
                                {Object.entries(SPAN_LABELS).map(([key, label]) => (
                                    <option key={key} value={key}>{label}</option>
                                ))}
                            </select>
                        </Field>
                    </div>

                    {/* Toggles: Visibility + Maintenance */}
                    <div className="space-y-3 p-4 rounded-xl border border-black/5 bg-black/[0.02]">
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="text-sm font-extrabold">Tampilkan Tile</span>
                                <p className="text-[11px] text-black/40 font-medium">Nonaktifkan untuk menyembunyikan tile dari quick access</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsVisible((v) => !v)}
                                className={`relative w-10 h-6 rounded-full transition-colors ${
                                    isVisible ? 'bg-emerald-600' : 'bg-black/15'
                                }`}
                                role="switch"
                                aria-checked={isVisible}
                                aria-label="Toggle tampil tile"
                            >
                                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${isVisible ? 'left-[18px]' : 'left-0.5'}`} />
                            </button>
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="text-sm font-extrabold">Mode Maintenance</span>
                                <p className="text-[11px] text-black/40 font-medium">Jika aktif, tile menampilkan dialog &ldquo;sedang maintenance&rdquo; saat diklik</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsMaintenance((v) => !v)}
                                className={`relative w-10 h-6 rounded-full transition-colors ${
                                    isMaintenance ? 'bg-amber-500' : 'bg-black/15'
                                }`}
                                role="switch"
                                aria-checked={isMaintenance}
                                aria-label="Toggle maintenance tile"
                            >
                                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${isMaintenance ? 'left-[18px]' : 'left-0.5'}`} />
                            </button>
                        </div>
                    </div>

                    <div>
                        <span className="block text-[10px] font-black uppercase tracking-widest text-black/50 mb-1">Password Tile</span>
                        {tile?.is_password_protected && !clearPassword ? (
                            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                                <span className="text-xs font-bold text-emerald-700">Terproteksi password</span>
                                <button type="button" onClick={() => setClearPassword(true)} className="text-xs font-black text-red-600 hover:underline">
                                    Hapus Password
                                </button>
                            </div>
                        ) : (
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Password baru (opsional)"
                                className={inputCls}
                            />
                        )}
                        {clearPassword && (
                            <button type="button" onClick={() => setClearPassword(false)} className="mt-1 text-xs font-bold text-black/50 hover:underline">
                                Batal hapus password
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-3 px-6 py-4 border-t border-black/5 shrink-0">
                    <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-black/10 text-sm font-bold hover:bg-black/5 transition-all">
                        Batal
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold disabled:opacity-50 active:scale-95 transition-all"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan'}
                    </button>
                </div>
            </div>
        </div>
    );
}
