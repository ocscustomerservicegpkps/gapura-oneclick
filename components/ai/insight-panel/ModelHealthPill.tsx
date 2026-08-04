'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { buildCacheKey, readClientCache, writeClientCache } from '@/lib/ai/client-cache';

type ModelInfo = {
  status: string;
  version: string | null;
  lastRetrain: string | null;
  rowCount: number | null;
  retrainRunning: boolean;
  ready: boolean | null;
  missingModels: string[];
};

const CACHE_KEY = buildCacheKey('model-info', 'v1');
const CACHE_TTL_MS = 5 * 60 * 1000;

function relativeTime(iso: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const diffMs = Date.now() - then;
  const days = Math.floor(diffMs / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? '' : 's'} ago`;
}

export function ModelHealthPill({ enabled }: { enabled: boolean }) {
  const [info, setInfo] = useState<ModelInfo | null>(() => (enabled ? readClientCache<ModelInfo>(CACHE_KEY, CACHE_TTL_MS) : null));

  useEffect(() => {
    if (!enabled || info) return;
    let cancelled = false;
    fetch('/api/ai/model-info')
      .then((res) => (res.ok ? res.json() : null))
      .then((json: ModelInfo | null) => {
        if (cancelled || !json) return;
        setInfo(json);
        writeClientCache(CACHE_KEY, json);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [enabled, info]);

  if (!enabled || !info) return null;

  const degraded = info.ready === false || info.missingModels.length > 0;
  const dotTone = info.retrainRunning ? 'bg-amber-500' : degraded ? 'bg-rose-500' : 'bg-emerald-500';
  const statusLabel = info.retrainRunning ? 'Retraining…' : degraded ? 'Model needs attention' : 'Model ready';
  const retrainAgo = relativeTime(info.lastRetrain);

  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
      <span className={cn('h-1.5 w-1.5 rounded-full', dotTone)} />
      {statusLabel}
      {info.version ? ` · v${info.version}` : ''}
      {retrainAgo ? ` · retrain ${retrainAgo}` : ''}
    </span>
  );
}
