import { NextRequest, NextResponse } from 'next/server';
import { requireAISession, unauthorizedResponse, aiUnavailableResponse } from '@/lib/ai-route-helpers';
import { callOpenRouterAI } from '@/lib/ai/openrouter';
import { reportsService } from '@/lib/services/reports-service';
import { canViewReport } from '@/lib/report-access';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Token-lean system prompt: fixed role, strict JSON contract, no chit-chat.
const SYSTEM = `Anda analis senior ground handling bandara (Gapura Angkasa). Beri rekomendasi singkat, konkret, actionable dalam Bahasa Indonesia. Balas HANYA JSON valid dengan tepat kunci ini:
{"escalation":"...","preventive":"...","handling":"..."}
- escalation: divisi/pihak yang harus dieskalasi + alasan singkat (1-2 kalimat).
- preventive: langkah pencegahan agar tidak terulang (1-2 kalimat).
- handling: langkah penanganan segera untuk kasus ini (1-2 kalimat).
Tanpa markdown, tanpa teks di luar JSON.`;

const clip = (v: unknown, max = 400) => String(v ?? '').trim().slice(0, max);

export async function POST(req: NextRequest) {
  try {
    const session = await requireAISession();
    if (!session) return unauthorizedResponse();

    const { reportId } = await req.json().catch(() => ({ reportId: '' }));
    if (!reportId) return NextResponse.json({ error: 'reportId required' }, { status: 400 });

    const r = await reportsService.getReportById(String(reportId));
    if (!r) return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    if (!canViewReport(session, r)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Compact context — only fields that steer a recommendation.
    const ctx = {
      jenis: r.category_case_joumpa ? 'JOUMPA' : 'Ground Handling Irregularity',
      kategori: clip(r.category_case_joumpa || r.terminal_area_category || r.apron_area_category || r.general_category || r.category_case_gse || r.main_category, 120),
      area: clip(r.area, 60),
      maskapai: clip(r.airlines || r.airline, 60),
      station: clip(r.station_code || r.branch, 60),
      severity: clip(r.severity, 30),
      status: clip(r.status, 30),
      deskripsi: clip(r.description || r.report),
      root_cause: clip(r.root_cause || r.root_caused),
      action_taken: clip(r.action_taken),
    };

    const raw = await callOpenRouterAI(
      [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: JSON.stringify(ctx) },
      ],
      undefined,
      { maxTokens: 500, temperature: 0.2, responseFormat: 'json_object', timeoutMs: 20000 },
    );

    let parsed: { escalation?: string; preventive?: string; handling?: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: 'AI response tidak valid' }, { status: 502 });
    }

    return NextResponse.json({
      escalation: clip(parsed.escalation, 600),
      preventive: clip(parsed.preventive, 600),
      handling: clip(parsed.handling, 600),
    });
  } catch (error) {
    return aiUnavailableResponse(error);
  }
}
