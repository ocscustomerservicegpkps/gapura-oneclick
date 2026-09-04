import 'server-only';
import {
    canManageDivisionDocuments,
    canViewAudienceScopedItem,
    getWorkspaceUser,
    isBranchRole,
    normalizeRole,
} from '@/lib/server/workspace-auth';
import type { DivisionDocumentVisibilityScope } from '@/types';

/**
 * Shared permission check for reading a division document, used by both the
 * list endpoint and the detail/download endpoint so the two agree on who can
 * see a document. A prior bug had the list endpoint use a more permissive
 * check (granting DIVISI_ESKALASI a blanket view and letting any divisional or
 * partner role fall through to the audience check) while the detail endpoint
 * only let branch roles fall through — so a document visible in the list 403'd
 * when opened. This is the single source of truth for both.
 *
 * It lives here rather than in a route module because App Router route files
 * may only export HTTP handlers and route config; the list route used to import
 * it from `./[id]/route`, which is not a supported export and couples two
 * route bundles together.
 *
 * `document` is deliberately a minimal structural shape rather than the stored
 * row type, so the mapped objects the list route builds satisfy it too.
 */
export function canReadDivisionDocument(
    user: NonNullable<Awaited<ReturnType<typeof getWorkspaceUser>>>,
    document: {
        division: 'HC' | 'HT' | 'ANALYST';
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
