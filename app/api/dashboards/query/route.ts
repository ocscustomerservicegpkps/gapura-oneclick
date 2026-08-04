import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth-utils';
import { validateQuery } from '@/lib/builder/sql-builder';
import { normalizeQuery } from '@/lib/builder/normalization';
import type { QueryDefinition } from '@/types/builder';
import { executeQuery } from '@/lib/services/query-executor';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('session')?.value;
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifySession(session);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const canViewAll = ['SUPER_ADMIN', 'ANALYST', 'DIVISI_ESKALASI'].includes(payload.role);
    const userStationCode = canViewAll ? null : payload.station_id || null;

    const body = await request.json();
    let query: QueryDefinition = body.query;

    if (!query) {
      return NextResponse.json({ error: 'Query definition diperlukan' }, { status: 400 });
    }

    query = normalizeQuery(query);

    const errors = validateQuery(query);
    if (errors.length > 0) {
      console.warn('[Query API] Validation failed:', {
        errors,
        query: JSON.stringify(query, null, 2)
      });
      return NextResponse.json({ error: 'Query tidak valid', details: errors }, { status: 400 });
    }

    const result = await executeQuery(query, {
      canViewAll,
      userStationCode
    });

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'private, no-store, max-age=0',
      }
    });
  } catch (err) {
    console.error('Query API error:', err);
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
