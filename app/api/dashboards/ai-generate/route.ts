import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth-utils';
import { normalizeQuery, normalizeVisualization } from '@/lib/builder/normalization';
import { callOpenRouterAI } from '@/lib/ai/openrouter';
import { TABLES, JOINS } from '@/lib/builder/schema';
import type { DashboardDefinition, DashboardTile } from '@/types/builder';

function buildSchemaContext(): string {
  const tableDescriptions = TABLES.map(t => {
    const fields = t.fields.map(f => {
      let desc = `    - ${f.name} (${f.type}, label: "${f.label}")`;
      if (f.enumValues && f.enumValues.length > 0) {
        desc += ` — enum: [${f.enumValues.map(v => `"${v}"`).join(', ')}]`;
      }
      return desc;
    }).join('\n');
    return `  Table: "${t.name}" (label: "${t.label}")\n  Fields:\n${fields}`;
  }).join('\n\n');

  const joinDescriptions = JOINS.map(j =>
    `  - key: "${j.key}" — ${j.from}.${j.fromField} → ${j.to}.${j.toField} (label: "${j.label}")`
  ).join('\n');

  return `DATABASE SCHEMA:\n\n${tableDescriptions}\n\nAVAILABLE JOINS:\n${joinDescriptions}`;
}

import { reportsService } from '@/lib/services/reports-service';

async function buildDataContext(): Promise<string> {
  try {
    const reports = await reportsService.getReports();

    if (reports.length === 0) {
        return '\n(No data laporan ditemukan)\n';
    }

    const total_reports = reports.length;

    const sortedDates = reports
        .map(r => r.date_of_event || r.created_at)
        .filter(d => d)
        .sort();
    const earliest_date = sortedDates[0] || '?';
    const latest_date = sortedDates[sortedDates.length - 1] || '?';

    const fieldsToAnalyze = [
        'category', 'area', 'severity', 'status',
        'hub', 'jenis_maskapai', 'airlines', 'branch', 'station_code',
        'terminal_area_category', 'apron_area_category', 'general_category',
        'incident_type_id', 'root_caused',
        'kode_cabang', 'kode_hub', 'maskapai_lookup', 'lokal_mpa_lookup'
    ];

    const grouped: Record<string, Record<string, number>> = {};

    fieldsToAnalyze.forEach(field => {
        grouped[field] = {};
    });

    reports.forEach(r => {
        fieldsToAnalyze.forEach(field => {
            const source = r as Record<string, unknown>;
            const raw = source[field] || source[field === 'category' ? 'main_category' : ''];
            if (raw) {
                const val = String(raw);
                grouped[field][val] = (grouped[field][val] || 0) + 1;
            }
        });
    });

    let context = `\nDATA AKTUAL DARI GOOGLE SHEETS (gunakan ini untuk akurasi):\n`;
    context += `- Total laporan: ${total_reports}\n`;
    context += `- Rentang tanggal: ${earliest_date} s/d ${latest_date}\n\n`;

    for (const field of fieldsToAnalyze) {
      const dist = grouped[field];
      const entries = Object.entries(dist).sort((a, b) => b[1] - a[1]).slice(0, 20);

      if (entries.length > 0) {
          context += `Field "${field}" — distribusi aktual (Top 20):\n`;
          for (const [val, count] of entries) {
            context += `  "${val}": ${count} laporan\n`;
          }
          context += '\n';
      }
    }

    return context;
  } catch (err) {
    console.error('Failed to build data context:', err);
    return '\n(Gagal mengambil data konteks dari Google Sheets)\n';
  }
}

function buildSystemPrompt(dataContext: string): string {
  return `You are a senior data analyst at PT Gapura Angkasa (airport ground handling). Turn operational data into a precise, executive-grade dashboard. Never invent fields or values.

# SCHEMA (only source of truth — use these exact table/field names)
${buildSchemaContext()}

# DATA SNAPSHOT (actual distributions — design to fit real data)
${dataContext}

# HARD RULES
- Main table is "reports". Every dimension/measure: "table":"reports". Never use aliases like data/dataset/laporan/compliments.
- Count rows: {"table":"reports","field":"id","function":"COUNT","alias":"total_reports"}. Fields like total_laporan/jumlah/count DO NOT exist — always COUNT "id".
- Group by month: dimension "date_of_event" with "dateGranularity":"month".
- Every non-kpi chart MUST have ≥1 dimension (a bar with no dimension = one useless bar).
- Skip fields with 1 distinct value as a comparison dimension.
- Areas: APRON (airside/ramp), TERMINAL (landside/pax), GENERAL (admin). Cargo (CGO): filter {"field":"source_sheet","operator":"eq","value":"CGO"}; non-cargo: operator "neq".

# CHART CHOICE (by data shape)
- Time on X → line (or area if >12 points), bar if ≤12 points.
- Ranking categories → horizontal_bar if >8 items or long labels, else bar/donut.
- Part-to-whole → donut/pie (≤5 slices) else horizontal_bar.
- Metric × 2 dimensions → heatmap or pivot.
- Single number → kpi.

# LAYOUT (12-col grid; the renderer auto-packs into a bento, so w/h are sizing hints)
- kpi: w 3, h 1. line/area/combo: w 8, h 2. table/pivot/heatmap: w 12, h 3.
- horizontal_bar: w 6, h 2 (h 3 if >8 rows). bar/stacked_bar/scatter: w 6, h 2. pie/donut: w 4, h 2.
- Order tiles best-first: KPIs, then headline trend, then breakdowns, then deep-dive/table.

# STRUCTURE
- Broad/multi-topic request → multiple pages: "Executive Summary" (KPIs + trend), "Operational Detail" (breakdowns by station/airline/area), "Root Cause" (deep dive). Don't cram one page.
- Titles are business-relevant ("Top 10 Airlines by Incident Volume"). Rankings sort metric desc; trends sort time asc.

# OUTPUT
Return ONE valid JSON object, no markdown/backticks:
{"name":"...","description":"...","pages":[{"name":"...","tiles":[{"id":"unique_slug","query":{"source":"reports","measures":[{"table":"reports","field":"id","function":"COUNT","alias":"total_reports"}],"dimensions":[{"table":"reports","field":"category","alias":"category"}],"sorts":[{"field":"total_reports","direction":"desc"}],"limit":10,"filters":[]},"visualization":{"chartType":"horizontal_bar","title":"Reports by Category","xAxis":"category","yAxis":["total_reports"],"showLegend":false,"showLabels":true},"layout":{"x":0,"y":0,"w":6,"h":2}}]}]}`;
}

const TILE_PALETTES = [
  ['#7cb342', '#9ccc65', '#c5e1a5'],
  ['#558b2f', '#689f38', '#8bc34a'],
  ['#33691e', '#558b2f', '#7cb342'],
  ['#43a047', '#66bb6a', '#a5d6a7'],
  ['#2e7d32', '#4caf50', '#81c784'],
  ['#aed581', '#c5e1a5', '#dcedc8'],
  ['#689f38', '#7cb342', '#9ccc65'],
  ['#388e3c', '#4caf50', '#66bb6a'],
];

function postProcessDashboard(def: DashboardDefinition): DashboardDefinition {

  if (def.pages && def.pages.length > 0) {
    let globalIdx = 0;
    def.pages = def.pages.map(page => {
      page.tiles = (page.tiles || []).map(tile => {
        tile = processTile(tile, globalIdx);
        globalIdx++;
        return tile;
      });
      return page;
    });

    const seenIds = new Set<string>();
    def.tiles = def.pages.flatMap(p => p.tiles || []).filter(tile => {
      if (seenIds.has(tile.id)) return false;
      seenIds.add(tile.id);
      return true;
    });
  } else if (def.tiles && def.tiles.length > 0) {

    const seenIds = new Set<string>();
    def.tiles = def.tiles.filter(tile => {
      if (seenIds.has(tile.id)) return false;
      seenIds.add(tile.id);
      return true;
    }).map((tile, idx) => processTile(tile, idx));
    def.pages = [{ name: 'Ringkasan Umum', tiles: def.tiles }];
  }

  return def;
}

function processTile(tile: DashboardTile, idx: number): DashboardTile {
  tile.id = tile.id || `tile-${Date.now()}-${idx + 1}`;

  if (!tile.query) {
    (tile as unknown as { query: Record<string, unknown> }).query = {};
  }
  if (!tile.query.source) tile.query.source = 'reports';
  if (!tile.query.joins) tile.query.joins = [];
  if (!tile.query.dimensions) tile.query.dimensions = [];
  if (!tile.query.measures) tile.query.measures = [];

   const VALID_TABLES = new Set(TABLES.map(t => t.name));

   const fixTable = (t: string | undefined) => {
     if (!t) return 'reports';

     if (VALID_TABLES.has(t)) return t;

     const lower = t.toLowerCase();
     if (lower.includes('laporan') || lower.includes('report') || lower.includes('data') || lower.includes('bulanan') || lower.includes('compliment')) {

        return 'reports';
     }

     return 'reports'; 
   };

   const fixField = (f: string) => {
     if (f === 'total_reports' || f === 'jumlah_laporan' || f === 'total' || f === 'total_laporan' || f === 'jumlah' || f === 'jumlah_data' || f === 'monthly_compliments' || f === 'compliments_count' || f === 'total_compliments') return 'id';
     return f;
   };

   if (tile.query.dimensions) {
     tile.query.dimensions.forEach(d => {
       d.table = fixTable(d.table);

       if (d.field === 'bulan' || d.field === 'month') {

          if (d.field === 'bulan') d.field = 'month';
       }
     });
   }

   if (tile.query.measures) {
     tile.query.measures.forEach(m => {
       m.table = fixTable(m.table);
       const originalField = m.field;
       m.field = fixField(m.field);

       if (m.field === 'id' && (originalField !== 'id' || m.function === 'SUM')) {
           m.function = 'COUNT';
       }
     });
   }

  tile.query = normalizeQuery(tile.query);

  if (!tile.query.sorts) tile.query.sorts = [];
  if (!tile.query.filters) tile.query.filters = [];
  if (!tile.visualization) {
    (tile as unknown as { visualization: Record<string, unknown> }).visualization = {};
  }
  if (!tile.layout) {
    (tile as unknown as { layout: Record<string, unknown> }).layout = { x: 0, y: 0, w: 6, h: 4 };
  }

  tile = normalizeVisualization(tile as DashboardTile);

  if (tile.visualization.chartType === 'pie' || tile.visualization.chartType === 'donut') {
    tile.visualization.showLabels = true;
  }

  if (tile.query.sorts.length === 0 && tile.query.measures.length > 0) {
    const m = tile.query.measures[0];
    const sortField = m.alias || `${m.function.toLowerCase()}_${m.table}_${m.field}`;
    tile.query.sorts = [{ field: sortField, direction: 'desc', alias: sortField }];
  }

  if (tile.visualization.title?.match(/Top|Terbanyak|Tertinggi|Terendah/i)) {
    tile.query.limit = 5;
  }

  if (tile.visualization.chartType !== 'table' && (tile.query.limit || 0) > 8) {
    tile.query.limit = 8;
  }

  if (!tile.query.limit) {
    if (tile.visualization.chartType === 'table') tile.query.limit = 50;
    else if (tile.visualization.chartType === 'kpi') tile.query.limit = 1;
    else tile.query.limit = 5;
  }

  const VALID_OPERATORS = new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'in', 'not_in', 'between', 'is_null', 'is_not_null']);
  tile.query.filters = tile.query.filters.filter(f => {
    if (!VALID_OPERATORS.has(f.operator)) return false;
    if (f.operator === 'is_null' || f.operator === 'is_not_null') return true;
    if (f.value === null || f.value === undefined) return false;
    if (typeof f.value === 'string' && f.value.trim() === '') return false;
    if (Array.isArray(f.value) && f.value.length === 0) return false;
    return true;
  }).map(f => ({ ...f, conjunction: f.conjunction || 'AND' }));

  if (!tile.visualization.colors || tile.visualization.colors.length === 0) {
    tile.visualization.colors = TILE_PALETTES[idx % TILE_PALETTES.length];
  }

  return tile;
}

function validateDashboardDefinition(def: DashboardDefinition): string[] {
  const errors: string[] = [];
  if (!def.name) errors.push('Dashboard harus memiliki nama');

  const allTiles = def.pages 
    ? def.pages.flatMap(p => p.tiles || []) 
    : (def.tiles || []);

  if (allTiles.length === 0) errors.push('Dashboard harus memiliki minimal 1 tile');

  allTiles.forEach((tile, i) => {
    if (!tile.query?.source) errors.push(`Tile ${i + 1}: sumber data tidak valid`);
    if (!tile.visualization?.chartType) errors.push(`Tile ${i + 1}: tipe visualisasi tidak valid`);
  });

  return errors;
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

    const role = String(payload.role).trim().toUpperCase();
    if (role !== 'ANALYST' && role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: hanya Analyst dan Admin' }, { status: 403 });
    }

    const body = await request.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json({ error: 'Prompt diperlukan' }, { status: 400 });
    }

    if (prompt.length > 2000) {
      return NextResponse.json({ error: 'Prompt terlalu panjang (maks 2000 karakter)' }, { status: 400 });
    }

    const dataContext = await buildDataContext();

    const systemPrompt = buildSystemPrompt(dataContext);

    let content;

    try {
      content = await callOpenRouterAI([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ]);
    } catch (error) {
       console.error('AI API error:', error);
       return NextResponse.json(
        { error: 'Failed to reach AI. Try again later.' },
        { status: 502 }
      );
    }

    if (!content) {
      return NextResponse.json(
        { error: 'AI tidak mengembalikan respons' },
        { status: 502 }
      );
    }

    content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    let dashboard: DashboardDefinition;
    try {

      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
      if (jsonMatch) {
         content = jsonMatch[1];
      }
      dashboard = JSON.parse(content) as DashboardDefinition;
    } catch {
      console.error('Failed to parse AI response:', content);
      return NextResponse.json(
        { error: 'AI mengembalikan format yang tidak valid. Coba ubah prompt.' },
        { status: 422 }
      );
    }

    dashboard = postProcessDashboard(dashboard);

    const validationErrors = validateDashboardDefinition(dashboard);
    if (validationErrors.length > 0) {
      console.error('AI dashboard validation errors:', validationErrors);
      return NextResponse.json(
        { error: 'Dashboard yang dihasilkan AI tidak valid', details: validationErrors },
        { status: 422 }
      );
    }

    const generatedId = `ai-${Date.now()}`;
    const generatedSlug = `ai-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    return NextResponse.json({ 
      dashboard: {
        ...dashboard,
        id: generatedId,
        slug: generatedSlug
      } 
    });
  } catch (err) {
    console.error('AI generate error:', err);
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
