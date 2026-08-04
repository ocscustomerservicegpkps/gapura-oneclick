import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth-utils';
import { callOpenRouterAI } from '@/lib/ai/openrouter';
import { checkDbRateLimit } from '@/lib/security/rate-limit';

const MAX_TILES = 20;
const MAX_COLUMNS_PER_TILE = 30;
const MAX_SAMPLE_ROWS_PER_TILE = 50;
const MAX_STRING_LENGTH = 500;
const MAX_REQUEST_BYTES = 200_000;

interface TileSummary {
  id: string;
  title: string;
  chartType: string;
  columns: string[];
  sampleRows: Record<string, unknown>[];
  rowCount: number;
}

interface InsightRequest {
  dashboardName: string;
  subtitle?: string;
  tiles: TileSummary[];
}

interface TileInsight {
  tileId: string;
  keyFindings: string[];
  narrative: string;
}

interface InsightsResponse {
  executiveSummary: string[];
  tileInsights: TileInsight[];
  recommendations: string[];
  closingStatement: string;
}

function buildInsightsPrompt(req: InsightRequest): string {
  const tileSections = req.tiles.map((t, i) => {
    const sampleStr = t.sampleRows.slice(0, 8).map(r =>
      t.columns.map(c => `${c}: ${r[c] ?? '-'}`).join(', ')
    ).join('\n    ');

    return `  **Chart ${i + 1}: "${t.title}"** (Tipe: ${t.chartType}, ${t.rowCount} baris)
    Kolom: ${t.columns.join(', ')}
    Data sampel:
    ${sampleStr}`;
  }).join('\n\n');

  return `Anda adalah Senior Data Analyst di Gapura Angkasa (40+ tahun pengalaman).
Tugas Anda: Analisis data dashboard ini untuk presentasi Level Eksekutif.

Dashboard: "${req.dashboardName}"
${req.subtitle ? `Subtitle: "${req.subtitle}"` : ''}

DATA FAKTUAL (JANGAN MENGARANG):
${tileSections}

KEMBALIKAN JSON PERSIS dengan format ini:
{
  "executiveSummary": [
    "Poin 1... (Fokus pada dampak operasional/finansial/safety)",
    "Poin 2... (Sertakan angka)",
    "Poin 3...",
    "Poin 4 (opsional)",
    "Poin 5 (opsional)"
  ],
  "tileInsights": [
    {
      "tileId": "tile-id-xxx",
      "keyFindings": [
        "Temuan 1 (Sebutkan angka spesifik)",
        "Temuan 2"
      ],
      "narrative": "Analisis mendalam 1-2 kalimat. Jelaskan 'Why' (mengapa ini terjadi) dan 'So What' (apa dampaknya)."
    }
  ],
  "recommendations": [
    "Rekomendasi Strategis 1 (Jangka Panjang)",
    "Rekomendasi Taktis 2 (Quick Fix)",
    "Rekomendasi 3"
  ],
  "closingStatement": "Kalimat penutup yang berwibawa."
}

ATURAN KRUSIAL:
1.  **NO HALLUCINATION**: Gunakan HANYA data yang ada di "DATA FAKTUAL". Jangan mengarang external factors jika tidak ada datanya.
2.  **SENIOR TONE**: Gunakan bahasa Indonesia profesional, tajam, dan tidak bertele-tele.
3.  **DATA INTEGRITY**: Wajib menyertakan angka/persentase aktual di dalam narasi.
4.  **RELEVANCE**: Fokus pada Safety, Security, Services (3S) dan On-Time Performance (OTP).
5.  **JSON ONLY**: Jangan berikan teks pembuka, penutup, atau markdown code blocks. Berikan HANYA raw JSON object yang valid.`;
}

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

    let rawText: string;
    try {
      rawText = await request.text();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    if (Buffer.byteLength(rawText, 'utf8') > MAX_REQUEST_BYTES) {
      return NextResponse.json({ error: 'Request payload is too large' }, { status: 413 });
    }

    let rawBody: unknown;
    try {
      rawBody = JSON.parse(rawText);
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    if (!rawBody || typeof rawBody !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const body = rawBody as Partial<InsightRequest>;

    if (typeof body.dashboardName !== 'string' || !body.dashboardName.trim()) {
      return NextResponse.json({ error: 'dashboardName is required' }, { status: 400 });
    }

    if (!Array.isArray(body.tiles) || body.tiles.length === 0) {
      return NextResponse.json({ error: 'No tiles provided' }, { status: 400 });
    }

    if (body.tiles.length > MAX_TILES) {
      return NextResponse.json({ error: `Too many tiles (max ${MAX_TILES})` }, { status: 400 });
    }

    const isBoundedString = (value: unknown): value is string =>
      typeof value === 'string' && value.length <= MAX_STRING_LENGTH;

    const isValidTile = (tile: unknown): tile is TileSummary => {
      if (!tile || typeof tile !== 'object') return false;
      const t = tile as Partial<TileSummary>;
      return (
        isBoundedString(t.id) &&
        isBoundedString(t.title) &&
        isBoundedString(t.chartType) &&
        Array.isArray(t.columns) &&
        t.columns.length <= MAX_COLUMNS_PER_TILE &&
        t.columns.every((c) => isBoundedString(c)) &&
        Array.isArray(t.sampleRows) &&
        t.sampleRows.length <= MAX_SAMPLE_ROWS_PER_TILE &&
        t.sampleRows.every((r) => r !== null && typeof r === 'object' && !Array.isArray(r)) &&
        typeof t.rowCount === 'number' &&
        Number.isFinite(t.rowCount) &&
        t.rowCount >= 0
      );
    };

    if (!body.tiles.every(isValidTile)) {
      return NextResponse.json({ error: 'One or more tiles are missing required fields or exceed size limits' }, { status: 400 });
    }

    const rateLimit = await checkDbRateLimit(`export-insights:${payload.id}`, 10, 60_000);
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Too many insight requests, please try again shortly' }, { status: 429 });
    }

    const insightRequest: InsightRequest = {
      dashboardName: body.dashboardName,
      subtitle: typeof body.subtitle === 'string' ? body.subtitle : undefined,
      tiles: body.tiles,
    };

    const prompt = buildInsightsPrompt(insightRequest);

    let content;
    try {
      content = await callOpenRouterAI([
        {
          role: "system",
          content: "Anda adalah Senior Data Analyst Gapura Angkasa. Berikan insight yang kritis, akurat, dan bernilai strategis bagi Direksi. KEMBALIKAN HANYA JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ]);
    } catch (error) {
      console.error('[export-insights] AI error:', error);
      return NextResponse.json({ error: 'Gagal menghubungi AI' }, { status: 502 });
    }

    if (!content) {
      return NextResponse.json({ error: 'AI tidak mengembalikan respons' }, { status: 502 });
    }

    content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    let insights: InsightsResponse;
    try {

      const firstBrace = content.indexOf('{');
      const lastBrace = content.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        content = content.substring(firstBrace, lastBrace + 1);
      }
      insights = JSON.parse(content);
    } catch {
      console.error('[export-insights] Failed to parse AI content. Raw output:', content);
      return NextResponse.json({ error: 'AI returned invalid JSON format' }, { status: 422 });
    }

    return NextResponse.json(insights);
  } catch (err) {
    console.error('[export-insights] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
