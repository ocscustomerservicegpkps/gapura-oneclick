import type { DivisionDocument } from '@/types';

export interface MaterialLink {
    title: string;
    url: string;
}

interface LegacyLinkFields {
    external_url?: string | null;
    materi_url?: string | null;
    materi_title?: string | null;
    attendance_url?: string | null;
    recording_url?: string | null;
}

function legacyLinksToMaterialLinks(doc: LegacyLinkFields): MaterialLink[] {
    const legacy: MaterialLink[] = [
        { title: 'Meeting Minutes', url: doc.external_url || '' },
        { title: doc.materi_title || 'Materials', url: doc.materi_url || '' },
        { title: 'Attendance List', url: doc.attendance_url || '' },
        { title: 'Recording', url: doc.recording_url || '' },
    ];
    return legacy.filter((link) => link.url.trim());
}

// ponytail: material_links is the source of truth going forward; the 4 fixed
// columns only feed entries created before that column existed.
export function resolveMaterialLinks(doc: DivisionDocument | LegacyLinkFields & { material_links?: MaterialLink[] | null }): MaterialLink[] {
    if (Array.isArray(doc.material_links)) return doc.material_links;
    return legacyLinksToMaterialLinks(doc);
}
