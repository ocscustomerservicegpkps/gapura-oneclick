/**
 * Core pipeline for the "Ringkasan" section summary.
 *
 * Pure & framework-free so it can be exercised directly in tests/scripts:
 *  1. sanitise incoming named datasets,
 *  2. compute every displayed number deterministically (facts, headlines,
 *     shares) — the LLM never does arithmetic,
 *  3. ask the LLM for prose only (injected via `callLLM`), then
 *  4. ground-filter that prose: sentences citing numbers that are not in the
 *     facts are dropped, generic no-op recommendations are dropped, and
 *     deterministic fallbacks fill any gap.
 */
import { collectAllowedNumbers, filterGroundedBullets, stripUngroundedSentences } from '@/lib/ai/grounding';

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

export type DatasetKind = 'timeseries' | 'ranking' | 'comparison';

export type CleanRow = {
  label: string;
  value: number;
  /** Signed percent change vs a baseline (comparison rows). */
  delta?: number;
  note?: string;
  breakdown?: Record<string, number>;
};

export type CleanDataset = {
  id: string;
  name: string;
  unit: string;
  kind: DatasetKind;
  description?: string;
  rows: CleanRow[];
};

export type PresentedRow = {
  label: string;
  value: number;
  /** Share of the dataset total, 0-100. */
  sharePct: number;
  /** Signed percent change vs baseline (comparison rows). */
  delta?: number;
  note?: string;
};

export type PresentedDataset = {
  id: string;
  name: string;
  unit: string;
  kind: DatasetKind;
  total: number;
  /** Deterministic one-line reading — always numerically correct. */
  headline: string;
  rows: PresentedRow[];
  /** LLM narrative for this dataset (grounded; may be empty). */
  narrative: string;
};

export type SectionRecommendation = {
  title: string;
  detail: string;
  priority: 'high' | 'medium' | 'low';
};

export type SectionSummaryPayload = {
  executiveSummary: string;
  keyPoints: string[];
  datasets: PresentedDataset[];
  recommendations: SectionRecommendation[];
  predictiveSummary: string;
};

export type LLMCaller = (messages: { role: 'system' | 'user' | 'assistant'; content: string }[]) => Promise<string>;

// ---------------------------------------------------------------------------
// Input sanitising
// ---------------------------------------------------------------------------

const MAX_DATASETS = 6;
const MAX_ROWS_TS = 14;
const MAX_ROWS_RANKED = 10;

function normalizeText(value: unknown, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function asNumber(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function cleanRows(value: unknown): CleanRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const row = item as Record<string, unknown>;
      const breakdown =
        row.breakdown && typeof row.breakdown === 'object'
          ? Object.fromEntries(
              Object.entries(row.breakdown as Record<string, unknown>)
                .map(([k, v]) => [normalizeText(k, '-'), asNumber(v)])
                .filter(([, v]) => (v as number) > 0),
            )
          : undefined;
      return {
        label: normalizeText(row.label, 'Unknown'),
        value: asNumber(row.value),
        delta: typeof row.delta === 'number' && Number.isFinite(row.delta) ? Math.round(row.delta) : undefined,
        note: normalizeText(row.note) || undefined,
        breakdown,
      };
    })
    .filter((row) => row.label);
}

export function cleanDatasets(value: unknown): CleanDataset[] {
  if (!Array.isArray(value)) return [];
  const kinds: DatasetKind[] = ['timeseries', 'ranking', 'comparison'];
  return value
    .filter((item) => item && typeof item === 'object')
    .slice(0, MAX_DATASETS)
    .map((item, index) => {
      const ds = item as Record<string, unknown>;
      const kind = kinds.includes(ds.kind as DatasetKind) ? (ds.kind as DatasetKind) : 'ranking';
      return {
        id: normalizeText(ds.id, `dataset_${index}`),
        name: normalizeText(ds.name, 'Section data'),
        unit: normalizeText(ds.unit, 'cases'),
        kind,
        description: normalizeText(ds.description) || undefined,
        rows: cleanRows(ds.rows),
      };
    })
    .filter((ds) => ds.rows.length > 0);
}

/** Legacy flat chartData → single ranked dataset, so old callers keep working. */
export function legacyDataset(chartData: unknown): CleanDataset[] {
  if (!Array.isArray(chartData) || chartData.length === 0) return [];
  const rows = cleanRows(
    chartData.map((item) => {
      const row = (item ?? {}) as Record<string, unknown>;
      return {
        label: row.label ?? row.name ?? row.month ?? row.category ?? row.title,
        value: row.value ?? row.total ?? row.count,
        note: row.secondary ?? row.note,
      };
    }),
  ).filter((row) => row.value > 0);
  if (rows.length === 0) return [];
  return [{ id: 'section_data', name: 'This section’s data', unit: 'cases', kind: 'ranking', rows }];
}

// ---------------------------------------------------------------------------
// Deterministic facts & presentation
// ---------------------------------------------------------------------------

function formatEn(n: number) {
  return Math.round(n).toLocaleString('en-US');
}

function pct(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

type DatasetFacts = Record<string, unknown>;

export function buildFacts(ds: CleanDataset): DatasetFacts {
  const total = ds.rows.reduce((sum, row) => sum + row.value, 0);
  const sorted = [...ds.rows].sort((a, b) => b.value - a.value);
  const facts: DatasetFacts = {
    id: ds.id,
    name: ds.name,
    kind: ds.kind,
    unit: ds.unit,
    ...(ds.description ? { meaning: ds.description } : {}),
    total,
    row_count: ds.rows.length,
    top: sorted.slice(0, 3).map((row) => ({
      label: row.label,
      value: row.value,
      share_pct: pct(row.value, total),
      ...(row.note ? { note: row.note } : {}),
    })),
  };

  if (ds.kind === 'timeseries' && ds.rows.length >= 2) {
    const latest = ds.rows[ds.rows.length - 1];
    const previous = ds.rows[ds.rows.length - 2];
    const peak = sorted[0];
    facts.latest = { label: latest.label, value: latest.value };
    facts.previous = { label: previous.label, value: previous.value };
    facts.change_latest_vs_previous_pct =
      previous.value > 0 ? Math.round(((latest.value - previous.value) / previous.value) * 100) : null;
    facts.peak = { label: peak.label, value: peak.value };
    if (latest.breakdown && Object.keys(latest.breakdown).length > 0) {
      facts.latest_breakdown = Object.entries(latest.breakdown)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([label, value]) => ({ label, value }));
    }
  }

  if (ds.kind === 'comparison') {
    facts.rows = ds.rows.map((row) => ({
      label: row.label,
      value: row.value,
      ...(row.delta !== undefined ? { change_pct: row.delta } : {}),
      ...(row.note ? { note: row.note } : {}),
    }));
  }

  return facts;
}

export function buildHeadline(ds: CleanDataset, facts: DatasetFacts): string {
  const total = facts.total as number;
  const top = (facts.top as Array<{ label: string; value: number; share_pct: number }>)[0];

  if (ds.kind === 'timeseries') {
    const latest = facts.latest as { label: string; value: number } | undefined;
    const change = facts.change_latest_vs_previous_pct as number | null | undefined;
    if (latest && typeof change === 'number') {
      const direction = change > 0 ? `up ${change}%` : change < 0 ? `down ${Math.abs(change)}%` : 'flat';
      return `${latest.label}: ${formatEn(latest.value)} ${ds.unit}, ${direction} versus the previous month.`;
    }
    if (latest) return `Latest (${latest.label}): ${formatEn(latest.value)} ${ds.unit} out of a total of ${formatEn(total)}.`;
  }

  if (ds.kind === 'comparison' && top) {
    const row = ds.rows.find((r) => r.label === top.label);
    if (row?.delta !== undefined) {
      const direction = row.delta > 0 ? `up ${row.delta}%` : row.delta < 0 ? `down ${Math.abs(row.delta)}%` : 'stable';
      return `${top.label}: ${formatEn(top.value)} ${ds.unit}, ${direction} versus the previous year.`;
    }
  }

  if (top) {
    return `Highest: ${top.label} with ${formatEn(top.value)} ${ds.unit} (${top.share_pct}% of ${formatEn(total)}).`;
  }
  return `Total ${formatEn(total)} ${ds.unit}.`;
}

function presentRows(ds: CleanDataset, total: number): PresentedRow[] {
  const base =
    ds.kind === 'ranking'
      ? [...ds.rows].sort((a, b) => b.value - a.value).slice(0, MAX_ROWS_RANKED)
      : ds.rows.slice(-Math.max(MAX_ROWS_TS, MAX_ROWS_RANKED));
  return base.map((row) => ({
    label: row.label,
    value: row.value,
    sharePct: pct(row.value, total),
    ...(row.delta !== undefined ? { delta: row.delta } : {}),
    ...(row.note ? { note: row.note } : {}),
  }));
}

// ---------------------------------------------------------------------------
// Deterministic fallbacks (used when the LLM fails or gets filtered out)
// ---------------------------------------------------------------------------

function fallbackKeyPoints(datasets: CleanDataset[], allFacts: DatasetFacts[]): string[] {
  return allFacts
    .map((facts, i) => {
      const top = (facts.top as Array<{ label: string; value: number; share_pct: number }>)[0];
      if (!top) return null;
      return `${datasets[i].name}: ${top.label} is highest with ${formatEn(top.value)} ${datasets[i].unit}.`;
    })
    .filter((s): s is string => Boolean(s))
    .slice(0, 5);
}

function fallbackRecommendations(datasets: CleanDataset[], allFacts: DatasetFacts[]): SectionRecommendation[] {
  const recs: SectionRecommendation[] = [];
  for (let i = 0; i < datasets.length && recs.length < 3; i++) {
    const ds = datasets[i];
    const facts = allFacts[i];
    const top = (facts.top as Array<{ label: string; value: number; share_pct: number }>)[0];
    if (!top || top.value <= 0) continue;
    if (ds.kind === 'timeseries') {
      const change = facts.change_latest_vs_previous_pct as number | null | undefined;
      const latest = facts.latest as { label: string; value: number } | undefined;
      if (typeof change === 'number' && change > 10 && latest) {
        recs.push({
          title: `Prepare for ${latest.label}'s volume increase`,
          detail: `${latest.label} volume rose ${change}% to ${formatEn(latest.value)} ${ds.unit}. Line up team capacity and review the cause before next month.`,
          priority: change > 30 ? 'high' : 'medium',
        });
      }
      continue;
    }
    recs.push({
      title: `Follow up on ${top.label}`,
      detail: `${top.label} accounts for ${formatEn(top.value)} ${ds.unit} (${top.share_pct}% of ${ds.name.toLowerCase()}). Schedule a root-cause review with the relevant team and set a reduction target.`,
      priority: top.share_pct >= 30 ? 'high' : 'medium',
    });
  }
  return recs;
}

// ---------------------------------------------------------------------------
// LLM prose layer
// ---------------------------------------------------------------------------

function extractJson(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;
  const match = trimmed.match(/\{[\s\S]*\}/);
  return match ? match[0] : trimmed;
}

/** Recommendations that say nothing actionable get dropped. */
const GENERIC_REC_RE =
  /needs?\s+(attention|monitoring|further\s+analysis|review)|increase\s+(monitoring|oversight|vigilance)\s*\.?$|keep\s+(monitoring|an\s+eye\s+on)/i;

function cleanRecommendations(value: unknown, allowed: Set<number>): SectionRecommendation[] {
  if (!Array.isArray(value)) return [];
  const priorities = new Set(['high', 'medium', 'low']);
  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const rec = item as Record<string, unknown>;
      const priority = normalizeText(rec.priority).toLowerCase();
      return {
        title: normalizeText(rec.title ?? rec.action),
        detail: normalizeText(rec.detail ?? rec.reason ?? rec.description),
        priority: (priorities.has(priority) ? priority : 'medium') as SectionRecommendation['priority'],
      };
    })
    .filter((rec) => rec.title && rec.detail)
    .filter((rec) => !GENERIC_REC_RE.test(rec.detail) || /\d/.test(rec.detail))
    .filter((rec) => filterGroundedBullets([`${rec.title} ${rec.detail}`], allowed).length > 0)
    .slice(0, 4);
}

function buildMessages(section: string, title: string, allFacts: DatasetFacts[]) {
  return [
    {
      role: 'system' as const,
      content: [
        'You are a ground-handling operations analyst at Gapura Angkasa writing for non-technical management. "Station" = airport code (CGK, DPS, ...). Categories: Irregularity, Complaint, Compliment, Occurrence.',
        'Reply with valid JSON only, no markdown.',
        'Rules:',
        '1. Every number MUST be copied exactly from "facts". Never compute/sum/estimate new numbers.',
        '2. Each dataset stands alone — never compare across datasets.',
        '3. A month label is a month name, not a category/entity.',
        '4. Plain, simple business English.',
        '5. Recommendations must be concrete: name the entity (station/airline/category/month) + a number + a real operational action (shift briefing, SOP audit, coordination with airline X, GSE inspection).',
        '6. No generic filler ("needs attention", "increase monitoring").',
        'Schema: {"executiveSummary": string (2-3 sentences), "datasetNarratives": {"<id>": string (1-2 sentences per dataset)}, "keyPoints": string[] (3-5), "recommendations": [{"title": string ≤8 words, "detail": string 1-2 sentences, "priority": "high"|"medium"|"low"}] (2-4), "predictiveSummary": string (1-2 sentences)}',
      ].join('\n'),
    },
    {
      role: 'user' as const,
      content: JSON.stringify({ section, title, facts: allFacts }),
    },
  ];
}

// ---------------------------------------------------------------------------
// Pipeline entry point
// ---------------------------------------------------------------------------

export async function buildSectionSummary(
  section: string,
  title: string,
  datasets: CleanDataset[],
  callLLM: LLMCaller,
): Promise<SectionSummaryPayload> {
  // 1. Deterministic layer — always correct, never depends on the LLM.
  const allFacts = datasets.map(buildFacts);
  const presented: PresentedDataset[] = datasets.map((ds, i) => {
    const total = allFacts[i].total as number;
    return {
      id: ds.id,
      name: ds.name,
      unit: ds.unit,
      kind: ds.kind,
      total,
      headline: buildHeadline(ds, allFacts[i]),
      rows: presentRows(ds, total),
      narrative: '',
    };
  });

  // 2. LLM layer — prose only, grounded against the facts.
  let parsed: Record<string, unknown> = {};
  try {
    const aiText = await callLLM(buildMessages(section, title, allFacts));
    parsed = JSON.parse(extractJson(aiText)) as Record<string, unknown>;
  } catch (error) {
    console.warn('[section-summary] LLM unavailable/unparseable, serving deterministic summary:', error);
  }

  const allowed = collectAllowedNumbers({ allFacts, presented });

  const narratives =
    parsed.datasetNarratives && typeof parsed.datasetNarratives === 'object'
      ? (parsed.datasetNarratives as Record<string, unknown>)
      : {};
  for (const ds of presented) {
    const raw = normalizeText(narratives[ds.id]);
    ds.narrative = raw ? stripUngroundedSentences(raw, allowed) : '';
  }

  const keyPoints = filterGroundedBullets(
    Array.isArray(parsed.keyPoints) ? parsed.keyPoints.map((s) => normalizeText(s)).filter(Boolean) : [],
    allowed,
  ).slice(0, 5);

  const recommendations = cleanRecommendations(parsed.recommendations, allowed);

  return {
    executiveSummary:
      stripUngroundedSentences(normalizeText(parsed.executiveSummary), allowed) ||
      presented
        .slice(0, 2)
        .map((ds) => ds.headline)
        .join(' '),
    keyPoints: keyPoints.length > 0 ? keyPoints : fallbackKeyPoints(datasets, allFacts),
    datasets: presented,
    recommendations:
      recommendations.length > 0 ? recommendations : fallbackRecommendations(datasets, allFacts),
    predictiveSummary:
      stripUngroundedSentences(normalizeText(parsed.predictiveSummary), allowed) ||
      'No major shift signal yet — current numbers are still in line with the previous period’s pattern.',
  };
}
