'use client';

import { memo } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  icon: LucideIcon;
  value: number | string;
  label: string;
  onClick?: () => void;
  className?: string;
}

export const StatsCard = memo(function StatsCard({ icon: Icon, value, label, onClick, className }: StatsCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${typeof value === 'number' ? value.toLocaleString() : value}`}
      className={cn(
        'group relative w-full rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 text-left transition-all duration-400 cursor-pointer active:scale-[0.98]',
        'bg-surface-2 border border-transparent',
        onClick && 'cursor-pointer',
        className
      )}
      style={{
        backgroundImage: `
          linear-gradient(var(--surface-2), var(--surface-2)),
          linear-gradient(135deg, oklch(0.65 0.18 160 / 0.15), oklch(0.58 0.2 162 / 0.08))
        `,
        backgroundOrigin: 'border-box',
        backgroundClip: 'padding-box, border-box',
        boxShadow: '0 2px 8px oklch(0.45 0.06 160 / 0.04)',
        transition: 'all 400ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundImage = `
          linear-gradient(var(--surface-2), var(--surface-2)),
          linear-gradient(135deg, oklch(0.65 0.18 160 / 0.3), oklch(0.58 0.2 162 / 0.15))
        `;
        e.currentTarget.style.boxShadow = '0 8px 24px oklch(0.45 0.06 160 / 0.06), 0 16px 48px oklch(0.65 0.18 160 / 0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundImage = `
          linear-gradient(var(--surface-2), var(--surface-2)),
          linear-gradient(135deg, oklch(0.65 0.18 160 / 0.15), oklch(0.58 0.2 162 / 0.08))
        `;
        e.currentTarget.style.boxShadow = '0 2px 8px oklch(0.45 0.06 160 / 0.04)';
      }}
    >
      <div className="flex items-center justify-center w-8 h-8 sm:w-10 md:w-12 sm:h-10 md:h-12 rounded-lg sm:rounded-xl bg-[oklch(0.65_0.18_160_/_0.1)] mb-2 sm:mb-3 md:mb-4">
        <Icon className="w-4 h-4 sm:w-5 md:w-6 sm:h-5 md:h-6 text-brand-emerald-600" />
      </div>

      <div className="font-mono font-semibold text-xl sm:text-2xl md:text-3xl lg:text-4xl text-brand-emerald-600 tracking-tight mb-0.5 sm:mb-1">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>

      <div className="font-display font-semibold text-[9px] sm:text-[10px] md:text-xs uppercase tracking-wider sm:tracking-widest text-text-secondary line-clamp-2">
        {label}
      </div>
    </button>
  );
});
