/**
 * @file
 * Client-safe types and constants for the DB-driven Quick Access bento grid.
 * Mirrors the external-links pattern: types + fallbacks only, no server imports.
 */

import type { LucideIcon } from 'lucide-react';
import {
    Link as LinkIcon,
    Link2,
    Bot,
    AlertTriangle,
    QrCode,
    ClipboardCheck,
    BookOpen,
    FileText,
    MessageSquare,
    CalendarCheck,
    Users,
    BellRing,
    ShieldCheck,
    Plane,
    MapPin,
    Phone,
    Mail,
    Globe,
    ExternalLink,
    HelpCircle,
    Star,
    ListChecks,
    Settings,
    Wrench,
    Zap,
    Eye,
    Shirt,
    Activity,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────

export type QASpan = '1x1' | '2x1' | '2x2' | '4x1';
export type QADisplayMode = 'qr' | 'links' | 'redirect' | 'form';
export type QAFormFieldType = 'text' | 'textarea' | 'select' | 'number' | 'date';
export type QAGateBy = 'ai_enabled' | null;
/** Maps a tile to the PublicReportWizard form flow (form-only, no content modal). */
export type QAWizardCategory = 'Irregularity' | 'JOUMPA' | null;

export const QA_WIZARD_CATEGORIES = ['Irregularity', 'JOUMPA'] as const;
export const WIZARD_CATEGORY_LABELS: Record<string, string> = {
    Irregularity: 'Form Irregularity (Wizard)',
    JOUMPA: 'Form JOUMPA (Wizard)',
};

export interface QALinkEntry { label: string; url: string }
export interface QALinkEntryWithSub { label: string; sublabel?: string; url: string }
export interface QAFormField {
    key: string;
    label: string;
    type: QAFormFieldType;
    required?: boolean;
    options?: string[];
}
export interface QAFormContent { formTitle?: string; fields: QAFormField[] }
export interface QARedirectContent { label: string; url: string }

export type QATileContent =
    | { qrLinks: QALinkEntry[] }
    | { links: QALinkEntryWithSub[] }
    | { label: string; url: string }
    | QAFormContent;

export interface QuickAccessTileDTO {
    id: string;
    section_id: string;
    title: string;
    description: string;
    icon: string;
    color: string;
    span: QASpan;
    display_mode: QADisplayMode;
    content: QATileContent;
    is_visible: boolean;
    gated_by: QAGateBy;
    wizard_category: QAWizardCategory;
    is_password_protected: boolean;
    sort_order: number;
}

/** Admin-side tile: adds fields never sent to the public employee page. */
export interface QuickAccessAdminTile extends QuickAccessTileDTO {
    password_hash: string | null;
    submissions_count: number;
}

export interface QuickAccessSectionDTO {
    id: string;
    title: string;
    description: string;
    sort_order: number;
    is_visible: boolean;
    tiles: QuickAccessTileDTO[];
}

export interface QuickAccessConfigDTO {
    enabled: boolean;
    aiEnabled: boolean;
    sections: QuickAccessSectionDTO[];
}

export interface QuickAccessAdminConfigDTO {
    settings: { ai_enabled: boolean; quick_access_enabled: boolean };
    sections: Array<Omit<QuickAccessSectionDTO, 'tiles'> & { tiles: QuickAccessAdminTile[] }>;
}

// ── Icons (curated whitelist) ────────────────────────────────────────────

export const QUICK_ACCESS_ICON_MAP: Record<string, LucideIcon> = {
    link: LinkIcon,
    'link-2': Link2,
    bot: Bot,
    'alert-triangle': AlertTriangle,
    'qr-code': QrCode,
    'clipboard-check': ClipboardCheck,
    'book-open': BookOpen,
    'file-text': FileText,
    'message-square': MessageSquare,
    'calendar-check': CalendarCheck,
    users: Users,
    'bell-ring': BellRing,
    'shield-check': ShieldCheck,
    plane: Plane,
    'map-pin': MapPin,
    phone: Phone,
    mail: Mail,
    globe: Globe,
    'external-link': ExternalLink,
    'help-circle': HelpCircle,
    star: Star,
    'list-checks': ListChecks,
    settings: Settings,
    wrench: Wrench,
    zap: Zap,
    eye: Eye,
    shirt: Shirt,
    activity: Activity,
};

export const QUICK_ACCESS_ICON_NAMES = Object.keys(QUICK_ACCESS_ICON_MAP);

export function getQAIcon(name: string | undefined | null): LucideIcon {
    return QUICK_ACCESS_ICON_MAP[name || ''] || LinkIcon;
}

// ── Spans → Tailwind classes ─────────────────────────────────────────────
// Matches the public grid: grid-cols-1 sm:grid-cols-2 lg:grid-cols-4.
// Mobile: full width (grid-cols-1); sm (2 cols): col-span-2 = full row;
// lg (4 cols): col-span-2 = half, col-span-4 = full.

export const SPAN_CLASSES: Record<QASpan, string> = {
    '1x1': 'col-span-1 row-span-1',
    '2x1': 'col-span-1 sm:col-span-2 lg:col-span-2 row-span-1',
    '2x2': 'col-span-1 row-span-1 sm:col-span-2 sm:row-span-2 lg:col-span-2 lg:row-span-2',
    '4x1': 'col-span-1 sm:col-span-2 lg:col-span-4 row-span-1',
};

export const SPAN_LABELS: Record<QASpan, string> = {
    '1x1': 'Kecil (1×1)',
    '2x1': 'Lebar (2×1)',
    '2x2': 'Besar (2×2)',
    '4x1': 'Full width (4×1)',
};

export function getSASpanClass(span: string | undefined | null): string {
    return SPAN_CLASSES[(span as QASpan) || '1x1'] || SPAN_CLASSES['1x1'];
}

// ── Colors (presets shown in admin picker) ───────────────────────────────

export const COLOR_PRESETS: string[] = [
    'oklch(0.60 0.18 260)', // blue (AI)
    'oklch(0.55 0.22 30)',  // red (irregularity)
    'oklch(0.50 0.15 190)', // teal
    'oklch(0.45 0.18 240)', // indigo (SLA)
    'oklch(0.60 0.20 340)', // pink (survey)
    'oklch(0.55 0.18 180)', // cyan (WSN)
    'oklch(0.45 0.20 160)', // green (handbook)
    'oklch(0.62 0.20 90)',  // amber
    'oklch(0.60 0.22 25)',  // orange
    'oklch(0.55 0.22 320)', // magenta
    'oklch(0.50 0.18 140)', // emerald
    'oklch(0.55 0.15 300)', // purple
];

export function sanitizeColor(color: string | undefined | null): string {
    const c = (color || '').trim();
    if (!c) return COLOR_PRESETS[0];
    if (c.startsWith('oklch(') || c.startsWith('#')) return c;
    return COLOR_PRESETS[0];
}

// ── Labels ───────────────────────────────────────────────────────────────

export const DISPLAY_MODE_LABELS: Record<QADisplayMode, string> = {
    qr: 'QR Code + Link',
    links: 'List Link',
    redirect: 'Tombol Redirect',
    form: 'Form Built-in',
};

export const FORM_FIELD_TYPES: QAFormFieldType[] = ['text', 'textarea', 'select', 'number', 'date'];

export const FORM_FIELD_TYPE_LABELS: Record<QAFormFieldType, string> = {
    text: 'Text',
    textarea: 'Textarea',
    select: 'Dropdown',
    number: 'Angka',
    date: 'Tanggal',
};

export const GATE_BY_LABELS: Record<string, string> = {
    ai_enabled: 'AI "I am in Charge"',
};
