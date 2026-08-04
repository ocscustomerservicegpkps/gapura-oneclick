import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
    canManageDivisionDocuments,
    canViewAudienceScopedItem,
    getWorkspaceUser,
    isBranchRole,
    normalizeRole,
} from '@/lib/server/workspace-auth';
import { deleteDriveFile, downloadDriveFile } from '@/lib/google-drive';
import type { DivisionDocumentCategory, DivisionDocumentVisibilityScope } from '@/types';
import type { MaterialLink } from '@/lib/division-documents-material-links';

const VALID_CATEGORIES = [
    'SAM_HANDBOOK',
    'EDARAN_DIREKSI',
    'MATERI_SOSIALISASI',
    'NOTULENSI_RAPAT',
    'TRAINING_MATERIAL',
    'DOKUMEN_LAIN',
    'NOTICE',
    'MANUAL',
] as const;
const VALID_VISIBILITY = ['all', 'stations', 'roles', 'targeted'] as const;

interface StoredDivisionDocument {
    id: string;
    division: 'HC' | 'HT' | 'ANALYST';
    category: DivisionDocumentCategory;
    title: string;
    description?: string | null;
    meeting_title?: string | null;
    meeting_date?: string | null;
    activity_pic?: string | null;
    activity_location?: string | null;
    station_id?: string | null;
    airline?: string | null;
    participants?: string | null;
    materi_url?: string | null;
    materi_title?: string | null;
    attendance_url?: string | null;
    recording_url?: string | null;
    material_links?: MaterialLink[] | null;
    audience_label?: string | null;
    meeting_event_id?: string | null;
    source_type: 'upload' | 'link';
    file_url?: string | null;
    file_name?: string | null;
    file_size?: number | null;
    mime_type?: string | null;
    external_url?: string | null;
    drive_file_id?: string | null;
    drive_folder_id?: string | null;
    drive_web_url?: string | null;
    drive_content_url?: string | null;
    storage_path?: string | null;
    uploaded_at?: string | null;
    visibility_scope: DivisionDocumentVisibilityScope;
    audience_station_ids?: string[] | null;
    audience_roles?: string[] | null;
    is_active: boolean;
}

async function getDocument(id: string) {
    const { data, error } = await supabaseAdmin
        .from('division_documents')
        .select('*')
        .eq('id', id)
        .single();

    if (error) throw error;
    return data as StoredDivisionDocument;
}

// Shared permission check for reading a division document: also imported by
// the sibling list endpoint (app/api/division-documents/route.ts) so both
// routes agree on who can see a document. A prior bug had the list endpoint
// use a more permissive check (granting DIVISI_ESKALASI a blanket view and
// letting any DIVISI_*/PARTNER_* role fall through to the audience check),
// while this detail/download endpoint only lets branch roles fall through —
// so a document visible in the list could 403 when opened. Keep this as the
// single source of truth for both routes rather than re-diverging.
// The document parameter is intentionally a minimal structural shape (not
// StoredDivisionDocument) so the mapped DivisionDocument objects used by the
// list route satisfy it too.
export function canReadDivisionDocument(
    user: NonNullable<Awaited<ReturnType<typeof getWorkspaceUser>>>,
    document: {
        division: StoredDivisionDocument['division'];
        visibility_scope: DivisionDocumentVisibilityScope;
        audience_station_ids?: string[] | null;
        audience_roles?: string[] | null;
    }
) {
    if (canManageDivisionDocuments(user.role, document.division)) return true;
    if (!isBranchRole(user.role)) return false;

    return canViewAudienceScopedItem(
        user,
        document.visibility_scope,
        Array.isArray(document.audience_station_ids) ? document.audience_station_ids : [],
        Array.isArray(document.audience_roles)
            ? document.audience_roles.map((role) => normalizeRole(role)).filter(Boolean)
            : []
    );
}

function slugifyFilenamePart(value: string) {
    return value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-+/g, '-');
}

function formatDateForFilename(value?: string | null) {
    if (!value) return '';

    const trimmed = String(value).trim();
    if (!trimmed) return '';

    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        return trimmed.slice(0, 10);
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return '';

    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getFileExtension(document: StoredDivisionDocument) {
    const rawName = document.file_name || document.file_url || '';
    const cleanName = rawName.split('?')[0];
    const match = cleanName.match(/\.([a-zA-Z0-9]+)$/);
    return match ? `.${match[1].toLowerCase()}` : '';
}

function buildDownloadFilename(document: StoredDivisionDocument) {
    const eventName = slugifyFilenamePart(document.meeting_title || document.title || 'document');
    const eventDate = formatDateForFilename(document.meeting_date);
    const extension = getFileExtension(document) || '.bin';
    const baseName = [eventName || 'document', eventDate].filter(Boolean).join('_');
    return `${baseName}${extension}`;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const user = await getWorkspaceUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await context.params;
        const document = await getDocument(id);
        if (!document?.is_active) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }
        if (!canReadDivisionDocument(user, document)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        if (document.source_type !== 'upload' || (!document.storage_path && !document.drive_file_id && !document.file_url)) {
            return NextResponse.json({ error: 'Download not available for this document' }, { status: 400 });
        }

        let fileBuffer: Buffer;
        // Prefer Supabase Storage; fall back to legacy Drive id, then external url.
        const storageKey = document.storage_path || document.drive_file_id;
        if (storageKey) {
            fileBuffer = await downloadDriveFile(storageKey);
        } else {
            const legacyResponse = await fetch(String(document.file_url));
            if (!legacyResponse.ok) {
                return NextResponse.json({ error: 'Failed to fetch document file' }, { status: 502 });
            }
            fileBuffer = Buffer.from(await legacyResponse.arrayBuffer());
        }
        const filename = buildDownloadFilename(document);

        return new NextResponse(new Uint8Array(fileBuffer), {
            status: 200,
            headers: {
                'Content-Type': document.mime_type || 'application/octet-stream',
                'Content-Disposition': `inline; filename="${filename}"`,
                'Cache-Control': 'private, no-store, max-age=0',
                'X-Content-Type-Options': 'nosniff',
            },
        });
    } catch (error) {
        console.error('[Division Documents API] Failed to download document:', error);
        return NextResponse.json({ error: 'Failed to download document' }, { status: 500 });
    }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
    let replacementDriveFileId: string | null = null;
    try {
        const user = await getWorkspaceUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await context.params;
        const existing = await getDocument(id);
        if (!existing?.is_active) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }
        if (!canManageDivisionDocuments(user.role, existing.division)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        replacementDriveFileId = body.drive_file_id && body.drive_file_id !== existing.drive_file_id
            ? String(body.drive_file_id)
            : null;
        const category = String(body.category || existing.category).toUpperCase() as DivisionDocumentCategory;
        const visibilityScope = String(body.visibility_scope || existing.visibility_scope).toLowerCase() as DivisionDocumentVisibilityScope;
        const sourceType = String(body.source_type || existing.source_type).toLowerCase();
        const audienceStationIds = Array.isArray(body.audience_station_ids)
            ? body.audience_station_ids
            : existing.audience_station_ids || [];
        const audienceRoles = Array.isArray(body.audience_roles)
            ? body.audience_roles.map((role: string) => normalizeRole(role)).filter(Boolean)
            : existing.audience_roles || [];

        if (!VALID_CATEGORIES.some((item) => item === category)) {
            return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
        }
        if (!VALID_VISIBILITY.some((item) => item === visibilityScope)) {
            return NextResponse.json({ error: 'Invalid visibility scope' }, { status: 400 });
        }
        if (!['upload', 'link'].includes(sourceType)) {
            return NextResponse.json({ error: 'Invalid source_type' }, { status: 400 });
        }

        const title = String(body.title ?? existing.title ?? '').trim();
        if (!title) {
            return NextResponse.json({ error: 'Title is required' }, { status: 400 });
        }

        const fileUrl = sourceType === 'upload' ? (body.file_url ?? existing.file_url) : null;
        const materialLinks: MaterialLink[] = body.material_links !== undefined
            ? (Array.isArray(body.material_links)
                ? body.material_links
                    .map((link: { title?: unknown; url?: unknown }) => ({
                        title: String(link?.title || '').trim(),
                        url: String(link?.url || '').trim(),
                    }))
                    .filter((link: MaterialLink) => link.url)
                : [])
            : (existing.material_links || []);
        const externalUrl = sourceType === 'link' ? (body.external_url ?? existing.external_url ?? materialLinks[0]?.url ?? null) : null;
        const driveFileId = sourceType === 'upload'
            ? (body.drive_file_id ?? existing.drive_file_id ?? null)
            : null;
        const hasStorage = Boolean(driveFileId || existing.storage_path);
        if (sourceType === 'upload' && (!fileUrl || !hasStorage)) {
            return NextResponse.json({ error: 'Google Drive file metadata is required for uploaded documents' }, { status: 400 });
        }
        if (sourceType === 'link' && !externalUrl && materialLinks.length === 0) {
            return NextResponse.json({ error: 'external_url is required for linked documents' }, { status: 400 });
        }
        if (visibilityScope === 'stations' && audienceStationIds.length === 0) {
            return NextResponse.json({ error: 'Select at least one station for station-based visibility' }, { status: 400 });
        }
        if (visibilityScope === 'roles' && audienceRoles.length === 0) {
            return NextResponse.json({ error: 'Select at least one role for role-based visibility' }, { status: 400 });
        }
        if (visibilityScope === 'targeted' && audienceStationIds.length === 0 && audienceRoles.length === 0) {
            return NextResponse.json({ error: 'Targeted visibility requires at least one station or role' }, { status: 400 });
        }

        const updates = {
            category,
            title,
            description: body.description !== undefined ? (body.description ? String(body.description).trim() : null) : existing.description,
            meeting_title: body.meeting_title !== undefined ? (body.meeting_title ? String(body.meeting_title).trim() : null) : existing.meeting_title,
            meeting_date: body.meeting_date !== undefined ? (body.meeting_date ? String(body.meeting_date).trim() : null) : existing.meeting_date,
            activity_pic: body.activity_pic !== undefined ? (body.activity_pic ? String(body.activity_pic).trim() : null) : existing.activity_pic,
            activity_location: body.activity_location !== undefined ? (body.activity_location ? String(body.activity_location).trim() : null) : existing.activity_location,
            station_id: body.station_id !== undefined ? (body.station_id ? String(body.station_id) : null) : existing.station_id,
            airline: body.airline !== undefined ? (body.airline ? String(body.airline).trim() : null) : existing.airline,
            participants: body.participants !== undefined ? (body.participants ? String(body.participants).trim() : null) : existing.participants,
            materi_url: body.materi_url !== undefined ? (body.materi_url ? String(body.materi_url).trim() : null) : existing.materi_url,
            materi_title: body.materi_title !== undefined ? (body.materi_title ? String(body.materi_title).trim() : null) : existing.materi_title,
            attendance_url: body.attendance_url !== undefined ? (body.attendance_url ? String(body.attendance_url).trim() : null) : existing.attendance_url,
            recording_url: body.recording_url !== undefined ? (body.recording_url ? String(body.recording_url).trim() : null) : existing.recording_url,
            material_links: materialLinks,
            audience_label: body.audience_label !== undefined ? (body.audience_label ? String(body.audience_label).trim() : null) : existing.audience_label,
            meeting_event_id: body.meeting_event_id !== undefined ? (body.meeting_event_id || null) : existing.meeting_event_id,
            source_type: sourceType,
            file_url: fileUrl,
            file_name: sourceType === 'upload' ? (body.file_name ?? existing.file_name ?? null) : null,
            file_size: sourceType === 'upload' ? (body.file_size ?? existing.file_size ?? null) : null,
            mime_type: sourceType === 'upload' ? (body.mime_type ?? existing.mime_type ?? null) : null,
            external_url: externalUrl,
            drive_file_id: driveFileId,
            drive_folder_id: sourceType === 'upload' ? (body.drive_folder_id ?? existing.drive_folder_id ?? null) : null,
            drive_web_url: sourceType === 'upload' ? (body.drive_web_url ?? existing.drive_web_url ?? null) : null,
            drive_content_url: sourceType === 'upload' ? (body.drive_content_url ?? existing.drive_content_url ?? null) : null,
            uploaded_at: sourceType === 'upload'
                ? (replacementDriveFileId ? new Date().toISOString() : existing.uploaded_at ?? new Date().toISOString())
                : null,
            visibility_scope: visibilityScope,
            audience_station_ids: ['stations', 'targeted'].includes(visibilityScope) ? audienceStationIds : [],
            audience_roles: ['roles', 'targeted'].includes(visibilityScope) ? audienceRoles : [],
            updated_by: user.id,
            updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabaseAdmin
            .from('division_documents')
            .update(updates)
            .eq('id', id)
            .select(`
                *,
                created_by_user:created_by (
                    full_name
                )
            `)
            .single();

        if (error) throw error;
        if (
            existing.drive_file_id &&
            (replacementDriveFileId || sourceType === 'link')
        ) {
            await deleteDriveFile(existing.drive_file_id).catch((cleanupError) => {
                console.error('[Division Documents API] Failed to delete replaced Drive file:', cleanupError);
            });
        }

        let station: { code?: string | null; name?: string | null } | null = null;
        if (data.station_id) {
            const { data: stationRow } = await supabaseAdmin
                .from('stations')
                .select('code, name')
                .eq('id', data.station_id)
                .maybeSingle();
            station = stationRow;
        }
        return NextResponse.json({
            ...data,
            station_code: station?.code || data.station_id || null,
            station_name: station?.name || null,
        });
    } catch (error) {
        if (replacementDriveFileId) {
            await deleteDriveFile(replacementDriveFileId).catch((cleanupError) => {
                console.error('[Division Documents API] Failed to roll back replacement Drive file:', cleanupError);
            });
        }
        console.error('[Division Documents API] Failed to update document:', error);
        return NextResponse.json({ error: 'Failed to update document' }, { status: 500 });
    }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const user = await getWorkspaceUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await context.params;
        const existing = await getDocument(id);
        if (!existing?.is_active) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }
        if (!canManageDivisionDocuments(user.role, existing.division)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { error } = await supabaseAdmin
            .from('division_documents')
            .update({
                is_active: false,
                updated_by: user.id,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id);

        if (error) throw error;
        if (existing.drive_file_id) {
            await deleteDriveFile(existing.drive_file_id).catch((cleanupError) => {
                console.error('[Division Documents API] Failed to delete Drive file:', cleanupError);
            });
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Division Documents API] Failed to delete document:', error);
        return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
    }
}
