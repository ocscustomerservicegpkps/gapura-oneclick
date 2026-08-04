
'use client';

import { useState, useEffect } from 'react';
import { WifiOff, Wifi, CloudOff, RefreshCw } from 'lucide-react';
import { PWA_QUEUE_EVENT } from '@/lib/pwa/constants';
import { refreshOfflineQueueSummary } from '@/lib/pwa/offline-queue';

type QueueSummary = {

  queued: number;

  syncing: number;

  failed: number;

  synced: number;

  total: number;
};

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [showReconnected, setShowReconnected] = useState(false);
  const [queueSummary, setQueueSummary] = useState<QueueSummary>({
    queued: 0,
    syncing: 0,
    failed: 0,
    synced: 0,
    total: 0,
  });

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    const syncQueueSummary = async () => {
      try {
        const summary = await refreshOfflineQueueSummary();
        setQueueSummary(summary);
      } catch {
      }
    };

    const handleQueueUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<QueueSummary>;
      if (customEvent.detail) {
        setQueueSummary(customEvent.detail);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener(PWA_QUEUE_EVENT, handleQueueUpdate as EventListener);

    void syncQueueSummary();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener(PWA_QUEUE_EVENT, handleQueueUpdate as EventListener);
    };
  }, []);

  const pendingActions = queueSummary.queued + queueSummary.failed + queueSummary.syncing;

  return (
    <>
      {}
      {!isOnline && (
        <div
          key="offline-banner"
          className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-white shadow-lg animate-in fade-in slide-in-from-top-4 duration-300"
        >
          <div className="container mx-auto px-4 py-2">
            <div className="flex items-center justify-center gap-2 text-sm font-medium">
              <WifiOff className="w-4 h-4" />
              <span>Anda sedang offline. Draft laporan akan dikirim saat koneksi kembali.</span>
              {pendingActions > 0 && (
                <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                  {pendingActions} menunggu
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {}
      {showReconnected && (
        <div
          key="reconnected-banner"
          className="fixed top-0 left-0 right-0 z-[100] bg-emerald-500 text-white shadow-lg animate-in fade-in slide-in-from-top-4 duration-300"
        >
          <div className="container mx-auto px-4 py-2">
            <div className="flex items-center justify-center gap-2 text-sm font-medium">
              <Wifi className="w-4 h-4" />
              <span>
                Back online
                {queueSummary.syncing > 0
                  ? ' - Syncing queue...'
                  : pendingActions > 0
                    ? ' - Queue pending'
                    : ''}
              </span>
              {queueSummary.syncing > 0 && (
                <RefreshCw className="w-4 h-4 animate-spin" />
              )}
            </div>
          </div>
        </div>
      )}

      {}
      {!isOnline && (
        <div
          key="offline-fab"
          className="fixed bottom-20 right-4 z-50 animate-in zoom-in duration-300"
        >
          <div className="bg-amber-500 text-white p-3 rounded-full shadow-lg">
            <CloudOff className="w-6 h-6" />
          </div>
          {pendingActions > 0 && (
            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
              {pendingActions}
            </div>
          )}
        </div>
      )}
    </>
  );
}
