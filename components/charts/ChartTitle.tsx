
'use client';

import { cn } from '@/lib/utils';

interface ChartTitleProps {

  title: string;

  subtitle?: string;

  className?: string;
}

export function ChartTitle({ title, subtitle, className }: ChartTitleProps) {
  return (
    <div className={cn('mb-6', className)}>
      <h3 className="font-display font-bold text-lg sm:text-xl text-text-primary tracking-tight">
        {title}
        {subtitle && (
          <span className="font-body font-medium text-sm sm:text-base text-text-secondary tracking-normal ml-2">
            — {subtitle}
          </span>
        )}
      </h3>
    </div>
  );
}
