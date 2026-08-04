'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Eye } from 'lucide-react';
import { ResponsiveTable } from '@/components/tables/ResponsiveTable';
import { TableColumn, TableAction } from '@/components/tables/CardViewTable';
import { PresentationSlide } from '@/components/dashboard/PresentationSlide';
import { STATUS_CONFIG } from '@/lib/constants/report-status';
import { cn } from '@/lib/utils';
import type { Report } from '@/types';

interface ReportsTableSectionProps {
  reports: Report[];
  dateRange: 'all' | 'week' | 'month' | { from: string; to: string };
  onViewReport: (report: Report) => void;
  drilldownUrl: (type: string, value: string) => string;
}

export function ReportsTableSection({
  reports,
  onViewReport,
}: ReportsTableSectionProps) {
  const router = useRouter();

  const todayCases = useMemo(() => {
    const todayKey = new Date().toDateString();
    return reports.filter((r) =>
      new Date(r.created_at).toDateString() === todayKey &&
      // ponytail: blank rows synced from trailing empty sheet rows have no
      // title, report text, or reporter — skip instead of showing "(Tanpa Judul)"
      (r.report || r.title || r.description || r.reporter_name)
    );
  }, [reports]);

  const columns: TableColumn<Report>[] = useMemo(() => [
    {
      key: 'title',
      header: 'Judul',
      priority: 'high',
      accessor: (report) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            {report.primary_tag === 'CGO' ? (
              <span className="text-[8px] font-extrabold px-1 py-0.5 rounded bg-[var(--brand-emerald-50)] text-[var(--brand-emerald-700)] border border-[var(--brand-emerald-100)] uppercase">
                CGO
              </span>
            ) : (
              <span className="text-[8px] font-extrabold px-1 py-0.5 rounded bg-[var(--brand-blue-50)] text-[var(--brand-blue-700)] border border-[var(--brand-blue-200)] uppercase">
                L&A
              </span>
            )}
            <span className="text-[9px] text-[var(--text-muted)] font-mono">
              {report.id.slice(0, 8)}
            </span>
          </div>
          <p className="text-sm font-medium text-[var(--text-primary)] truncate max-w-[250px]">
            {report.report || report.title || '(Tanpa Judul)'}
          </p>
        </div>
      ),
      width: '35%',
    },
    {
      key: 'status',
      header: 'Status',
      priority: 'medium',
      accessor: (report) => (
        <span
          className="px-2 py-1 rounded-full text-[10px] font-bold uppercase inline-block"
          style={{
            color: STATUS_CONFIG[report.status as keyof typeof STATUS_CONFIG]?.color,
            backgroundColor:
              STATUS_CONFIG[report.status as keyof typeof STATUS_CONFIG]?.bgColor,
          }}
        >
          {STATUS_CONFIG[report.status as keyof typeof STATUS_CONFIG]?.label ||
            report.status}
        </span>
      ),
      width: '15%',
    },
    {
      key: 'severity',
      header: 'Severity',
      priority: 'medium',
      accessor: (report) => (
        <span
          className={cn(
            'px-2 py-1 rounded-full text-[10px] font-bold uppercase',
            report.severity === 'TOP RISK' || report.severity === 'HIGH RISK'
              ? 'bg-red-100 text-red-700'
              : report.severity === 'MEDIUM'
              ? 'bg-amber-100 text-amber-700'
              : 'bg-green-100 text-green-700'
          )}
        >
          {report.severity || 'LOW'}
        </span>
      ),
      width: '12%',
    },
    {
      key: 'station',
      header: 'Station',
      priority: 'low',
      accessor: (report) => (
        <span className="text-sm text-[var(--text-secondary)]">
          {report.stations?.code || report.branch || '-'}
        </span>
      ),
      width: '12%',
    },
    {
      key: 'date',
      header: 'Date',
      priority: 'low',
      accessor: (report) => (
        <span className="text-sm text-[var(--text-muted)]">
          {new Date(report.created_at).toLocaleDateString('id-ID')}
        </span>
      ),
      width: '15%',
    },
  ], []);

  const actions: TableAction<Report>[] = useMemo(
    () => [
      {
        label: 'Lihat',
        icon: <Eye size={16} />,
        onClick: onViewReport,
        variant: 'ghost',
      },
    ],
    [onViewReport]
  );

  return (
    <PresentationSlide
      title="Today's Reports"
      subtitle={`${todayCases.length} report${todayCases.length === 1 ? '' : 's'} today`}
      icon={FileText}
      className="animate-fade-in-up"
      style={{ animationDelay: '200ms' }}
    >
      <div className="card-solid p-0 overflow-hidden">
        <ResponsiveTable
          data={todayCases.slice(0, 10)}
          columns={columns}
          actions={actions}
          keyExtractor={(report) => report.id}
          onRowClick={onViewReport}
          emptyMessage="No reports today"
          cardBreakpoint={768}
          className="border-0 rounded-none"
        />

        {}
        {todayCases.length > 10 && (
          <div className="p-4 border-t border-[var(--surface-4)] bg-[var(--surface-1)]">
            <button
              onClick={() => router.push('/dashboard/analyst/reports')}
              className="text-sm text-[var(--brand-primary)] font-medium hover:underline w-full text-center"
            >
              Lihat semua {todayCases.length} laporan →
            </button>
          </div>
        )}
      </div>
    </PresentationSlide>
  );
}
