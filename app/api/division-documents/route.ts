import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
    canManageDivisionDocuments,
    getWorkspaceUser,
    isBranchRole,
    normalizeRole,
} from '@/lib/server/workspace-auth';
import { canReadDivisionDocument } from './[id]/route';
import { deleteDriveFile } from '@/lib/google-drive';
import type {
    DivisionDocument,
    DivisionDocumentCategory,
    DivisionDocumentDivision,
    DivisionDocumentVisibilityScope,
} from '@/types';
import type { MaterialLink } from '@/lib/division-documents-material-links';

// Bound how many documents a single list request can return. Audience
// scoping for the harder "targeted" case is still finished in JS (see GET
// below), but the bulk of the predicate is now pushed into the query, so
// this limit is a backstop rather than the primary cost control.
const LIST_QUERY_LIMIT = 500;

const VALID_DIVISIONS = ['HC', 'HT', 'ANALYST'] as const;
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

interface DivisionDocumentRow {
    id: string;
    division: DivisionDocumentDivision;
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
    uploaded_at?: string | null;
    visibility_scope: DivisionDocumentVisibilityScope;
    audience_station_ids?: string[] | null;
    audience_roles?: string[] | null;
    created_by: string;
    updated_by?: string | null;
    created_at: string;
    updated_at: string;
    created_by_user?: { full_name?: string | null } | Array<{ full_name?: string | null }> | null;
}

function isValidDivision(value: string): value is DivisionDocumentDivision {
    return VALID_DIVISIONS.some((item) => item === value);
}

async function fetchStationMap(stationIds: string[]) {
    const map = new Map<string, { code: string; name: string }>();
    const ids = Array.from(new Set(stationIds.filter(Boolean)));
    if (ids.length === 0) return map;

    const { data, error } = await supabaseAdmin.from('stations').select('id, code, name').in('id', ids);
    if (error) throw error;
    for (const station of data || []) {
        map.set(station.id, { code: station.code, name: station.name });
    }
    return map;
}

// Delegates to the same permission check used by the detail/download route
// (app/api/division-documents/[id]/route.ts). These two endpoints must agree:
// a document that appears in this list has to be openable there, and vice
// versa. This used to be a separately-maintained, more permissive check here
// (unconditional DIVISI_ESKALASI access, plus any DIVISI_*/PARTNER_* role
// falling through to the audience check) which caused documents visible in
// the list to 403 on open. Import the shared function instead of
// re-diverging.
function canViewDocument(user: NonNullable<Awaited<ReturnType<typeof getWorkspaceUser>>>, document: DivisionDocument) {
    return canReadDivisionDocument(user, document);
}

function mapDocument(row: DivisionDocumentRow, stationMap: Map<string, { code: string; name: string }>): DivisionDocument {
    const creator = Array.isArray(row.created_by_user) ? row.created_by_user[0] : row.created_by_user;
    const station = row.station_id ? stationMap.get(row.station_id) : null;
    return {
        id: row.id,
        division: row.division,
        category: row.category,
        title: row.title,
        description: row.description,
        meeting_title: row.meeting_title,
        meeting_date: row.meeting_date,
        activity_pic: row.activity_pic,
        activity_location: row.activity_location,
        station_id: row.station_id,
        station_code: station?.code || row.station_id || null,
        station_name: station?.name || null,
        airline: row.airline,
        participants: row.participants,
        materi_url: row.materi_url,
        materi_title: row.materi_title,
        attendance_url: row.attendance_url,
        recording_url: row.recording_url,
        material_links: row.material_links,
        audience_label: row.audience_label,
        source_type: row.source_type,
        file_url: row.file_url,
        file_name: row.file_name,
        file_size: row.file_size,
        mime_type: row.mime_type,
        external_url: row.external_url,
        drive_file_id: row.drive_file_id,
        drive_folder_id: row.drive_folder_id,
        drive_web_url: row.drive_web_url,
        drive_content_url: row.drive_content_url,
        uploaded_at: row.uploaded_at,
        visibility_scope: row.visibility_scope,
        audience_station_ids: Array.isArray(row.audience_station_ids) ? row.audience_station_ids : [],
        audience_roles: Array.isArray(row.audience_roles) ? row.audience_roles : [],
        created_by: row.created_by,
        updated_by: row.updated_by,
        created_at: row.created_at,
        updated_at: row.updated_at,
        created_by_name: creator?.full_name || null,
    };
}

export async function GET(request: Request) {
    try {
        const user = await getWorkspaceUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const url = new URL(request.url);
        const division = String(url.searchParams.get('division') || 'HC').toUpperCase();
        const category = url.searchParams.get('category');

        if (!isValidDivision(division)) {
            return NextResponse.json({ error: 'Invalid division' }, { status: 400 });
        }

        const canManage = canManageDivisionDocuments(user.role, division);
        // canReadDivisionDocument only ever grants access to (a) managers of
        // this division, or (b) branch roles subject to audience scoping —
        // every other role sees nothing for this division. Short-circuit
        // before hitting the DB in that case instead of fetching rows only
        // to filter them all out in JS.
        if (!canManage && !isBranchRole(user.role)) {
            return NextResponse.json([]);
        }

        let query = supabaseAdmin
            .from('division_documents')
            .select(`
                *,
                created_by_user:created_by (
                    full_name
                )
            `)
            .eq('division', division)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(LIST_QUERY_LIMIT);

        if (category) {
            query = query.eq('category', category);
        }

        if (!canManage) {
            // Branch role: push the bulk of the audience predicate into SQL so
            // Postgres can use idx_division_documents_audience_stations /
            // idx_division_documents_audience_roles instead of every row being
            // pulled back and filtered in JS. 'targeted' visibility mixes
            // station AND role conditions (each optional) which isn't a simple
            // predicate, so those rows are fetched and narrowed by
            // canReadDivisionDocument below along with everything else, as a
            // correctness safety net.
            const stationId = /^[a-zA-Z0-9_-]+$/.test(String(user.station_id || ''))
                ? String(user.station_id)
                : null;
            const roleForFilter = /^[A-Z0-9_]+$/.test(normalizeRole(user.role))
                ? normalizeRole(user.role)
                : null;

            const orConditions = ['visibility_scope.eq.all', 'visibility_scope.eq.targeted'];
            if (stationId) {
                orConditions.push(`and(visibility_scope.eq.stations,audience_station_ids.cs.{${stationId}})`);
            }
            if (roleForFilter) {
                orConditions.push(`and(visibility_scope.eq.roles,audience_roles.cs.{${roleForFilter}})`);
            }
            query = query.or(orConditions.join(','));
        }

        const { data, error } = await query;
        if (error) throw error;

        const stationMap = await fetchStationMap((data || []).map((row) => row.station_id));
        const documents = (data || [])
            .map((row) => mapDocument(row, stationMap))
            .filter((document) => canViewDocument(user, document));
        return NextResponse.json(documents);
    } catch (error) {
        console.error('[Division Documents API] Failed to fetch documents:', error);
        return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    let uploadedDriveFileId: string | null = null;
    try {
        const user = await getWorkspaceUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        uploadedDriveFileId = body.drive_file_id ? String(body.drive_file_id) : null;
        const division = String(body.division || '').toUpperCase();
        if (!isValidDivision(division)) {
            return NextResponse.json({ error: 'Invalid division' }, { status: 400 });
        }
        if (!canManageDivisionDocuments(user.role, division)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const category = String(body.category || '').toUpperCase() as DivisionDocumentCategory;
        const visibilityScope = String(body.visibility_scope || 'all').toLowerCase() as DivisionDocumentVisibilityScope;
        const sourceType = String(body.source_type || '').toLowerCase();
        const audienceStationIds = Array.isArray(body.audience_station_ids) ? body.audience_station_ids : [];
        const audienceRoles = Array.isArray(body.audience_roles)
            ? body.audience_roles.map((role: string) => normalizeRole(role)).filter(Boolean)
            : [];

        if (!VALID_CATEGORIES.some((item) => item === category)) {
            return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
        }
        if (!VALID_VISIBILITY.some((item) => item === visibilityScope)) {
            return NextResponse.json({ error: 'Invalid visibility scope' }, { status: 400 });
        }
        if (!['upload', 'link'].includes(sourceType)) {
            return NextResponse.json({ error: 'Invalid source_type' }, { status: 400 });
        }

        const title = String(body.title || '').trim();
        if (!title) {
            return NextResponse.json({ error: 'Title is required' }, { status: 400 });
        }

        if (sourceType === 'upload' && (!body.file_url || !uploadedDriveFileId)) {
            return NextResponse.json({ error: 'Google Drive file metadata is required for uploaded documents' }, { status: 400 });
        }
        const materialLinks: MaterialLink[] = Array.isArray(body.material_links)
            ? body.material_links
                .map((link: { title?: unknown; url?: unknown }) => ({
                    title: String(link?.title || '').trim(),
                    url: String(link?.url || '').trim(),
                }))
                .filter((link: MaterialLink) => link.url)
            : [];
        if (sourceType === 'link' && !body.external_url && materialLinks.length === 0) {
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

        const insertPayload = {
            division,
            category,
            title,
            description: body.description ? String(body.description).trim() : null,
            meeting_title: body.meeting_title ? String(body.meeting_title).trim() : null,
            meeting_date: body.meeting_date ? String(body.meeting_date).trim() : null,
            activity_pic: body.activity_pic ? String(body.activity_pic).trim() : null,
            activity_location: body.activity_location ? String(body.activity_location).trim() : null,
            station_id: body.station_id ? String(body.station_id) : null,
            airline: body.airline ? String(body.airline).trim() : null,
            participants: body.participants ? String(body.participants).trim() : null,
            materi_url: body.materi_url ? String(body.materi_url).trim() : null,
            materi_title: body.materi_title ? String(body.materi_title).trim() : null,
            attendance_url: body.attendance_url ? String(body.attendance_url).trim() : null,
            recording_url: body.recording_url ? String(body.recording_url).trim() : null,
            material_links: materialLinks,
            audience_label: body.audience_label ? String(body.audience_label).trim() : null,
            source_type: sourceType,
            file_url: body.file_url || null,
            file_name: body.file_name || null,
            file_size: body.file_size || null,
            mime_type: body.mime_type || null,
            external_url: body.external_url || materialLinks[0]?.url || null,
            drive_file_id: uploadedDriveFileId,
            drive_folder_id: body.drive_folder_id || null,
            drive_web_url: body.drive_web_url || null,
            drive_content_url: body.drive_content_url || null,
            uploaded_at: sourceType === 'upload' ? new Date().toISOString() : null,
            visibility_scope: visibilityScope,
            audience_station_ids: audienceStationIds,
            audience_roles: audienceRoles,
            created_by: user.id,
            updated_by: user.id,
        };

        const { data, error } = await supabaseAdmin
            .from('division_documents')
            .insert(insertPayload)
            .select(`
                *,
                created_by_user:created_by (
                    full_name
                )
            `)
            .single();

        if (error) throw error;

        // The document is already committed at this point. A station lookup
        // failure here is cosmetic (missing station code/name enrichment), not
        // a failed creation — don't roll back the Drive upload or report a
        // successful insert as an error over it.
        let stationMap: Map<string, { code: string; name: string }>;
        try {
            stationMap = await fetchStationMap([data.station_id]);
        } catch (stationError) {
            console.error('[Division Documents API] Station lookup failed after successful insert:', stationError);
            stationMap = new Map();
        }
        return NextResponse.json(mapDocument(data, stationMap), { status: 201 });
    } catch (error) {
        if (uploadedDriveFileId) {
            await deleteDriveFile(uploadedDriveFileId).catch((cleanupError) => {
                console.error('[Division Documents API] Failed to roll back Drive upload:', cleanupError);
            });
        }
        console.error('[Division Documents API] Failed to create document:', error);
        return NextResponse.json({ error: 'Failed to create document' }, { status: 500 });
    }
}
