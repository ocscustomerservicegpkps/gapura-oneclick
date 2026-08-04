import { NextRequest, NextResponse } from 'next/server';
import { requireElevatedAISession } from '@/lib/ai-route-helpers';
import { callOpenRouterAI, OPENROUTER_MODEL, type OpenRouterMessage } from '@/lib/ai/openrouter';
import { reportsService, type ReportQueryFilters } from '@/lib/services/reports-service';
import type { Report } from '@/types';
import { checkDbRateLimit } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const REPORT_SHEETS = ['NON CARGO', 'CGO'] as const;
const INSIGHTS_MODEL = process.env.INSIGHTS_AI_MODEL || OPENROUTER_MODEL;

interface InsightFilters {
  dateFrom?: string;
  dateTo?: string;
  hubs?: string[];
  branches?: string[];
  airlines?: string[];
  categories?: string[];
  source?: 'all' | 'NON CARGO' | 'CGO';
}

// Only the columns buildDataContext (and the JS filtering below) actually
// read — verified against the live ground_handling_irregularity_report schema.
const INSIGHTS_FIELDS = [
  'status', 'severity', 'severity_level', 'source_sheet', 'created_at', 'date_of_event',
  'branch', 'reporting_branch', 'station_code', 'hub', 'kode_hub',
  'airline', 'airlines', 'maskapai_lookup',
  'area', 'terminal_area_category', 'apron_area_category', 'general_category',
  'main_category', 'category', 'irregularity_complain_category',
  'case_classification', 'case_category', 'remarks_case',
  'flight_number', 'jenis_maskapai',
  'root_caused', 'root_cause', 'action_taken', 'immediate_action', 'preventive_action',
  'report', 'description', 'title',
  'delay_code', 'delay_duration',
  'kps_remarks', 'final_remarks', 'remarks_gapura_kps',
] as const;

const SHEET_HEADERS = [
  'Status', 'Report Category', 'Irregularity/Complain Category',
  'Terminal Area Category', 'Apron Area Category', 'General Category', 'Area',
  'Branch', 'Reporting Branch', 'Station',
  'Airlines', 'Airline', 'MAPPED_HUB', 'HUB', 'Hub',
  'Date of Event', 'Flight Number', 'Jenis Maskapai',
  'Root Caused', 'Action Taken', 'Report', 'Preventive Action',
  'Severity Level', 'Severity', 'Delay Code', 'Delay Duration',
  'Case Classification', 'Gapura KPS Remarks',
];

// The `area` column carries the same free-text legacy sheet values the old
// Sheets-direct code cleaned up (including odd placeholder names some users
// typed in), so the same normalization is re-applied here to the DB value.
function normalizeAreaLabel(rawArea: string): string {
  const areaLower = rawArea.toLowerCase();
  if (
    areaLower.includes('dennis') ||
    areaLower.includes('dilalailaty') ||
    areaLower.includes('melisa') ||
    areaLower === '-' ||
    areaLower === 'n/a'
  ) {
    return 'General';
  }
  if (areaLower.includes('apron')) return 'Apron Area';
  if (areaLower.includes('terminal')) return 'Terminal Area';
  if (areaLower === 'general') return 'General';
  return rawArea;
}

function normalizeAirlineLabel(rawAirline: string): string {
  const al = rawAirline.toLowerCase();
  if (al === 'thai airways') return 'Thai Airways';
  if (al === 'airasia') return 'AirAsia';
  if (al.includes('hong kong') || al.includes('hongkong')) return 'Hong Kong Airlines';
  if (al === 'vietjet air') return 'VietJet Air';
  if (al === 'indigo') return 'IndiGo';
  if (al === 'ethiopian airline') return 'Ethiopian Airlines';
  return rawAirline;
}

function toSheetLikeRow(report: Report): Record<string, string> {
  const str = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());
  const airlineRaw = str(report.airlines || report.airline);
  const airlineValue = airlineRaw ? normalizeAirlineLabel(airlineRaw) : '';
  const areaRaw = str(report.area);
  return {
    'Status': str(report.status),
    'Report Category': str(report.main_category || report.category),
    'Irregularity/Complain Category': str(report.irregularity_complain_category),
    'Terminal Area Category': str(report.terminal_area_category),
    'Apron Area Category': str(report.apron_area_category),
    'General Category': str(report.general_category),
    'Area': areaRaw ? normalizeAreaLabel(areaRaw) : '',
    'Branch': str(report.branch || report.station_code || report.reporting_branch),
    'Reporting Branch': str(report.reporting_branch),
    'Station': str(report.station_code),
    'Airlines': airlineValue,
    'Airline': airlineValue,
    'MAPPED_HUB': str(report.hub || report.kode_hub),
    'HUB': str(report.hub),
    'Hub': str(report.hub),
    'Date of Event': str(report.date_of_event || report.created_at),
    'Flight Number': str(report.flight_number),
    'Jenis Maskapai': str(report.jenis_maskapai),
    'Root Caused': str(report.root_caused || report.root_cause),
    'Action Taken': str(report.action_taken || report.immediate_action),
    'Report': str(report.report || report.description || report.title),
    'Preventive Action': str(report.preventive_action),
    'Severity Level': str(report.severity_level || report.severity),
    'Severity': str(report.severity),
    'Delay Code': str(report.delay_code),
    'Delay Duration': str(report.delay_duration),
    'Case Classification': str(report.case_classification),
    'Gapura KPS Remarks': str(report.kps_remarks || report.remarks_gapura_kps || report.final_remarks),
  };
}

// Reads the already-synced Postgres table instead of live-fetching Google
// Sheets on every chat question — the sync job keeps this table current, so
// there's no freshness loss, just far less latency and no Sheets API quota use.
async function fetchFilteredReportData(filters: InsightFilters): Promise<{
  rows: Record<string, string>[];
  headers: string[];
  sheetName: string;
}[]> {
  const dbFilters: ReportQueryFilters = {};
  if (filters.dateFrom) dbFilters.dateFrom = filters.dateFrom;
  if (filters.dateTo) dbFilters.dateTo = filters.dateTo;
  if (filters.branches && filters.branches.length === 1) dbFilters.branch = filters.branches[0];
  else if (filters.branches && filters.branches.length > 1) dbFilters.branchIn = filters.branches;
  if (filters.source && filters.source !== 'all') dbFilters.sourceSheet = filters.source;

  const reports = await reportsService.getReports({
    fields: INSIGHTS_FIELDS,
    filters: Object.keys(dbFilters).length > 0 ? dbFilters : undefined,
  });

  const bySheet = new Map<string, Report[]>();
  for (const r of reports) {
    const sheetName = r.source_sheet === 'CGO' ? 'CGO' : 'NON CARGO';
    if (!bySheet.has(sheetName)) bySheet.set(sheetName, []);
    bySheet.get(sheetName)!.push(r);
  }

  const sheetsToInclude = filters.source && filters.source !== 'all' ? [filters.source] : REPORT_SHEETS;

  return sheetsToInclude.map((sheetName) => {
      const structured = (bySheet.get(sheetName) || []).map(toSheetLikeRow);

      const filtered = structured.filter((row) => {

        if (filters.dateFrom || filters.dateTo) {
          const dateField = row['Date of Event'] || row['Date_of_Event'] || row['Date'] || '';
          if (!dateField) return false;

          let rowDate: Date;
          const asInt = Number(dateField);
          if (Number.isFinite(asInt) && asInt > 20000 && asInt < 80000) {
            rowDate = new Date((asInt - 25569) * 86400 * 1000);
          } else {
            rowDate = new Date(dateField);
          }
          if (isNaN(rowDate.getTime())) return false;
          if (filters.dateFrom && rowDate < new Date(filters.dateFrom)) return false;
          if (filters.dateTo) {
            const to = new Date(filters.dateTo);
            to.setHours(23, 59, 59, 999);
            if (rowDate > to) return false;
          }
        }

        if (filters.hubs && filters.hubs.length > 0) {
          const hub = row['MAPPED_HUB'];
          if (!filters.hubs.some((h) => hub.toLowerCase().includes(h.toLowerCase()))) return false;
        }

        if (filters.branches && filters.branches.length > 0) {
          const branch = row['Branch'] || row['Reporting Branch'] || row['Reporting_Branch'] || row['Station'] || row['KODE CABANG (VLOOKUP)'] || '';
          if (!filters.branches.some((b) => branch.toLowerCase().includes(b.toLowerCase()))) return false;
        }

        if (filters.airlines && filters.airlines.length > 0) {
          const airline = row['Airlines'] || row['Airline'] || row['Maskapai'] || row['MASKAPAI (VLOOKUP)'] || '';
          if (!filters.airlines.some((a) => airline.toLowerCase().includes(a.toLowerCase()))) return false;
        }

        if (filters.categories && filters.categories.length > 0) {

          const cat =
            row['Irregularity/Complain Category'] ||
            row['Irregularity_Complain_Category'] ||
            row['Report Category'] ||
            row['Report_Category'] ||
            row['Terminal Area Category'] ||
            row['Apron Area Category'] ||
            row['General Category'] ||
            row['Main Category'] ||
            '';
          if (!filters.categories.some((c) => cat.toLowerCase().includes(c.toLowerCase()))) return false;
        }

        return true;
      });

      return { rows: filtered, headers: SHEET_HEADERS, sheetName };
    });
}

function buildDataContext(
  sheetResults: { rows: Record<string, string>[]; headers: string[]; sheetName: string }[]
): string {
  const parts: string[] = [];
  let totalRows = 0;

  for (const { rows, headers, sheetName } of sheetResults) {
    if (rows.length === 0) continue;

    totalRows += rows.length;
    parts.push(`\n## Sheet: ${sheetName} (${rows.length} rows)`);
    parts.push(`Kolom: ${headers.join(', ')}`);

    const statusCount: Record<string, number> = {};
    const reportCategoryCount: Record<string, number> = {};
    const specificCategoryCount: Record<string, number> = {};
    const terminalAreaCount: Record<string, number> = {};
    const apronAreaCount: Record<string, number> = {};
    const branchCount: Record<string, number> = {};
    const airlineCount: Record<string, number> = {};
    const hubCount: Record<string, number> = {};
    const areaByReportCategory: Record<string, Record<string, number>> = {};

    for (const row of rows) {
      const status = row['Status'] || 'Unknown';
      statusCount[status] = (statusCount[status] || 0) + 1;

      const repCat = row['Report Category'] || row['Report_Category'] || '';
      if (repCat) reportCategoryCount[repCat] = (reportCategoryCount[repCat] || 0) + 1;

      const specCat =
        row['Irregularity/Complain Category'] ||
        row['Irregularity_Complain_Category'] ||
        row['Terminal Area Category'] ||
        row['Apron Area Category'] ||
        row['General Category'] ||
        '';
      if (specCat) specificCategoryCount[specCat] = (specificCategoryCount[specCat] || 0) + 1;

      const area = row['Area'] || '';
      if (area) {

        const normalizedArea = area.trim();
        if (['Terminal Area', 'Apron Area', 'General'].includes(normalizedArea)) {
          terminalAreaCount[normalizedArea] = (terminalAreaCount[normalizedArea] || 0) + 1;

          const repCat2 = row['Report Category'] || row['Report_Category'] || '';
          if (repCat2) {
             if (!areaByReportCategory[normalizedArea]) areaByReportCategory[normalizedArea] = {};
             areaByReportCategory[normalizedArea][repCat2] = (areaByReportCategory[normalizedArea][repCat2] || 0) + 1;
          }
        }
      }

      const termCat = row['Terminal Area Category'] || '';
      if (termCat) terminalAreaCount[termCat] = (terminalAreaCount[termCat] || 0) + 1;

      const apronCat = row['Apron Area Category'] || '';
      if (apronCat) apronAreaCount[apronCat] = (apronAreaCount[apronCat] || 0) + 1;

      const branch = row['Branch'] || row['Reporting Branch'] || row['Reporting_Branch'] || row['Station'] || '';
      if (branch) branchCount[branch] = (branchCount[branch] || 0) + 1;

      const airline = row['Airlines'] || row['Airline'] || '';
      if (airline) airlineCount[airline] = (airlineCount[airline] || 0) + 1;

      const hub = row['MAPPED_HUB'] || row['HUB'] || row['Hub'] || '';
      if (hub) hubCount[hub] = (hubCount[hub] || 0) + 1;
    }

    parts.push(`--- SUMMARY DISTRIBUTIONS (USE THIS FOR CHARTS) ---`);
    parts.push(`Status Distribution: ${JSON.stringify(statusCount)}`);
    parts.push(`Report Category (Complaint/Irregularity/Compliment) Distribution: ${JSON.stringify(reportCategoryCount)}`);
    parts.push(`Specific Category (Pax Handling/Baggage/etc) Distribution: ${JSON.stringify(specificCategoryCount)}`);
    parts.push(`Area by Report Category Distribution (USE THIS UNTUK PERTANYAAN SPT COMPLAINT PER AREA): ${JSON.stringify(areaByReportCategory)}`);
    parts.push(`Terminal Area Detail Distribution: ${JSON.stringify(terminalAreaCount)}`);
    parts.push(`Apron Area Detail Distribution: ${JSON.stringify(apronAreaCount)}`);
    parts.push(`Branch/Station Distribution: ${JSON.stringify(branchCount)}`);
    parts.push(`Airline Distribution: ${JSON.stringify(airlineCount)}`);
    parts.push(`Hub Distribution: ${JSON.stringify(hubCount)}`);
    parts.push(`--------------------------------------------------`);

    // Cap the per-row detail dump — summary distributions above already cover the
    // full filtered set, so this is just a sample for illustrative detail. Without
    // a cap, large result sets blow past the model's context window (seen with
    // ~1,100 unfiltered rows producing a 156k-token prompt against a 131k limit).
    const MAX_DETAIL_ROWS = 300;
    const sampleLimit = Math.min(rows.length, MAX_DETAIL_ROWS);
    const relevantFields = [
      'Date of Event', 'Date_of_Event',
      'Airlines', 'Airline', 'Maskapai', 'Jenis Maskapai',
      'Flight Number', 'Flight_Number',
      'Branch', 'Reporting Branch', 'Cabang',
      'MAPPED_HUB', 'HUB', 'Hub',
      'Report Category', 'Irregularity/Complain Category',
      'Report', 'Report',
      'Root Caused', 'Root_Caused', 'Akar Masalah',
      'Action Taken', 'Action_Taken', 'Tindakan',
      'Status',
      'Preventive Action', 'Preventive_Action',
      'Area', 'Terminal Area Category', 'Apron Area Category', 'General Category',
      'Severity Level', 'Severity', 'Delay Code', 'Delay Duration', 'Case Classification', 'Accident / Incident',
      'Gapura KPS Remarks', 'Gapura KPS Action Taken'
    ];

    const injectedFields = ['MAPPED_HUB'];
    const activeFields = relevantFields.filter((f) => headers.includes(f) || injectedFields.includes(f));

    parts.push(
      sampleLimit < rows.length
        ? `\nSample Data (showing ${sampleLimit} of ${rows.length} rows — use the summary distributions above for totals):`
        : `\nFull Data (${rows.length} rows):`
    );
    for (let i = 0; i < sampleLimit; i++) {
      const row = rows[i];
      const compactRow = activeFields
        .map((f) => {
          const val = row[f];
          if (!val) return null;

          const truncated = val.length > 120 ? val.slice(0, 120) + '...' : val;
          return `${f}:${truncated}`;
        })
        .filter(Boolean)
        .join(' | ');
      if (compactRow) parts.push(`  [${i + 1}] ${compactRow}`);
    }
  }

  return `# OneClick Report Data\nTotal records matching filters: ${totalRows}\n${parts.join('\n')}`;
}

const SYSTEM_PROMPT = `Kamu adalah AI Data Analyst senior untuk sistem OneClick (Irregularity Reporting & Resolution System) Gapura Angkasa.

ATURAN UTAMA:
1. HANYA berikan analisis berdasarkan data yang diberikan. JANGAN mengarang data.
2. Jawab dalam Bahasa Indonesia yang profesional.
3. Gunakan format markdown: heading (##/###), bold (**), tabel, dan bullet points.
4. Sertakan angka spesifik, persentase, dan perbandingan dari data.
5. Jika diminta rekomendasi, berikan HANYA berdasarkan pola yang terlihat di data.
6. Jika data tidak cukup untuk menjawab, katakan dengan jelas.
7. VISUALISASI DATA: Jika diminta chart, atau analisis cocok divisualisasikan, WAJIB hasilkan blok kode \`\`\`json dengan format:
\`\`\`json
{
  "isChart": true,
  "type": "bar",
  "title": "Judul Chart",
  "data": [
    {"name": "Label A", "value": 45},
    {"name": "Label B", "value": 30}
  ]
}
\`\`\`
Type yang valid: "bar", "line", "pie". PASTIKAN JSON valid dan dibungkus tiga backtick \`\`\`json.

KONTEKS DOMAIN:
- Data adalah laporan irregularity, complaint, dan compliment dari cabang-cabang Gapura Angkasa di berbagai bandara.
- **SCHEMA AKTUAL**: Nama kolom yang tepat tersedia di bagian "Kolom:" pada setiap sheet dalam data konteks. Gunakan nama kolom PERSIS seperti di sana — jangan menebak nama kolom.
- Kolom tanggal (misal "Date of Event") bisa berupa angka serial Excel; sistem sudah mengkonversinya untuk filtering.
- "Report Category" berisi klasifikasi besar: **Irregularity**, **Complaint**, **Compliment**.
- Kategori spesifik tersimpan di salah satu kolom area ("Terminal Area Category", "Apron Area Category", atau "General Category") tergantung nilai kolom "Area" (Terminal Area / Apron Area / General).
- "Severity Level" berisi: **Low**, **Medium**, **High**, **Critical** (alias: TOP RISK).
- Status laporan: **Open** = belum selesai, **Closed** = selesai, **On Progress** = sedang dikerjakan.
- **MAPPED_HUB** adalah kolom yang di-inject sistem untuk memetakan branch ke hub berdasarkan sheet "Data for Vlookup".
- SUMMARY DISTRIBUTIONS di atas data = hitungan keseluruhan records. Gunakan ini untuk chart — JANGAN menghitung manual dari sampel row. SUMMARY adalah kebenaran mutlak.
- Corrective action tidak efektif = ada "Action Taken" namun Status masih "Open".
- Preventive action = usulan tindakan agar kasus serupa tidak terulang berdasarkan "Root Caused".

PANDUAN SLA (gunakan jika diminta prediksi waktu resolusi):
- **Severity High/Critical**: Target 1×24 jam.
- **Severity Medium**: Target 3×24 jam.
- **Severity Low**: Target 7×24 jam.
Kaitkan estimasi ini dengan Root Cause dan Action Taken untuk analisis yang logis.

REFERENSI LAPORAN:
- **JANGAN** sebut nomor baris/ID internal seperti "[1]" atau "Laporan #3".
- Sebutkan konteksnya langsung: *"Terdapat laporan keterlambatan kargo (Medium)..."*.

KUALITAS ANALISIS:
- Mulai dengan ringkasan eksekutif singkat (2-3 kalimat).
- Berikan insight yang actionable, bukan hanya deskripsi angka.
- Identifikasi pola, tren, atau anomali yang perlu perhatian manajemen.
- Jika ada outlier atau temuan kritis, highlight dengan **⚠️**.`;

export async function POST(request: NextRequest) {
  try {
    const payload = await requireElevatedAISession();
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rl = await checkDbRateLimit(`ai_insights:${payload.id}`, 5, 24 * 60 * 60 * 1000);
    if (!rl.success) {
      const resetAt = new Date(rl.resetAt);
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Anda telah mencapai batas 5 pertanyaan per hari. Coba lagi setelah ${resetAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}.`,
          resetAt: rl.resetAt,
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { question, filters } = body as {
      question: string;
      filters?: InsightFilters;
    };

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'Missing "question" field' }, { status: 400 });
    }

    const sheetResults = await fetchFilteredReportData(filters || {});
    const totalRows = sheetResults.reduce((sum, s) => sum + s.rows.length, 0);

    if (totalRows === 0) {
      return NextResponse.json({
        status: 'success',
        answer:
          '⚠️ **No data** yang ditemukan dengan filter yang dipilih. Coba perluas rentang tanggal atau kurangi filter.',
        highlights: ['0 data ditemukan'],
        metadata: { dataSize: 0, question, timestamp: new Date().toISOString() },
      });
    }

    const dataContext = buildDataContext(sheetResults);

    const messages: OpenRouterMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Berikut data OneClick yang sudah difilter:\n\n${dataContext}\n\nPertanyaan user: ${question}\n\nBerikan analisis mendalam berdasarkan data di atas. Sertakan angka spesifik dan rekomendasi actionable.`,
      },
    ];

    // 2048 output tokens ≈ 4-6s on fast models; 8192 was rarely used and pushed p95 past SLA.
    const aiResponse = await callOpenRouterAI(messages, INSIGHTS_MODEL, {
      maxTokens: 2048,
      timeoutMs: 25000,
    });

    const highlights: string[] = [`${totalRows} data dianalisis`];
    for (const s of sheetResults) {
      if (s.rows.length > 0) {
        highlights.push(`${s.sheetName}: ${s.rows.length} records`);
      }
    }

    return NextResponse.json({
      status: 'success',
      answer: aiResponse || 'AI tidak dapat menghasilkan analisis saat ini.',
      highlights,
      rateLimit: { remaining: rl.remaining, resetAt: rl.resetAt },
      metadata: {
        dataSize: totalRows,
        question,
        model: INSIGHTS_MODEL,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[AI Insights] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown',
      },
      { status: 500 }
    );
  }
}
