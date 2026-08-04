/**
 * GET /api/ai/forecast/by-dimension — per-entity weekly volume forecast for
 * one dimension, highest predicted volume first.
 * Query: ?dimension=branch|airline|area|subcategory|category&weeks=4
 */
import { NextRequest, NextResponse } from 'next/server';
import { mlClient } from '@/lib/ml-client';
import { resolveCachedAI } from '@/lib/ai-route-cache';
import {
  requireElevatedAISession,
  unauthorizedResponse,
  aiUnavailableResponse,
} from '@/lib/ai-route-helpers';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DIMENSIONS = ['airline', 'branch', 'area', 'subcategory', 'category'] as const;
type Dimension = (typeof DIMENSIONS)[number];

export async function GET(req: NextRequest) {
  const session = await requireElevatedAISession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const rawDimension = searchParams.get('dimension') ?? 'subcategory';
  const dimension: Dimension = (DIMENSIONS as readonly string[]).includes(rawDimension)
    ? (rawDimension as Dimension)
    : 'subcategory';
  const weeks = Math.min(26, Math.max(1, Number(searchParams.get('weeks')) || 4));

  try {
    const result = await resolveCachedAI({
      feature: 'forecast-by-dimension-v1',
      scope: { dimension, weeks },
      resolver: () => mlClient.forecastByDimension(dimension, weeks),
    });

    return NextResponse.json(
      {
        ...result.payload,
        cached: result.cached,
        generatedAt: result.generatedAt,
      },
      { headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    );
  } catch (error) {
    return aiUnavailableResponse(error);
  }
}
