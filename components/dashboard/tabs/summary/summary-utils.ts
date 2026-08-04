'use client';

export function heatColor(value: number, maxValue: number) {
  if (!value || !maxValue) {
    return 'transparent';
  }

  const ratio = Math.min(1, value / maxValue);
  const alpha = 0.14 + ratio * 0.4;
  return `oklch(0.65 0.18 160 / ${alpha.toFixed(3)})`;
}

export function normalizeText(value: unknown, fallback = '-') {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

export function toMonthOrder(name: string) {
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  return months.indexOf(name);
}
