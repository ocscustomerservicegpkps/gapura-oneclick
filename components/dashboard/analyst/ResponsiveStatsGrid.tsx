'use client';

import { TrendingUp, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { StatsCard } from './StatsCard';

interface ResponsiveStatsGridProps {
  stats: {
    total: number;
    resolved: number;
    pending: number;
    highSeverity: number;
    resolutionRate: number;
    years?: number[];
  };
  onStatClick?: (type: 'total' | 'resolved' | 'pending' | 'high') => void;
  compact?: boolean;
}

export function ResponsiveStatsGrid({ stats, onStatClick }: ResponsiveStatsGridProps) {
  const yearsLabel =
    stats.years && stats.years.length > 0
      ? `Total Reports (${stats.years.join(', ')})`
      : 'Total Reports All Years';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-2 gap-3 sm:gap-4 animate-fade-in-up" style={{ animationDelay: '80ms' }}>
      <StatsCard
        icon={TrendingUp}
        value={stats.total}
        label={yearsLabel}
        onClick={() => onStatClick?.('total')}
      />
      <StatsCard
        icon={AlertTriangle}
        value={stats.highSeverity}
        label="Top Risk & High Risk"
        onClick={() => onStatClick?.('high')}
      />
      <StatsCard
        icon={CheckCircle2}
        value={stats.resolved}
        label="Closed"
        onClick={() => onStatClick?.('resolved')}
      />
      <StatsCard
        icon={Clock}
        value={stats.pending}
        label="Open"
        onClick={() => onStatClick?.('pending')}
      />
    </div>
  );
}
