/**
 * GET /api/ai/model-info — friendly summary of the ML service's trained
 * models and live readiness, drawn from its /health and /ready endpoints.
 */
import { NextResponse } from 'next/server';
import { mlClient } from '@/lib/ml-client';
import {
  requireAISession,
  unauthorizedResponse,
  aiUnavailableResponse,
} from '@/lib/ai-route-helpers';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function settled<T>(result: PromiseSettledResult<T>): T | null {
  if (result.status === 'fulfilled') return result.value;
  return null;
}

export async function GET() {
  const session = await requireAISession();
  if (!session) return unauthorizedResponse();

  try {
    const [health, ready] = await Promise.allSettled([
      mlClient.health(),
      mlClient.ready(),
    ]);

    const healthResult = settled(health);
    const readyResult = settled(ready);

    if (!healthResult) {
      throw new Error('ML service health check failed');
    }

    return NextResponse.json({
      status: healthResult.status,
      version: healthResult.version ?? null,
      timezone: healthResult.timezone ?? null,
      schemaDetected: healthResult.schema_detected,
      lastRetrain: healthResult.last_retrain,
      rowCount: healthResult.row_count,
      retrainRunning: healthResult.retrain_running ?? false,
      retrainLastError: healthResult.retrain_last_error ?? null,
      models: healthResult.models ?? {},
      ready: readyResult?.ready ?? null,
      missingModels: readyResult?.missing_models ?? [],
    });
  } catch (error) {
    return aiUnavailableResponse(error);
  }
}
