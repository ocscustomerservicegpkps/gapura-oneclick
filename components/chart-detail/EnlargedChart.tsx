import { useRef } from 'react';
import { ChartPreview } from '@/components/builder/ChartPreview';
import type { DashboardTile, QueryResult } from '@/types/builder';
import { ViewMode, Normalization } from '@/components/chart-detail/GlobalControlBar';

interface EnlargedChartProps {
  tile: DashboardTile;
  result: QueryResult;
  viewMode?: ViewMode;
  normalization?: Normalization;
}

export function EnlargedChart({ tile, result, viewMode, normalization }: EnlargedChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const { title, chartType: rawChartType } = tile.visualization;

  let chartType = title === 'Case Report by Area' || title === 'Case Category by Station' || title === 'Case Category by Airlines' 
    ? 'heatmap' 
    : rawChartType;

  if (!chartType) {

    chartType = 'bar';
  }

  const renderChart = () => {
    const isHorizontalBar = chartType === 'horizontal_bar';
    const isPivot = chartType === 'pivot' || chartType === 'table' || chartType === 'branch_area_grid';

    const containerStyle: React.CSSProperties = {
      width: '100%',

      height: isPivot ? '75vh' : (isHorizontalBar ? 'auto' : 'clamp(350px, 60vh, 550px)'), 
      minHeight: '350px',
      maxHeight: isHorizontalBar ? '700px' : 'none',
      overflowY: isHorizontalBar ? 'auto' : 'hidden',
      paddingRight: isHorizontalBar ? '8px' : '0',
      marginBottom: isPivot ? '32px' : '0',
    };

    return (
      <div style={containerStyle}>
        <ChartPreview
          visualization={{
            ...tile.visualization,
            chartType
          }}
          result={result}

          viewMode={viewMode}
          normalization={normalization}
        />
      </div>
    );
  };

  return (
    <div ref={chartRef} className="relative" style={{ width: '100%' }}>
      {renderChart()}
    </div>
  );
}
