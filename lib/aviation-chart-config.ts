
export const AVIATION_CHART_COLORS = {
  primary: 'oklch(0.65 0.18 160)',
  secondary: 'oklch(0.7 0.15 200)',
  tertiary: 'oklch(0.75 0.14 75)',
  quaternary: 'oklch(0.62 0.16 280)',
  quinary: 'oklch(0.68 0.15 30)',

  irregularity: 'oklch(0.65 0.18 160)',
  complaint: 'oklch(0.65 0.18 25)',
  compliment: 'oklch(0.7 0.15 200)',
} as const;

export const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: 'oklch(0.99 0.005 160 / 0.95)',
    backdropFilter: 'blur(16px)',
    border: '1px solid oklch(0.65 0.18 160 / 0.2)',
    borderRadius: '8px',
    boxShadow: '0 4px 16px oklch(0.45 0.06 160 / 0.12)',
    fontFamily: 'var(--font-body)',
  },
  labelStyle: {
    fontFamily: 'var(--font-display)',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  itemStyle: {
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    fontWeight: 500,
  },
} as const;

export const CHART_LEGEND_STYLE = {
  wrapperStyle: {
    fontFamily: 'var(--font-body)',
    fontSize: '13px',
    fontWeight: 500,
  },
} as const;
