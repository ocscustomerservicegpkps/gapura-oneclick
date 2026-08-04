/**
 * Shared helpers for /api/ai/* routes proxying the Gapura ML Service.
 * Keeps session-auth and error responses consistent across routes.
 */
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth-utils';
import type { SessionPayload } from '@/types';

export async function requireAISession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;
  return token ? await verifySession(token) : null;
}

const BASIC_STAFF_ROLES = new Set(['STAFF_CABANG', 'CABANG', 'EMPLOYEE']);

/**
 * Like requireAISession, but also blocks basic branch-tier staff. Use this
 * for AI endpoints that return company-wide aggregated data (risk rankings,
 * forecasts, root-cause stats) with no per-caller station/division scoping —
 * elevated roles (SUPER_ADMIN, ANALYST, MANAGER_CABANG, divisional/partner
 * roles) still get full access, matching the RBAC pattern used for report data.
 */
export async function requireElevatedAISession(): Promise<SessionPayload | null> {
  const session = await requireAISession();
  if (!session) return null;
  const role = String(session.role || '').trim().toUpperCase();
  if (BASIC_STAFF_ROLES.has(role)) return null;
  return session;
}

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export function aiUnavailableResponse(error: unknown): NextResponse {
  console.error('[AI Route] ML service unavailable:', error);
  return NextResponse.json(
    {
      error: 'Layanan AI sedang tidak tersedia',
      details: error instanceof Error ? error.message : 'Unknown error',
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
