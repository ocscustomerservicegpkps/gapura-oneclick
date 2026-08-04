'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, TrendingUp, TrendingDown, Sparkles, RefreshCw,
  CheckCircle2, AlertCircle, Activity, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Report } from '@/types';
import {
  CaseInsightResponse,
  type Severity as SeverityT,
  type ForecastSeries,
} from '@/lib/schemas/insight';

const SEVERITY_STYLE: Record<SeverityT, { bg: string; text: string; ring: string }> = {
  'TOP RISK':  { bg: 'bg-red-700',    text: 'text-white',      ring: 'ring-red-900' },
  'HIGH RISK': { bg: 'bg-red-500',    text: 'text-white',      ring: 'ring-red-600' },
  MEDIUM:      { bg: 'bg-amber-400',  text: 'text-amber-950',  ring: 'ring-amber-500' },
  LOW:         { bg: 'bg-emerald-500',text: 'text-white',      ring: 'ring-emerald-600' },
};

const SIGNAL_STYLE: Record<string, { bg: string; text: string; icon: typeof CheckCircle2; label: string }> = {
  ok:          { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', icon: CheckCircle2, label: 'Aman' },
  watch:       { bg: 'bg-amber-50 border-amber-200',     text: 'text-amber-700',   icon: Activity,     label: 'Pantau' },
  risk:        { bg: 'bg-red-50 border-red-200',         text: 'text-red-700',     icon: AlertCircle,  label: 'Risiko' },
  opportunity: { bg: 'bg-blue-50 border-blue-200',       text: 'text-blue-700',    icon: TrendingUp,   label: 'Peluang' },
};

function Unavailable({ reason }: { reason: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 text-slate-500 text-xs">
      <Info className="w-3.5 h-3.5" /> Data tidak cukup
      {reason && <span className="text-slate-400">· {reason}</span>}
    </div>
  );
}

function HeadlineBlock({ data }: { data: CaseInsightResponse }) {
  const sig = SIGNAL_STYLE[data.headline.signal] ?? SIGNAL_STYLE.ok;
  const Icon = sig.icon;
  return (
    <div className={cn('rounded-2xl border p-4 md:p-5', sig.bg)}>
      <div className="flex items-start gap-3">
        <div className={cn('shrink-0 w-9 h-9 rounded-full bg-white/70 flex items-center justify-center', sig.text)}>
          <Icon className="w-5 h-5" strokeWidth={2.2} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-[11px] font-bold uppercase tracking-wider', sig.text)}>
              {sig.label}
            </span>
            <span className="text-[11px] text-slate-500">
              Kepercayaan {Math.round(data.headline.confidence * 100)}%
            </span>
          </div>
          <p className="mt-1 text-[15px] md:text-base font-semibold text-slate-900 leading-snug">
            {data.headline.sentence}
          </p>
        </div>
      </div>
    </div>
  );
}

function SeverityBadge({ sev, conf }: { sev: SeverityT; conf: number | null | undefined }) {
  const s = SEVERITY_STYLE[sev] ?? SEVERITY_STYLE.MEDIUM;
  return (
    <div className={cn('inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ring-1', s.bg, s.text, s.ring)}>
      <AlertTriangle className="w-4 h-4" />
      <span className="text-sm font-bold tracking-wide">{sev}</span>
      {typeof conf === 'number' && (
        <span className="text-xs opacity-80">{Math.round(conf * 100)}%</span>
      )}
    </div>
  );
}

function ForecastCard({ series }: { series: ForecastSeries }) {
  const last = series.points[series.points.length - 1];
  const first = series.points[0];
  if (!first || !last) return <Unavailable reason="series kosong" />;
  const trend = last.yhat - first.yhat;
  const TrendIcon = trend >= 0 ? TrendingUp : TrendingDown;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Proyeksi</span>
        <span className="text-xs text-slate-400">
          n={series.history_points} · cakupan {Math.round(series.coverage * 100)}%
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-slate-900 tabular-nums">
          {last.yhat.toFixed(1)}
        </span>
        <TrendIcon className={cn('w-4 h-4', trend >= 0 ? 'text-blue-600' : 'text-emerald-600')} />
        <span className="text-xs text-slate-500">
          interval {last.yhat_lower.toFixed(1)} – {last.yhat_upper.toFixed(1)}
        </span>
      </div>
      <div className="mt-2 text-[11px] text-slate-400">
        Periode {first.period} → {last.period}
      </div>
    </div>
  );
}

interface Props {
  report: Report;
  className?: string;
}

export function AIInsightCard({ report, className }: Props) {
  const [data, setData] = useState<CaseInsightResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const payload = useMemo(() => ({
    report_text: report.report || report.description || report.title || '',
    issue_type: report.main_category || report.irregularity_complain_category || report.category || null,
    area: report.area || null,
    airline: report.airlines || report.airline || null,
    hub: report.hub || null,
    severity_observed: report.severity_level || report.severity || null,
    // Depend on the primitive fields actually read above, not the `report`
    // object identity — a caller re-creating that object every render (a
    // very common pattern) would otherwise retrigger the insight fetch on
    // every render instead of only on real content changes.
  }), [
    report.report,
    report.description,
    report.title,
    report.main_category,
    report.irregularity_complain_category,
    report.category,
    report.area,
    report.airlines,
    report.airline,
    report.hub,
    report.severity_level,
    report.severity,
  ]);

  // A newer request (new report, or manual "Muat ulang") can resolve before
  // an older in-flight one. Without a sequence guard, the older response can
  // land last and overwrite state with insight data for the wrong report.
  const requestSeqRef = useRef(0);

  const fetchInsight = useCallback(async () => {
    const seq = ++requestSeqRef.current;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const r = await fetch('/api/ai/insight/case', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(28_000),
      });
      const j = await r.json();
      if (seq !== requestSeqRef.current) return;
      if (!r.ok) {
        setError(j?.error || `HTTP ${r.status}`);
        return;
      }
      const parsed = CaseInsightResponse.safeParse(j);
      if (!parsed.success) {
        setError('Format tanggapan tidak valid');
        return;
      }
      setData(parsed.data);
    } catch (e) {
      if (seq !== requestSeqRef.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load insight');
    } finally {
      if (seq === requestSeqRef.current) setLoading(false);
    }
  }, [payload]);

  useEffect(() => {
    fetchInsight();
  }, [fetchInsight]);

  return (
    <div className={cn('space-y-4', className)}>
      {}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          <h3 className="text-sm font-bold text-slate-800">Gapura AI · Insight Eksekutif</h3>
        </div>
        <button
          onClick={fetchInsight}
          disabled={loading}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold',
            'border border-slate-200 hover:border-slate-300 text-slate-700',
            loading && 'opacity-50 cursor-not-allowed'
          )}
        >
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          {loading ? 'Loading…' : 'Muat ulang'}
        </button>
      </div>

      {loading && !data && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 animate-pulse">
          <div className="h-3 w-32 bg-slate-200 rounded mb-2"></div>
          <div className="h-5 w-3/4 bg-slate-200 rounded"></div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {data && (
        <>
          <HeadlineBlock data={data} />

          <div className="flex items-center gap-3">
            {data.severity_predicted ? (
              <SeverityBadge
                sev={data.severity_predicted as SeverityT}
                conf={data.severity_confidence}
              />
            ) : (
              <Unavailable reason="severity belum dapat diprediksi" />
            )}
          </div>

          {data.forecast
            ? <ForecastCard series={data.forecast} />
            : (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Proyeksi</p>
                <Unavailable reason="seri tidak memenuhi minimum data" />
              </div>
            )}

          {}
          <div className="text-[11px] text-slate-400 flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100">
            <span>Berdasarkan {data.records_basis} data terprofil</span>
            <span>·</span>
            <span>per {new Date(data.as_of).toLocaleString('id-ID')}</span>
            {data.warnings.length > 0 && (
              <span className="text-amber-600">· {data.warnings.length} peringatan</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
