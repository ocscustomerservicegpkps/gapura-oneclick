'use client';

import { useState } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import type { QuickAccessSectionDTO } from '@/lib/quick-access';

interface SectionEditorModalProps {
    section: QuickAccessSectionDTO | null; // null → create new
    onClose: () => void;
    onSave: (body: Record<string, unknown>) => Promise<void>;
    isSaving: boolean;
}

const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-black/10 text-sm focus:border-emerald-500/50 outline-none transition-all';

export function SectionEditorModal({ section, onClose, onSave, isSaving }: SectionEditorModalProps) {
    const [title, setTitle] = useState(section?.title || '');
    const [description, setDescription] = useState(section?.description || '');
    const [isVisible, setIsVisible] = useState(section?.is_visible ?? true);
    const [error, setError] = useState('');

    const handleSave = () => {
        setError('');
        if (!title.trim()) {
            setError('Judul section wajib diisi.');
            return;
        }
        const body: Record<string, unknown> = { title: title.trim(), description: description.trim(), is_visible: isVisible };
        if (section) body.id = section.id;
        void onSave(body);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-5">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-extrabold">{section ? 'Edit Section' : 'Tambah Section'}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-lg transition-colors" aria-label="Close">
                        <X size={20} />
                    </button>
                </div>

                {error && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-bold">
                        <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                    </div>
                )}

                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-black/50 mb-1">Judul *</label>
                        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nama section" className={inputCls} />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-black/50 mb-1">Deskripsi</label>
                        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Deskripsi singkat" className={inputCls} />
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsVisible((v) => !v)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-bold transition-all ${
                            isVisible ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-black/10 text-black/50'
                        }`}
                    >
                        <span>{isVisible ? 'Section tampil' : 'Section tersembunyi'}</span>
                        <span className="text-xs">{isVisible ? 'Semua tile-nya ikut tersembunyi' : 'Klik untuk tampilkan'}</span>
                    </button>
                </div>

                <div className="flex gap-3 pt-2">
                    <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-black/10 text-sm font-bold hover:bg-black/5 transition-all">
                        Batal
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold disabled:opacity-50 active:scale-95 transition-all"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Simpan'}
                    </button>
                </div>
            </div>
        </div>
    );
}
