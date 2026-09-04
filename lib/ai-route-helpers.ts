/**
 * Shared helpers for /api/ai/* routes proxying the Gapura ML Service.
 * Keeps session-auth and error responses consistent across routes.
 */
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth-utils';
import type { SessionPayload, UserRole } from '@/types';

export async function requireAISession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;
  return token ? await verifySession(token) : null;
}

/**
 * Which roles may reach the company-wide AI endpoints.
 *
 * Typed as a total map over UserRole rather than a Set so adding a role to the
 * union fails the build until it is classified here. This was previously a
 * deny-list of three names, only one of which ({@link UserRole} `STAFF_CABANG`)
 * still exists — so it failed *open*: an unrecognised role string, or any role
 * introduced later, was granted access to unscoped company-wide data by
 * default.
 */
const ELEVATED_AI_ROLES: Record<UserRole, boolean> = {
  SUPER_ADMIN: true,
  ANALYST: true,
  MANAGER_CABANG: true,
  DIVISI_ESKALASI: true,
  DIVISI_OCS: true,
  DIVISI_OS: true,
  DIVISI_OP: true,
  DIVISI_OT: true,
  DIVISI_UQ: true,
  DIVISI_HC: true,
  DIVISI_HT: true,
  // Branch-tier staff see only their own station's reports elsewhere; these
  // endpoints have no per-caller scoping to apply.
  STAFF_CABANG: false,
};

/**
 * Like requireAISession, but limited to the roles above. Use this for AI
 * endpoints that return company-wide aggregated data (risk rankings, forecasts,
 * root-cause stats) with no per-caller station/division scoping.
 */
export async function requireElevatedAISession(): Promise<SessionPayload | null> {
  const session = await requireAISession();
  if (!session) return null;
  const role = String(session.role || '').trim().toUpperCase();
  return ELEVATED_AI_ROLES[role as UserRole] === true ? session : null;
}

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export function aiUnavailableResponse(error: unknown): NextResponse {
  // The upstream message stays server-side. It is whatever the ML service or
  // the fetch layer produced — internal hostnames, ports, connection strings —
  // and this response goes to any authenticated caller.
  console.error('[AI Route] ML service unavailable:', error);
  return NextResponse.json(
    {
      error: 'Layanan AI sedang tidak tersedia',
      details: 'Silakan coba lagi beberapa saat lagi.',
    },
    { status: 503 },
  );
}

/**
 * Confidence presentation levels shared by every classification response.
 * Thresholds mirror the ML service (abstain < 0.35, high ≥ 0.60).
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'unknown';

export interface PresentedClassification {
  /** Predicted label, or null when the model abstained. */
  label: string | null;
  /** 0–1 calibrated confidence (null when unavailable). */
  confidence: number | null;
  level: ConfidenceLevel;
  /** Plain-Indonesian confidence phrase for direct display. */
  levelLabel: string;
  /** True when the model abstained (label UNCERTAIN / below 0.35). */
  uncertain: boolean;
  /** True when the text looks unlike anything in the training data. */
  outOfScope: boolean;
  /** Ranked alternatives — always present so the UI can offer choices. */
  candidates: { label: string; confidence: number }[];
  /** Raw service status for debugging ("ok" | "medium_confidence" | ...). */
  status: string;
}

const LEVEL_LABELS: Record<ConfidenceLevel, string> = {
  high: 'Keyakinan tinggi',
  medium: 'Cukup yakin — mohon dicek',
  low: 'Belum yakin — pilih manual',
  unknown: 'Tidak tersedia',
};

export function presentClassification(raw: {
  status?: string;
  label?: string | null;
  confidence?: number | null;
  top_candidates?: { label: string; confidence: number }[];
  reason?: string;
} | null | undefined): PresentedClassification {
  const status = raw?.status ?? 'unavailable';
  const uncertain = !raw?.label || raw.label === 'UNCERTAIN' || status === 'low_confidence';
  const usable = status === 'ok' || status === 'medium_confidence';

  let level: ConfidenceLevel = 'unknown';
  if (usable && !uncertain) level = status === 'ok' ? 'high' : 'medium';
  else if (uncertain && (raw?.top_candidates?.length ?? 0) > 0) level = 'low';

  return {
    label: uncertain ? null : raw?.label ?? null,
    confidence: typeof raw?.confidence === 'number' ? raw.confidence : null,
    level,
    levelLabel: LEVEL_LABELS[level],
    uncertain,
    outOfScope: raw?.reason === 'input_dissimilar_to_training_data',
    candidates: raw?.top_candidates ?? [],
    status,
  };
}
