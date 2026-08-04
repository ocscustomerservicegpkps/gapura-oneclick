import { NextRequest, NextResponse } from 'next/server';
import { requireAISession, unauthorizedResponse } from '@/lib/ai-route-helpers';
import { mlClient, type RiskEntry } from '@/lib/ml-client';
import { CaseInsightResponse, type Severity } from '@/lib/schemas/insight';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function entityName(entry: RiskEntry | undefined): string | null {
  if (!entry) return null;
  const nameField = Object.entries(entry).find(([, value]) => typeof value === 'string');
  return nameField ? String(nameField[1]) : null;
}

function findEntry(entries: RiskEntry[] | undefined, name: string | undefined): RiskEntry | undefined {
  if (!entries || !name) return undefined;
  return entries.find((entry) => entityName(entry)?.toLowerCase() === name.toLowerCase());
}

function severityFromScore(score: number): Severity {
  if (score >= 70) return 'TOP RISK';
  if (score >= 45) return 'HIGH RISK';
  if (score >= 20) return 'MEDIUM';
  return 'LOW';
}

export async function POST(req: NextRequest) {
  const session = await requireAISession();
  if (!session) return unauthorizedResponse();

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const text = String(body.report_text ?? body.report ?? '').trim();
  if (!text) {
    return NextResponse.json({ error: 'report_text is required' }, { status: 400 });
  }

  const ctx = {
    area: body.area || undefined,
    airline: body.airline || undefined,
    branch: body.hub || undefined,
  };

  let analysis: Awaited<ReturnType<typeof mlClient.analyze>>;
  let health: Awaited<ReturnType<typeof mlClient.health>> | null;
  try {
    [analysis, health] = await Promise.all([
      mlClient.analyze(text, ctx),
      mlClient.health().catch(() => null),
    ]);
  } catch (e) {
    console.error('[insight/case] AI service unreachable:', e);
    return NextResponse.json({ error: 'AI service unreachable' }, { status: 503 });
  }

  const warnings: string[] = [];
  if (!health) {
    warnings.push('Model health/version info was unavailable for this request.');
  }

  // Severity isn't a direct model output today; derive it from the real
  // risk-ranking score for whichever entities the caller supplied.
  const rankings = analysis.risk_rankings ?? {};
  const matchedScores: number[] = [];
  [
    findEntry(rankings.airline, ctx.airline),
    findEntry(rankings.area, ctx.area),
    findEntry(rankings.branch, ctx.branch),
  ].forEach((entry) => {
    if (entry) matchedScores.push(entry.risk_score);
  });
  const avgRiskScore = matchedScores.length > 0
    ? matchedScores.reduce((sum, value) => sum + value, 0) / matchedScores.length
    : null;
  const severity: Severity | null = avgRiskScore != null ? severityFromScore(avgRiskScore) : null;
  if (severity == null) {
    warnings.push('No matching airline/area/station risk-score entry was found; severity was not predicted.');
  }

  const forecastPoints = analysis.forecast?.forecast ?? [];
  const coverageMatch = analysis.forecast?.interval?.match(/(\d+(?:\.\d+)?)\s*%/);
  const coverage = coverageMatch ? Number(coverageMatch[1]) / 100 : 0.8;
  const forecast = forecastPoints.length > 0 ? {
    series_key: 'case_daily_forecast',
    history_points: health?.row_count ?? 0,
    coverage,
    points: forecastPoints.map((point) => ({
      period: point.date,
      yhat: point.predicted_count,
      yhat_lower: point.lower ?? point.predicted_count,
      yhat_upper: point.upper ?? point.predicted_count,
    })),
  } : null;
  if (!forecast) {
    warnings.push('Forecast series was not returned by the AI service for this request.');
  }

  const primaryConfidence = analysis.category.confidence ?? 0;
  const labels = [analysis.category.label, analysis.subcategory.label].filter(
    (label): label is string => Boolean(label) && label !== 'UNCERTAIN',
  );
  const rootCauseLabel = analysis.root_cause.label && analysis.root_cause.label !== 'UNCERTAIN'
    ? analysis.root_cause.label
    : null;

  const sentence = [
    labels.length > 0 ? `Classified as ${labels.join(' / ')}` : 'Classification confidence was too low to label this case',
    rootCauseLabel ? `likely root cause: ${rootCauseLabel}` : null,
    severity && avgRiskScore != null ? `${severity.toLowerCase()} based on the matched risk score (${avgRiskScore.toFixed(0)}/100)` : null,
  ].filter(Boolean).join(', ') + '.';

  const signal: 'ok' | 'watch' | 'risk' | 'opportunity' =
    severity === 'TOP RISK' || severity === 'HIGH RISK' ? 'risk' :
    severity === 'MEDIUM' ? 'watch' :
    severity === 'LOW' ? 'ok' :
    primaryConfidence < 0.5 ? 'watch' : 'ok';

  const response: CaseInsightResponse = {
    headline: {
      sentence,
      signal,
      confidence: primaryConfidence,
    },
    as_of: new Date().toISOString(),
    records_basis: health?.row_count ?? 0,
    severity_predicted: severity,
    severity_confidence: null,
    forecast,
    warnings,
    model_versions: health?.version ? { ml_service: health.version } : {},
  };

  const parsed = CaseInsightResponse.safeParse(response);
  if (!parsed.success) {
    console.error('[insight/case] Internal response failed schema validation:', parsed.error.issues);
    return NextResponse.json({ error: 'Failed to build insight response' }, { status: 500 });
  }

  return NextResponse.json(parsed.data);
}
