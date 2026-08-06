/**
 * @file
 * Server-only DB reads/validation for the Quick Access bento grid.
 * All access flows through supabaseAdmin (service role) — mirrors the
 * external-links-server pattern. Never imported from client code.
 */

import 'server-only';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
    type QASpan,
    type QADisplayMode,
    type QATileContent,
    type QAFormField,
    type QuickAccessConfigDTO,
    type QuickAccessAdminConfigDTO,
} from '@/lib/quick-access';

// ── Settings helpers ─────────────────────────────────────────────────────

const DEFAULT_SETTINGS = { ai_enabled: false, quick_access_enabled: true };

async function getSettings(): Promise<{ ai_enabled: boolean; quick_access_enabled: boolean }> {
    const { data, error } = await supabaseAdmin
        .from('quick_access_settings')
        .select('key, value');
    if (error || !data || data.length === 0) return { ...DEFAULT_SETTINGS };
    const out = { ...DEFAULT_SETTINGS };
    for (const row of data) {
        if (row.key === 'ai_enabled' || row.key === 'quick_access_enabled') {
            out[row.key] = row.value === true || row.value === 'true';
        }
    }
    return out;
}

// ── Public config (employee page) ────────────────────────────────────────

/** Explicit column list — password_hash is NEVER selected here. */
const PUBLIC_TILE_COLUMNS = 'id, section_id, title, description, icon, color, span, display_mode, content, is_visible, gated_by, wizard_category, is_password_protected, sort_order';

export async function getPublicQuickAccess(): Promise<QuickAccessConfigDTO> {
    const settings = await getSettings();

    const [sectionsRes, tilesRes] = await Promise.all([
        supabaseAdmin
            .from('quick_access_sections')
            .select('id, title, description, sort_order, is_visible')
            .eq('is_visible', true)
            .order('sort_order'),
        supabaseAdmin
            .from('quick_access_tiles')
            .select(PUBLIC_TILE_COLUMNS)
            .eq('is_visible', true)
            .order('sort_order'),
    ]);

    if (sectionsRes.error) throw new Error(sectionsRes.error.message);
    if (tilesRes.error) throw new Error(tilesRes.error.message);

    const sections = (sectionsRes.data || []).map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        sort_order: s.sort_order,
        is_visible: s.is_visible,
        tiles: (tilesRes.data || [])
            .filter((t) => t.section_id === s.id)
            .map((t) => ({ ...t, content: t.content as QATileContent })),
    }));

    return {
        enabled: settings.quick_access_enabled,
        aiEnabled: settings.ai_enabled,
        sections,
    };
}

// ── Admin config (full, incl. protected flags + submission counts) ───────

export async function getAdminQuickAccess(): Promise<QuickAccessAdminConfigDTO> {
    const settings = await getSettings();

    const [sectionsRes, tilesRes, countsRes] = await Promise.all([
        supabaseAdmin
            .from('quick_access_sections')
            .select('id, title, description, sort_order, is_visible')
            .order('sort_order'),
        supabaseAdmin
            .from('quick_access_tiles')
            .select('*')
            .order('sort_order'),
        supabaseAdmin
            .from('quick_access_submissions')
            .select('tile_id'),
    ]);

    if (sectionsRes.error) throw new Error(sectionsRes.error.message);
    if (tilesRes.error) throw new Error(tilesRes.error.message);
    if (countsRes.error) throw new Error(countsRes.error.message);

    const counts: Record<string, number> = {};
    for (const row of countsRes.data || []) {
        counts[row.tile_id] = (counts[row.tile_id] || 0) + 1;
    }

    const sections = (sectionsRes.data || []).map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        sort_order: s.sort_order,
        is_visible: s.is_visible,
        tiles: (tilesRes.data || [])
            .filter((t) => t.section_id === s.id)
            .map((t) => ({
                ...t,
                content: t.content as QATileContent,
                submissions_count: counts[t.id] || 0,
            })),
    }));

    return { settings, sections };
}

// ── Content validation ───────────────────────────────────────────────────

const MAX_STRING = 500;
const MAX_LIST_ITEMS = 10;
const MAX_FORM_FIELDS = 20;
const MAX_CONTENT_BYTES = 16_000;

function assertString(value: unknown, field: string, max = MAX_STRING): string {
    if (typeof value !== 'string' || value.length === 0 || value.length > max) {
        throw new Error(`${field} harus berupa teks (maks ${max} karakter)`);
    }
    return value;
}

function validateUrl(value: unknown, field: string): string {
    const s = assertString(value, field);
    // Allow internal paths (/virtual-assistant, /auth/...) and http(s) URLs.
    if (!s.startsWith('/') && !/^https?:\/\//i.test(s)) {
        throw new Error(`${field} harus URL (http/https) atau path internal (/...)`);
    }
    return s;
}

function validateQRLinks(content: Record<string, unknown>): QATileContent {
    const arr = content.qrLinks;
    if (!Array.isArray(arr) || arr.length === 0 || arr.length > MAX_LIST_ITEMS) {
        throw new Error(`qrLinks wajib ada (1–${MAX_LIST_ITEMS} item)`);
    }
    const qrLinks = arr.map((item, i) => {
        if (typeof item !== 'object' || item === null) throw new Error(`qrLinks[${i}] tidak valid`);
        const o = item as Record<string, unknown>;
        return { label: assertString(o.label, `qrLinks[${i}].label`), url: validateUrl(o.url, `qrLinks[${i}].url`) };
    });
    return { qrLinks };
}

function validateLinks(content: Record<string, unknown>): QATileContent {
    const arr = content.links;
    if (!Array.isArray(arr) || arr.length === 0 || arr.length > MAX_LIST_ITEMS) {
        throw new Error(`links wajib ada (1–${MAX_LIST_ITEMS} item)`);
    }
    const links = arr.map((item, i) => {
        if (typeof item !== 'object' || item === null) throw new Error(`links[${i}] tidak valid`);
        const o = item as Record<string, unknown>;
        return {
            label: assertString(o.label, `links[${i}].label`),
            sublabel: o.sublabel === undefined || o.sublabel === null || o.sublabel === ''
                ? undefined
                : assertString(o.sublabel, `links[${i}].sublabel`),
            url: validateUrl(o.url, `links[${i}].url`),
        };
    });
    return { links };
}

function validateRedirect(content: Record<string, unknown>): QATileContent {
    const label = assertString(content.label, 'label');
    const url = validateUrl(content.url, 'url');
    return { label, url };
}

function validateForm(content: Record<string, unknown>): QATileContent {
    const fieldsRaw = content.fields;
    if (!Array.isArray(fieldsRaw) || fieldsRaw.length === 0 || fieldsRaw.length > MAX_FORM_FIELDS) {
        throw new Error(`fields wajib ada (1–${MAX_FORM_FIELDS} field)`);
    }
    const seen = new Set<string>();
    const fields: QAFormField[] = fieldsRaw.map((f, i) => {
        if (typeof f !== 'object' || f === null) throw new Error(`fields[${i}] tidak valid`);
        const o = f as Record<string, unknown>;
        const key = assertString(o.key, `fields[${i}].key`, 60);
        if (!/^[a-zA-Z0-9_-]+$/.test(key)) throw new Error(`fields[${i}].key hanya huruf/angka/_/-`);
        if (seen.has(key)) throw new Error(`fields[${i}].key duplikat: ${key}`);
        seen.add(key);
        const type = String(o.type || 'text');
        if (!['text', 'textarea', 'select', 'number', 'date'].includes(type)) {
            throw new Error(`fields[${i}].type tidak valid: ${type}`);
        }
        const field: QAFormField = {
            key,
            label: assertString(o.label, `fields[${i}].label`),
            type: type as QAFormField['type'],
            required: o.required === true,
        };
        if (type === 'select') {
            const options = Array.isArray(o.options) ? o.options.map((opt) => String(opt)) : [];
            if (options.length === 0) throw new Error(`fields[${i}].options wajib diisi untuk type select`);
            field.options = options.slice(0, MAX_LIST_ITEMS);
        }
        return field;
    });
    const formTitle = content.formTitle && content.formTitle !== ''
        ? assertString(content.formTitle, 'formTitle', 120)
        : undefined;
    return { formTitle, fields };
}

export function validateTileContent(displayMode: QADisplayMode, rawContent: unknown): QATileContent {
    if (typeof rawContent !== 'object' || rawContent === null || Array.isArray(rawContent)) {
        throw new Error('content harus berupa objek JSON');
    }
    const content = rawContent as Record<string, unknown>;

    let result: QATileContent;
    switch (displayMode) {
        case 'qr': result = validateQRLinks(content); break;
        case 'links': result = validateLinks(content); break;
        case 'redirect': result = validateRedirect(content); break;
        case 'form': result = validateForm(content); break;
        default: throw new Error(`display_mode tidak valid: ${displayMode}`);
    }

    const size = JSON.stringify(result).length;
    if (size > MAX_CONTENT_BYTES) {
        throw new Error(`content terlalu besar (maks ${MAX_CONTENT_BYTES} karakter)`);
    }
    return result;
}

export const QA_SPANS: QASpan[] = ['1x1', '2x1', '2x2', '4x1'];
export const QA_DISPLAY_MODES: QADisplayMode[] = ['qr', 'links', 'redirect', 'form'];
export const QA_GATE_BYS = ['ai_enabled'] as const;
export const QA_WIZARD_CATEGORIES = ['Irregularity', 'JOUMPA'] as const;
