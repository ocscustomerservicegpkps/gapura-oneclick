import { FileSpreadsheet, FileText, Image as ImageIcon, Music, Paperclip, Video } from 'lucide-react';
import type { ComponentType } from 'react';

interface FileKind {
    ext: string;
    icon: ComponentType<{ className?: string }>;
    className: string;
}

const KINDS: Array<{ exts: string[]; icon: FileKind['icon']; className: string }> = [
    { exts: ['xlsx', 'xls', 'csv'], icon: FileSpreadsheet, className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
    { exts: ['doc', 'docx'], icon: FileText, className: 'border-blue-200 bg-blue-50 text-blue-700' },
    { exts: ['pdf'], icon: FileText, className: 'border-red-200 bg-red-50 text-red-700' },
    { exts: ['jpg', 'jpeg', 'png', 'gif', 'webp'], icon: ImageIcon, className: 'border-purple-200 bg-purple-50 text-purple-700' },
    { exts: ['mp4', 'mov', 'avi', 'mkv', 'webm'], icon: Video, className: 'border-orange-200 bg-orange-50 text-orange-700' },
    { exts: ['mp3', 'wav', 'm4a'], icon: Music, className: 'border-amber-200 bg-amber-50 text-amber-700' },
];

export function getFileKind(url?: string | null): FileKind {
    const path = (url || '').split('?')[0].split('#')[0].toLowerCase();
    const ext = path.split('.').pop() || '';
    const match = KINDS.find((k) => k.exts.includes(ext));
    if (match) return { ext: ext.toUpperCase(), icon: match.icon, className: match.className };
    return { ext: 'LINK', icon: Paperclip, className: 'border-slate-200 bg-slate-50 text-slate-700' };
}
