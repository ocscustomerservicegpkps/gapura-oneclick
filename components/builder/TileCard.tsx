
'use client';

import { Pencil, Trash2, Eye } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import type { DashboardTile, QueryResult } from '@/types/builder';

const ChartPreview = dynamic(
  () => import('./ChartPreview').then((module) => module.ChartPreview),
  { loading: () => <div className="h-full min-h-36 animate-pulse rounded-lg bg-slate-100" /> }
);

interface TileCardProps {
  tile: DashboardTile;
  result?: QueryResult | null;
  error?: string | null;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
  onResize: (id: string, w: number, h: number) => void;
  dashboardId?: string;
}

const SIZE_OPTIONS = [
  { label: '1/3', w: 4, h: 2 },
  { label: '1/2', w: 6, h: 2 },
  { label: 'Full', w: 12, h: 2 },
  { label: '1/2 Tall', w: 6, h: 3 },
  { label: 'Full Tall', w: 12, h: 3 },
];

export function TileCard({ tile, result, error, onEdit, onRemove, onResize, dashboardId }: TileCardProps) {
  const router = useRouter();
  const title = tile.visualization.title || 'Tile Tanpa Judul';
  const hasDims = tile.query.dimensions.length > 0;
  const hasMeasures = tile.query.measures.length > 0;
  const isConfigured = hasDims || hasMeasures;
  const isTable = tile.visualization.chartType === 'table';

  const handleViewDetails = () => {
    if (!result) return;

    const detailData = {
      tile,
      result,
      dashboardId,
      timestamp: Date.now()
    };

    sessionStorage.setItem('chartDetailData', JSON.stringify(detailData));

    const params = new URLSearchParams();
    if (dashboardId) params.set('dashboardId', dashboardId);
    params.set('tileId', tile.id);

    router.push(`/dashboard/chart-detail?${params.toString()}`);
  };

  return (
    <div 
      className="group bg-white rounded-xl overflow-hidden flex flex-col h-full transition-shadow hover:shadow-md border border-[#eaeaea]"
    >
      {}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#f0f0f0]">
        <h4 className="m-0 text-sm font-bold text-[#333] truncate flex-1">
          {title}
        </h4>
        <div className="flex items-center gap-1 ml-2">
          {}
          {result && result.rows.length > 0 && (
            <button
              onClick={handleViewDetails}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-[#6b8e3d] bg-[#e8f5e9] hover:bg-[#c8e6c9] rounded transition-colors"
              title="Lihat Detail"
            >
              <Eye size={14} />
              <span>Detail</span>
            </button>
          )}
          {}
          <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <select
              value={`${tile.layout.w}-${tile.layout.h}`}
              onChange={e => {
                const [w, h] = e.target.value.split('-').map(Number);
                onResize(tile.id, w, h);
              }}
              className="py-0.5 px-1 text-xs bg-transparent border border-[#e0e0e0] rounded text-[#666] outline-none cursor-pointer hover:border-[#6b8e3d]"
            >
              {SIZE_OPTIONS.map(s => (
                <option key={`${s.w}-${s.h}`} value={`${s.w}-${s.h}`}>{s.label}</option>
              ))}
            </select>
            <button
              onClick={() => onEdit(tile.id)}
              className="p-1.5 text-[#666] hover:text-[#6b8e3d] transition-colors"
              title="Edit"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => onRemove(tile.id)}
              className="p-1.5 text-[#666] hover:text-red-500 transition-colors"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {}
      <div className={`flex-1 ${
        isTable || title.includes('by Airlines') ? 'overflow-hidden p-0' : 'min-h-[150px] overflow-y-auto p-4'
      } custom-scrollbar`}>
        {!isConfigured ? (
          <div
            className="flex items-center justify-center h-full cursor-pointer rounded hover:bg-[#f5f5f5] transition-colors"
            onClick={() => onEdit(tile.id)}
          >
            <p className="text-xs text-[#999]">Klik Edit untuk mengkonfigurasi query</p>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full px-4 text-center">
            <p className="text-xs text-red-500">{error}</p>
          </div>
        ) : result && result.rows.length > 0 ? (
          <ChartPreview 
            visualization={tile.visualization} 
            result={result} 
            compact={tile.layout.w < 6}
            isThumbnail={true}
          />
        ) : result ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-[#999]">No data</p>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-[#999]">Menunggu data...</p>
          </div>
        )}
      </div>
    </div>
  );
}
