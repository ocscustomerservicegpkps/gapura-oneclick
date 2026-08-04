'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import type { Report } from '@/types';
import { useDrilldown } from '@/components/chart-detail/useDrilldown';
import { ChartAiAnalysisButton } from '@/components/dashboard/ai/ChartAiAnalysisButton';
import { YearCard } from '@/components/dashboard/year-context';
import {
  resolveCaseClassification,
  resolveReportAirline,
  resolveReportBranch,
  resolveReportCategory,
} from '@/lib/report-normalization';

interface ReportsStatusTabProps {
  reports: Report[];
}

function val(v: unknown): string {
  return String(v || '').trim();
}

function getStatus(r: Report): 'OPEN' | 'CLOSED' {
  return val(r.status).toUpperCase() === 'CLOSED' ? 'CLOSED' : 'OPEN';
}

function getCategory(r: Report): string {
  return resolveReportCategory(r) || 'Irregularity';
}

function getArea(r: Report): string {
  return val(r.area) || val(r.specific_location) || 'Unknown';
}

function getBranch(r: Report): string {
  return resolveReportBranch(r) || val(r.branch) || val(r.station_code) || 'Unknown';
}

function getAirline(r: Report): string {
  return resolveReportAirline(r) || val(r.airlines) || 'Unknown';
}

function getSeverity(r: Report): string {
  const s = val(r.risk_level || r.severity || r.severity_level).toUpperCase();
  if (s.includes('TOP')) return 'TOP RISK';
  if (s.includes('HIGH')) return 'HIGH';
  if (s.includes('MEDIUM') || s.includes('MED')) return 'MEDIUM';
  if (s.includes('LOW')) return 'LOW';
  return 'MEDIUM';
}

function getCaseClass(r: Report): string {
  return val(resolveCaseClassification(r));
}

function getReportDate(r: Report): Date | null {
  const raw = r.date_of_event || r.created_at || r.timestamp;
  if (!raw) return null;
  const d = new Date(String(raw));
  return isNaN(d.getTime()) ? null : d;
}

function fmtDate(r: Report): string {
  const d = getReportDate(r);
  if (!d) return '—';
  return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
}

type StatusRow = { label: string; open: number; closed: number; total: number };

function buildStatusRows(reports: Report[], key: (r: Report) => string): StatusRow[] {
  const map = new Map<string, StatusRow>();
  for (const r of reports) {
    const label = key(r);
    const status = getStatus(r);
    if (!map.has(label)) map.set(label, { label, open: 0, closed: 0, total: 0 });
    const row = map.get(label)!;
    if (status === 'OPEN') row.open++;
    else row.closed++;
    row.total++;
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

const PANEL_FRAME = 'sr-table-card flex min-h-0 min-w-0 flex-col';

const C_OPEN = 'var(--sr-gold-strong)';
const C_CLOSED = 'var(--sr-accent)';

function Panel({
  title,
  subtitle,
  className = '',
  bodyClassName = '',
  aiContext,
  headerExtra,
  children,
}: {
  title: string;
  subtitle?: string;
  className?: string;
  bodyClassName?: string;
  aiContext?: object;
  headerExtra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={`${PANEL_FRAME} ${className}`}>
      <div className="sr-table-caption !grid !grid-cols-1 !items-start gap-2">
        <div className="sr-table-caption-title min-w-0 !flex-nowrap !items-start">
          <span className="mt-[5px] h-[19px] w-1 shrink-0 bg-[color:var(--sr-gold)]" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-bold leading-snug tracking-[-0.02em] text-[color:var(--sr-text)]">{title}</h3>
            {subtitle ? <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--sr-text-3)]">{subtitle}</p> : null}
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          {headerExtra}
          {aiContext ? <ChartAiAnalysisButton context={aiContext as Parameters<typeof ChartAiAnalysisButton>[0]['context']} /> : null}
        </div>
      </div>
      <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = status === 'CLOSED'
    ? 'bg-[color:var(--sr-accent-soft)] text-[color:var(--sr-accent-dark)]'
    : 'bg-[color:var(--sr-gold-soft)] text-[color:var(--sr-gold-strong)]';
  return (
    <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] ${cls}`}>
      {status}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    'TOP RISK': 'bg-[color:var(--sr-neg-soft)] text-[color:var(--sr-neg-strong)]',
    'HIGH': 'bg-[color:var(--sr-gold-soft)] text-[color:var(--sr-gold-strong)]',
    'MEDIUM': 'bg-[color:var(--sr-sunken)] text-[color:var(--sr-text-2)]',
    'LOW': 'bg-[color:var(--sr-accent-soft)] text-[color:var(--sr-accent-dark)]',
  };
  return (
    <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] ${styles[severity] || styles['MEDIUM']}`}>
      {severity}
    </span>
  );
}

function StatusDonut({
  open,
  closed,
  onOpen,
  onClosed,
}: {
  open: number;
  closed: number;
  onOpen: () => void;
  onClosed: () => void;
}) {
  const total = open + closed;
  const data = [
    { name: 'Open', value: open, color: C_OPEN, action: onOpen },
    { name: 'Closed', value: closed, color: C_CLOSED, action: onClosed },
  ].filter((d) => d.value > 0);

  return (
    <div className="flex items-center gap-6">
      <div className="relative h-32 w-32 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              isAnimationActive={false}
              data={data}
              cx="50%" cy="50%"
              innerRadius="52%" outerRadius="80%"
              dataKey="value"
              stroke="none"
              onClick={(entry: unknown) => (entry as { action?: () => void }).action?.()}
              style={{ cursor: 'pointer' }}
            >
              {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Pie>
            <Tooltip formatter={(v: number) => [`${v} (${total > 0 ? ((v / total) * 100).toFixed(0) : 0}%)`, '']} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-[20px] font-black leading-none text-[color:var(--sr-text)]">{total}</span>
          <span className="text-[8px] font-bold uppercase tracking-[0.1em] text-[color:var(--sr-text-3)]">total</span>
        </div>
      </div>
      <div className="space-y-2">
        {data.map((entry) => (
          <button key={entry.name} type="button" onClick={entry.action} className="flex items-center gap-2 transition-opacity hover:opacity-70">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: entry.color }} />
            <span className="text-[12px] font-bold text-[color:var(--sr-text)]">{entry.name}</span>
            <span className="font-mono text-[12px] font-black tabular-nums text-[color:var(--sr-text)]">{entry.value}</span>
            <span className="text-[10px] text-[color:var(--sr-text-3)]">({total > 0 ? ((entry.value / total) * 100).toFixed(0) : 0}%)</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function wrapAirlineLabel(label: string, maxCharsPerLine = 12): string[] {
  if (label.length <= maxCharsPerLine) return [label];
  const words = label.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxCharsPerLine) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 2);
}

function WrappedYAxisTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  const lines = wrapAirlineLabel(payload?.value ?? '');
  return (
    <g transform={`translate(${x},${y})`}>
      {lines.map((line, i) => (
        <text key={i} x={0} y={0} dy={(i - (lines.length - 1) / 2) * 12 + 4} textAnchor="end" fontSize={11} fontWeight={600} fill="var(--sr-text)">
          {line}
        </text>
      ))}
    </g>
  );
}

function StackedHBar({
  rows,
  maxRows = 12,
  onOpenClick,
  onClosedClick,
}: {
  rows: StatusRow[];
  maxRows?: number;
  onOpenClick: (label: string) => void;
  onClosedClick: (label: string) => void;
}) {
  const capped = rows.slice(0, maxRows);
  if (capped.length === 0) {
    return <div className="flex h-[280px] items-center justify-center text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--sr-text-3)]">No data</div>;
  }

  const handleClick = (data: unknown, _index: number, isOpen: boolean) => {
    const d = data as { payload: { label: string } };
    if (isOpen) onOpenClick(d.payload.label);
    else onClosedClick(d.payload.label);
  };

  return (
    <div style={{ height: Math.max(228, capped.length * 38 + 68) }} className="px-2 py-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart layout="vertical" data={capped} margin={{ top: 4, right: 40, bottom: 0, left: 0 }} barCategoryGap="25%">
          <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--sr-text-3)' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="label"
            width={130}
            tick={<WrappedYAxisTick />}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'rgba(0,0,0,0.04)' }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const open = (payload.find((p) => p.dataKey === 'open')?.value as number) ?? 0;
              const closed = (payload.find((p) => p.dataKey === 'closed')?.value as number) ?? 0;
              return (
                <div className="rounded-lg border border-[color:var(--sr-border)] bg-white px-3 py-2 shadow-lg">
                  <p className="mb-1 text-[11px] font-bold text-[color:var(--sr-text)]">{label}</p>
                  <p className="font-mono text-[12px]" style={{ color: C_OPEN }}>Open: {open}</p>
                  <p className="font-mono text-[12px]" style={{ color: C_CLOSED }}>Closed: {closed}</p>
                  <p className="font-mono text-[12px] font-bold text-[color:var(--sr-text)]">Total: {open + closed}</p>
                </div>
              );
            }}
          />
          <Legend
            verticalAlign="top"
            height={28}
            iconType="square"
            iconSize={10}
            formatter={(value: string) => value === 'open' ? 'Open' : 'Closed'}
            wrapperStyle={{ fontSize: 11, fontWeight: 600, paddingBottom: 4 }}
          />
          <Bar dataKey="open" stackId="s" fill={C_OPEN} radius={0} style={{ cursor: 'pointer' }}
            onClick={(d, i) => handleClick(d, i, true)} />
          <Bar dataKey="closed" stackId="s" fill={C_CLOSED} radius={[0, 3, 3, 0]} style={{ cursor: 'pointer' }}
            onClick={(d, i) => handleClick(d, i, false)} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type RecordRow = {
  id: string;
  date: string;
  branch: string;
  airline: string;
  category: string;
  area: string;
  caseClass: string;
  severity: string;
  status: string;
  report: string;
  flightNumber: string;
  raw: Report;
};

function buildRecordRow(r: Report, index: number): RecordRow {
  return {
    id: r.id || r.original_id || (r.row_number != null ? String(r.row_number) : `row-${index}`),
    date: fmtDate(r),
    branch: getBranch(r),
    airline: getAirline(r),
    category: getCategory(r),
    area: getArea(r),
    caseClass: getCaseClass(r) || '—',
    severity: getSeverity(r),
    status: getStatus(r),
    report: val(r.report || r.description) || '—',
    flightNumber: val(r.flight_number) || '—',
    raw: r,
  };
}

const RECORDS_TABLE_PAGE_SIZE = 100;

function RecordsTable({ rows, title, onRowClick, resetKey }: { rows: RecordRow[]; title: string; onRowClick: (row: RecordRow) => void; resetKey: string | number }) {
  const [visibleCount, setVisibleCount] = useState(RECORDS_TABLE_PAGE_SIZE);
  // `rows` is rebuilt inline on every render of the YearCard render-prop
  // (not memoized), so it gets a new array reference even when the data
  // hasn't changed — comparing by reference would reset pagination on
  // nearly every render. `resetKey` (the selected year) only changes when
  // the underlying dataset actually does.
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setVisibleCount(RECORDS_TABLE_PAGE_SIZE);
  }

  const visibleRows = useMemo(() => rows.slice(0, visibleCount), [rows, visibleCount]);

  return (
    <Panel title={title} subtitle={`${rows.length} records`}>
      <div className="overflow-auto touch-scroll" style={{ height: '36rem' }}>
        <table className="sr-table w-full text-[12px]" style={{ minWidth: 940, tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ width: '10%' }} className="!text-left">Date</th>
              <th style={{ width: '7%' }} className="!text-left">Station</th>
              <th style={{ width: '13%' }} className="!text-left">Airlines</th>
              <th style={{ width: '7%' }} className="!text-left">Flight</th>
              <th style={{ width: '11%' }} className="!text-left">Category</th>
              <th style={{ width: '11%' }} className="!text-left">Area</th>
              <th style={{ width: '19%' }} className="!text-left">Case Classification</th>
              <th style={{ width: '9%' }} className="sr-center">Severity</th>
              <th style={{ width: '8%' }} className="sr-center">Status</th>
              <th style={{ width: '7%' }} className="sr-center">Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={10} className="!py-10 text-center text-[color:var(--sr-text-3)]">No data</td></tr>
            ) : visibleRows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onRowClick(row)}
                className="cursor-pointer transition-colors hover:!bg-[color:var(--sr-accent-soft)]"
                title="Click to view full details"
              >
                <td className="font-mono tabular-nums" style={{ padding: '8px 10px', fontSize: 12, whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'break-word' }}>{row.date}</td>
                <td className="font-bold" style={{ padding: '8px 10px', fontSize: 12 }}>{row.branch}</td>
                <td style={{ padding: '8px 10px', fontSize: 12, whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'break-word' }}>{row.airline}</td>
                <td className="font-mono font-semibold tabular-nums" style={{ padding: '8px 10px', fontSize: 12 }}>{row.flightNumber}</td>
                <td style={{ padding: '8px 10px', fontSize: 12, whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'break-word' }}>{row.category}</td>
                <td style={{ padding: '8px 10px', fontSize: 12, whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'break-word' }}>{row.area}</td>
                <td style={{ padding: '8px 10px', fontSize: 12, whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'break-word' }}>
                  <span className="block leading-snug" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {row.caseClass}
                  </span>
                </td>
                <td className="sr-center" style={{ padding: '8px 10px', textAlign: 'center' }}><SeverityBadge severity={row.severity} /></td>
                <td className="sr-center" style={{ padding: '8px 10px', textAlign: 'center' }}><StatusBadge status={row.status} /></td>
                <td className="sr-center" style={{ padding: '8px 10px', textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onRowClick(row); }}
                    className="inline-flex h-6 items-center gap-1 rounded-md bg-[color:var(--sr-accent)] px-2 text-[10px] font-bold uppercase tracking-[0.04em] text-white hover:bg-[color:var(--sr-accent-strong)]"
                  >
                    Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > visibleCount && (
        <div className="flex justify-center border-t border-[color:var(--sr-border)] py-3">
          <button
            type="button"
            onClick={() => setVisibleCount((c) => c + RECORDS_TABLE_PAGE_SIZE)}
            className="rounded-md border border-[color:var(--sr-border)] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-[color:var(--sr-text-2)] transition-colors hover:bg-[color:var(--sr-sunken)]"
          >
            Show more ({rows.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </Panel>
  );
}

export function ReportsStatusTab({ reports }: ReportsStatusTabProps) {
  const { openDrilldown, DrilldownRenderer } = useDrilldown();

  return (
    <div className="sr-scope space-y-6 bg-[color:var(--sr-canvas)] px-4 py-6 pb-10 text-[color:var(--sr-text)] sm:px-6 lg:px-8">
      {}
      <div className="sr-card relative flex flex-col gap-4 overflow-hidden px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="absolute inset-x-0 top-0 h-[5px] bg-[color:var(--sr-accent)]" aria-hidden="true" />
        <div className="flex min-w-0 items-center gap-4">
          <span className="inline-block h-12 w-[6px] shrink-0 rounded bg-[color:var(--sr-accent)] shadow-[5px_0_0_var(--sr-gold)]" aria-hidden="true" />
          <div>
            <h1 className="font-display text-[clamp(26px,2.4vw,34px)] font-bold leading-tight tracking-[-0.02em] text-[color:var(--sr-text)]">
              Reports Status Details
            </h1>
            <p className="mt-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sr-text-3)]">
              {reports.length} total reports · open &amp; closed analytics
            </p>
          </div>
        </div>
      </div>

      <YearCard reports={reports}>{({ filtered, toggle, year }) => {
        const open = filtered.filter((r) => getStatus(r) === 'OPEN');
        const closed = filtered.filter((r) => getStatus(r) === 'CLOSED');
        const openCount = open.length;
        const closedCount = closed.length;
        const total = filtered.length;

        const categoryRows = buildStatusRows(filtered, getCategory);
        const areaRows = buildStatusRows(filtered, getArea);
        const branchRows = buildStatusRows(filtered, getBranch);
        const order = ['TOP RISK', 'HIGH', 'MEDIUM', 'LOW'];
        const severityRows = buildStatusRows(filtered, getSeverity).sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
        const airlineRows = buildStatusRows(filtered, getAirline);

        const byDateDesc = (a: RecordRow, b: RecordRow) =>
          (getReportDate(b.raw)?.getTime() ?? 0) - (getReportDate(a.raw)?.getTime() ?? 0);
        const openRecords = open.map(buildRecordRow).sort(byDateDesc);
        const closedRecords = closed.map(buildRecordRow).sort(byDateDesc);

        const resolutionRate = total > 0 ? ((closedCount / total) * 100).toFixed(1) : '0.0';
        const topOpenCategory = buildStatusRows(open, getCategory)[0]?.label || '—';

        return (
          <>
            {}
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
              {[
                { label: 'Total Reports', value: total, color: 'var(--sr-text)', records: filtered },
                { label: 'Open', value: openCount, color: C_OPEN, records: open },
                { label: 'Closed', value: closedCount, color: C_CLOSED, records: closed },
                { label: 'Resolution Rate', value: `${resolutionRate}%`, color: C_CLOSED, records: closed },
                { label: 'Top Open Category', value: topOpenCategory, color: 'var(--sr-neg-strong)', records: open.filter((r) => getCategory(r) === topOpenCategory) },
              ].map((kpi) => (
                <button key={kpi.label} type="button" onClick={() => openDrilldown(kpi.records, kpi.label)} className="sr-table-card flex min-h-[88px] flex-col justify-between gap-2 p-4 text-left transition-opacity hover:opacity-80 active:opacity-60">
                  <div className="flex items-start gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--sr-text-3)]">
                    <span className="mt-0.5 h-3 w-1 shrink-0 rounded-sm bg-[color:var(--sr-gold)]" aria-hidden="true" />
                    {kpi.label}
                  </div>
                  <span className="font-mono text-[22px] font-bold leading-none tabular-nums tracking-[-0.02em]" style={{ color: kpi.color }}>{kpi.value}</span>
                </button>
              ))}
            </div>

            {}
            <section>
              <div className="sr-section-h">
                <span className="sr-section-rule" aria-hidden="true" />
                <h2>Status Overview {year}</h2>
                <div className="ml-auto">{toggle}</div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Panel title="Status Distribution" subtitle={`${year} · all categories`} className="h-[14rem]" bodyClassName="flex items-center px-6 py-4">
                  <StatusDonut
                    open={openCount}
                    closed={closedCount}
                    onOpen={() => openDrilldown(open, `Open Reports ${year}`)}
                    onClosed={() => openDrilldown(closed, `Closed Reports ${year}`)}
                  />
                </Panel>
                <Panel title="Resolution by Category" className="h-[14rem]" bodyClassName="overflow-auto">
                  <table className="sr-table w-full text-[12px]">
                    <thead>
                      <tr>
                        <th className="!text-left">Category</th>
                        <th className="sr-center">Open</th>
                        <th className="sr-center">Closed</th>
                        <th className="sr-num">Total</th>
                        <th className="sr-center">Rate %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoryRows.map((row) => (
                        <tr key={row.label}>
                          <td className="font-semibold">
                            <button type="button" onClick={() => openDrilldown(filtered.filter((r) => getCategory(r) === row.label), `Category: ${row.label}`)} className="hover:underline text-left">{row.label}</button>
                          </td>
                          <td className="sr-center font-mono tabular-nums" style={{ color: C_OPEN }}>
                            <button type="button" onClick={() => openDrilldown(open.filter((r) => getCategory(r) === row.label), `Open · ${row.label}`)} className="hover:underline">{row.open || '—'}</button>
                          </td>
                          <td className="sr-center font-mono tabular-nums" style={{ color: C_CLOSED }}>
                            <button type="button" onClick={() => openDrilldown(closed.filter((r) => getCategory(r) === row.label), `Closed · ${row.label}`)} className="hover:underline">{row.closed || '—'}</button>
                          </td>
                          <td className="sr-num font-bold">
                            <button type="button" onClick={() => openDrilldown(filtered.filter((r) => getCategory(r) === row.label), `Category: ${row.label}`)} className="hover:underline">{row.total}</button>
                          </td>
                          <td className="sr-center font-mono tabular-nums">{row.total > 0 ? ((row.closed / row.total) * 100).toFixed(0) : 0}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Panel>
              </div>
            </section>

            {}
            <section>
              <div className="sr-section-h">
                <span className="sr-section-rule" aria-hidden="true" />
                <h2>Operational Area &amp; Station Distribution</h2>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Panel
                  title="By Operational Area"
                  subtitle="Open (gold) · Closed (green) — click bar segment to drill in"
                  className="h-[22rem]"
                  bodyClassName="overflow-y-auto"
                  aiContext={{ section: 'Reports Status', chartTitle: 'By Area', chartType: 'area_status_breakdown', chartData: areaRows }}
                >
                  <StackedHBar
                    rows={areaRows}
                    onOpenClick={(label) => openDrilldown(open.filter((r) => getArea(r) === label), `Open · Area: ${label}`)}
                    onClosedClick={(label) => openDrilldown(closed.filter((r) => getArea(r) === label), `Closed · Area: ${label}`)}
                  />
                </Panel>
                <Panel
                  title="By Station"
                  subtitle="Open (gold) · Closed (green) — click bar segment to drill in"
                  className="h-[22rem]"
                  bodyClassName="overflow-y-auto"
                  aiContext={{ section: 'Reports Status', chartTitle: 'By Station', chartType: 'branch_status_breakdown', chartData: branchRows }}
                >
                  <StackedHBar
                    rows={branchRows}
                    onOpenClick={(label) => openDrilldown(open.filter((r) => getBranch(r) === label), `Open · Station: ${label}`)}
                    onClosedClick={(label) => openDrilldown(closed.filter((r) => getBranch(r) === label), `Closed · Station: ${label}`)}
                  />
                </Panel>
              </div>
            </section>

            {}
            <section>
              <div className="sr-section-h">
                <span className="sr-section-rule" aria-hidden="true" />
                <h2>Severity &amp; Airline Risk Profile</h2>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Panel
                  title="By Risk Severity"
                  subtitle="Open (gold) · Closed (green)"
                  className="h-[18rem]"
                  bodyClassName="overflow-y-auto"
                  aiContext={{ section: 'Reports Status', chartTitle: 'By Severity', chartType: 'severity_status_breakdown', chartData: severityRows }}
                >
                  <StackedHBar
                    rows={severityRows}
                    onOpenClick={(label) => openDrilldown(open.filter((r) => getSeverity(r) === label), `Open · Severity: ${label}`)}
                    onClosedClick={(label) => openDrilldown(closed.filter((r) => getSeverity(r) === label), `Closed · Severity: ${label}`)}
                  />
                </Panel>
                <Panel
                  title="By Airline (Top 15)"
                  subtitle="Open (gold) · Closed (green)"
                  className="h-[18rem]"
                  bodyClassName="overflow-y-auto"
                  aiContext={{ section: 'Reports Status', chartTitle: 'By Airline', chartType: 'airline_status_breakdown', chartData: airlineRows.slice(0, 15) }}
                >
                  <StackedHBar
                    rows={airlineRows.slice(0, 15)}
                    onOpenClick={(label) => openDrilldown(open.filter((r) => getAirline(r) === label), `Open · Airline: ${label}`)}
                    onClosedClick={(label) => openDrilldown(closed.filter((r) => getAirline(r) === label), `Closed · Airline: ${label}`)}
                  />
                </Panel>
              </div>
            </section>

            {}
            <section>
              <div className="sr-section-h">
                <span className="sr-section-rule" aria-hidden="true" />
                <h2>Records Detail</h2>
              </div>
              <div className="space-y-4">
                <RecordsTable
                  rows={openRecords}
                  title={`Open Reports (${openCount})`}
                  onRowClick={(row) => openDrilldown([row.raw], `${row.branch} · ${row.airline} · ${row.date}`)}
                  resetKey={year}
                />
                <RecordsTable
                  rows={closedRecords}
                  title={`Closed Reports (${closedCount})`}
                  onRowClick={(row) => openDrilldown([row.raw], `${row.branch} · ${row.airline} · ${row.date}`)}
                  resetKey={year}
                />
              </div>
            </section>
          </>
        );
      }}</YearCard>

      {DrilldownRenderer()}
    </div>
  );
}
