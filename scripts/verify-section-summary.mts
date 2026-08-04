/**
 * Verification harness for lib/ai/section-summary-core.ts
 *
 * 1. Feeds realistic Summary Report datasets through the pipeline with a
 *    HOSTILE mock LLM (fabricated numbers, cross-dataset comparison, generic
 *    recommendations) and asserts the grounding filters strip them.
 * 2. Optionally (--live) runs the real OpenRouter model to eyeball quality.
 *
 * Run: npx tsx scripts/verify-section-summary.mts [--live]
 */
import { config } from 'dotenv';
config({ path: '.env' });

import { buildSectionSummary, cleanDatasets, type CleanDataset } from '../lib/ai/section-summary-core';

const fixtures = cleanDatasets([
  {
    id: 'monthly',
    name: 'Kasus per Bulan',
    unit: 'kasus',
    kind: 'timeseries',
    description: 'Jumlah laporan per bulan tahun berjalan; breakdown = jumlah per kategori kasus pada bulan tersebut.',
    rows: [
      { label: 'Januari', value: 38, breakdown: { Irregularity: 20, Complaint: 12, Compliment: 6 } },
      { label: 'Februari', value: 41, breakdown: { Irregularity: 22, Complaint: 13, Compliment: 6 } },
      { label: 'Maret', value: 35, breakdown: { Irregularity: 18, Complaint: 11, Compliment: 6 } },
      { label: 'April', value: 29, breakdown: { Irregularity: 15, Complaint: 9, Compliment: 5 } },
      { label: 'Mei', value: 33, breakdown: { Irregularity: 17, Complaint: 10, Compliment: 6 } },
      { label: 'Juni', value: 44, breakdown: { Irregularity: 24, Complaint: 14, Compliment: 6 } },
    ],
  },
  {
    id: 'stations',
    name: 'Stasiun & Jenis Kasus',
    unit: 'kasus',
    kind: 'ranking',
    description: 'Jumlah laporan per kombinasi stasiun (kode bandara) dan jenis kasus.',
    rows: [
      { label: 'CGK — Complaint', value: 33 },
      { label: 'DPS — Irregularity', value: 21 },
      { label: 'SUB — Complaint', value: 14 },
      { label: 'KNO — Occurrence', value: 9 },
    ],
  },
  {
    id: 'yoy',
    name: 'Tahun Ini vs Tahun Lalu',
    unit: 'kasus',
    kind: 'comparison',
    description: 'value = jumlah tahun berjalan per kategori; delta = perubahan % dibanding tahun sebelumnya.',
    rows: [
      { label: 'Irregularity', value: 80, delta: 25, note: 'tahun lalu 64' },
      { label: 'Complaint', value: 62, delta: -11, note: 'tahun lalu 70' },
      { label: 'Total', value: 220, delta: 8, note: 'tahun lalu 204' },
    ],
  },
]) as CleanDataset[];

function assert(cond: boolean, label: string) {
  console.log(`${cond ? '✅' : '❌'} ${label}`);
  if (!cond) process.exitCode = 1;
}

// ---------------------------------------------------------------------------
// 1. Hostile mock LLM — everything here should be filtered out or replaced
// ---------------------------------------------------------------------------
const hostile = JSON.stringify({
  executiveSummary:
    'Laporan mencakup 999 kasus dengan 37 label unik. Juni memiliki 44 kasus.',
  datasetNarratives: {
    monthly: 'Bulan Juni tertinggi dengan 44 kasus. Angka rahasia 1110 menunjukkan lonjakan.',
    stations: 'CGK mencatat 33 komplain, jauh di atas rata-rata 87 kasus.',
    yoy: 'Irregularity naik 25% menjadi 80 kasus.',
  },
  keyPoints: [
    'Juni adalah bulan tertinggi dengan 44 kasus.',
    'Total keseluruhan mencapai 5.000 kasus.',
    'CGK — Complaint tertinggi dengan 33 kasus.',
  ],
  recommendations: [
    { title: 'Perhatikan CGK', detail: 'Station CGK perlu memperhatikan kasus complaint.', priority: 'tinggi' },
    { title: 'Analisis lanjut', detail: 'Perlu dilakukan analisis lebih lanjut untuk mengidentifikasi penyebab.', priority: 'sedang' },
    {
      title: 'Audit SOP komplain CGK',
      detail: 'CGK mencatat 33 komplain; jadwalkan audit SOP layanan penumpang dan briefing tim shift bulan depan.',
      priority: 'tinggi',
    },
  ],
  predictiveSummary: 'Diperkirakan 750 kasus bulan depan.',
});

const mocked = await buildSectionSummary('Summary Report', 'Summary Report', fixtures, async () => hostile);

console.log('\n— Hostile-mock results —');
assert(!mocked.executiveSummary.includes('999'), 'fabricated total (999) stripped from executive summary');
assert(mocked.executiveSummary.includes('44'), 'grounded sentence (Juni 44) kept in executive summary');
const monthlyNarr = mocked.datasets.find((d) => d.id === 'monthly')?.narrative ?? '';
assert(!monthlyNarr.includes('1110'), 'fabricated 1110 stripped from monthly narrative');
const stationNarr = mocked.datasets.find((d) => d.id === 'stations')?.narrative ?? '';
assert(!stationNarr.includes('87'), 'fabricated station average (87) stripped');
assert(!mocked.keyPoints.some((k) => k.includes('5.000') || k.includes('5000')), 'fabricated key point dropped');
assert(mocked.keyPoints.some((k) => k.includes('33')), 'grounded key point kept');
assert(!mocked.recommendations.some((r) => /perlu memperhatikan|analisis lebih lanjut/i.test(r.detail)), 'generic recommendations dropped');
assert(mocked.recommendations.some((r) => r.title.includes('Audit SOP')), 'concrete recommendation kept');
assert(!mocked.predictiveSummary.includes('750'), 'fabricated forecast number stripped');

// Deterministic layer sanity
const monthly = mocked.datasets.find((d) => d.id === 'monthly')!;
assert(monthly.total === 220, `monthly total computed = ${monthly.total} (expect 220)`);
assert(monthly.headline.includes('Juni') && monthly.headline.includes('44'), `timeseries headline: "${monthly.headline}"`);
const stations = mocked.datasets.find((d) => d.id === 'stations')!;
assert(stations.rows[0].label === 'CGK — Complaint' && stations.rows[0].sharePct === 43, `ranking sorted w/ share: ${stations.rows[0].label} ${stations.rows[0].sharePct}%`);

// ---------------------------------------------------------------------------
// 2. Failing LLM — deterministic fallbacks must fill everything
// ---------------------------------------------------------------------------
const fallback = await buildSectionSummary('Summary Report', 'Summary Report', fixtures, async () => {
  throw new Error('LLM down');
});
console.log('\n— LLM-down results —');
assert(Boolean(fallback.executiveSummary), 'fallback executive summary present');
assert(fallback.keyPoints.length >= 2, 'fallback key points present');
assert(fallback.recommendations.length >= 1, 'fallback recommendations present');
assert(fallback.recommendations.every((r) => /\d/.test(r.detail)), 'fallback recommendations cite numbers');

// ---------------------------------------------------------------------------
// 3. Optional live OpenRouter run
// ---------------------------------------------------------------------------
if (process.argv.includes('--live')) {
  const model = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct';
  const live = await buildSectionSummary('Summary Report', 'Summary Report', fixtures, async (messages) => {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, temperature: 0.1, max_completion_tokens: 4096 }),
    });
    if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return json.choices?.[0]?.message?.content || '';
  });
  console.log('\n— LIVE OpenRouter output —');
  console.log(JSON.stringify(live, null, 2));
}

console.log('\nDone.');
