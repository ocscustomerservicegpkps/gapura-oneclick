/**
 * POST /api/ai/section-summary — "Ringkasan" tab of the AI Summary & Insight sheet.
 *
 * The dashboard sends NAMED DATASETS (per-month counts, per-station counts,
 * YoY comparison, …) instead of one flat list, so incomparable rows are never
 * mixed (the old flat shape made the LLM read month "June" as a category).
 * All numbers are computed deterministically in lib/ai/section-summary-core;
 * the LLM only writes grounded prose. See that module for the pipeline.
 */
import { NextRequest, NextResponse } from 'next/server';

import { callOpenRouterAI, OPENROUTER_MODEL } from '@/lib/ai/openrouter';
import { buildAICacheKey, readAICache, writeAICache } from '@/lib/ai-cache';
import { requireAISession, unauthorizedResponse } from '@/lib/ai-route-helpers';
import {
  buildSectionSummary, cleanDatasets, legacyDataset, type SectionSummaryPayload,
} from '@/lib/ai/section-summary-core';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MODEL = OPENROUTER_MODEL;

function normalizeText(value: unknown, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

async function readCached(cacheKey: string) {
  try {
    return await readAICache<SectionSummaryPayload>(cacheKey);
  } catch (error) {
    console.warn('[section-summary] cache read skipped:', error);
    return null;
  }
}

async function writeCached(cacheKey: string, payload: SectionSummaryPayload) {
  try {
    await writeAICache({
      cacheKey,
      feature: 'section-summary',
      payload,
      sourceSyncAt: null,
      syncVersion: 0,
      extraMetadata: { model: MODEL },
    });
  } catch (error) {
    console.warn('[section-summary] cache write skipped:', error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAISession();

    if (!session) {
      return unauthorizedResponse();
    }

    const body = await req.json();
    const section = normalizeText(body.section, 'Dashboard Section');
    const title = normalizeText(body.title, section);

    const datasets = (() => {
      const structured = cleanDatasets(body.datasets);
      return structured.length > 0 ? structured : legacyDataset(body.chartData);
    })();

    if (datasets.length === 0) {
      return NextResponse.json({ error: 'No data to summarize' }, { status: 422 });
    }

    const scope = { section, title, datasets, model: MODEL };
    const cacheKey = buildAICacheKey('section-summary', scope, 3);
    const cached = await readCached(cacheKey);
    if (cached?.payload) {
      return NextResponse.json({
        status: 'ok',
        cached: true,
        generatedAt: cached.generatedAt,
        model: MODEL,
        section,
        ...cached.payload,
      });
    }

    // JSON output only ~500-800 tokens; 1024 cap keeps generation under a few seconds.
    // response_format=json_object → model returns strict JSON, no markdown wrapping.
    const payload = await buildSectionSummary(section, title, datasets, (messages) =>
      callOpenRouterAI(messages, MODEL, {
        maxTokens: 1024,
        responseFormat: 'json_object',
        timeoutMs: 20000,
      }),
    );

    await writeCached(cacheKey, payload);

    return NextResponse.json({
      status: 'ok',
      cached: false,
      generatedAt: new Date().toISOString(),
      model: MODEL,
      section,
      ...payload,
    });
  } catch (error) {
    console.error('[section-summary] failed:', error);
    return NextResponse.json(
      {
        error: 'Failed to build AI summary',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
