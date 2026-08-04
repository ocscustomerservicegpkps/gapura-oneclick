
'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import PWAInstallPrompt from './PWAInstallPrompt';
import OfflineIndicator from './OfflineIndicator';
import PWAUpdatePrompt from './PWAUpdatePrompt';
import { setPwaAuthScope } from '@/lib/pwa/client-state';
import {
  processOfflineQueueWithEvents,
  refreshOfflineQueueSummary,
  registerOfflineSync,
} from '@/lib/pwa/offline-queue';
import { PWA_QUEUE_EVENT } from '@/lib/pwa/constants';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function logQueueError(action: string, error: unknown) {
}

export default function PWAProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const hideAmbientPwaUi = false;

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return undefined;
    }

    let updateInterval: number | undefined;
    let cancelled = false;
    let swRegistration: ServiceWorkerRegistration | undefined;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === PWA_QUEUE_EVENT) {
        void refreshOfflineQueueSummary().catch((error) => {
          logQueueError('Refresh queue summary', error);
        });
      }
    };

    const handleControllerChange = () => {
      if (isUpdating) {
        window.location.reload();
      }
    };

    const registerServiceWorker = async () => {
      if (process.env.NODE_ENV !== 'production') {
        return;
      }

      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });

        if (cancelled) {
          return;
        }

        const trackInstallingWorker = (worker: ServiceWorker | null) => {
          if (!worker) {
            return;
          }

          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              setWaitingWorker(registration.waiting || worker);
              setShowUpdatePrompt(true);
            }
          });
        };

        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setShowUpdatePrompt(true);
        }

        registration.addEventListener('updatefound', () => {
          trackInstallingWorker(registration.installing);
        });

        swRegistration = registration;
        updateInterval = window.setInterval(() => {
          void registration.update();
        }, 60 * 60 * 1000);
      } catch (error) {
        console.error('[PWA] Service Worker registration failed:', error);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && swRegistration) {
        void swRegistration.update();
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    if (document.readyState === 'complete') {
      void registerServiceWorker();
    } else {
      window.addEventListener('load', () => void registerServiceWorker(), { once: true });
    }

    return () => {
      cancelled = true;
      if (updateInterval) {
        window.clearInterval(updateInterval);
      }
      navigator.serviceWorker.removeEventListener('message', handleMessage);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isUpdating]);

  useEffect(() => {
    const handleOnlineStatusChange = () => {
      if (navigator.onLine) {
        void processOfflineQueueWithEvents().catch((error) => {
          logQueueError('Process offline queue', error);
        });
        void registerOfflineSync().catch((error) => {
          logQueueError('Register offline sync', error);
        });
      }
    };

    window.addEventListener('online', handleOnlineStatusChange);
    window.addEventListener('offline', handleOnlineStatusChange);
    document.addEventListener('visibilitychange', handleOnlineStatusChange);

    void refreshOfflineQueueSummary().catch((error) => {
      logQueueError('Initial queue summary', error);
    });
    if (navigator.onLine) {
      void processOfflineQueueWithEvents().catch((error) => {
        logQueueError('Initial offline queue processing', error);
      });
    }

    return () => {
      window.removeEventListener('online', handleOnlineStatusChange);
      window.removeEventListener('offline', handleOnlineStatusChange);
      document.removeEventListener('visibilitychange', handleOnlineStatusChange);
    };
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((reg) => {
          reg.unregister().then((ok) => {
            void ok;
          });
        });
      }).catch(() => {
      });
    }
  }, []);

  useEffect(() => {
    const syncAuthScope = async () => {
      const shouldCheckAuth = pathname.startsWith('/dashboard');
      if (!shouldCheckAuth) {
        setPwaAuthScope('guest');
        return;
      }

      try {
        const cacheKey = 'gapura:pwa-auth-scope';
        const now = Date.now();
        const cached = typeof window !== 'undefined' ? sessionStorage.getItem(cacheKey) : null;
        if (cached) {
          const parsed = JSON.parse(cached) as { value?: string; expiresAt?: number };
          if (parsed?.value && typeof parsed.expiresAt === 'number' && parsed.expiresAt > now) {
            setPwaAuthScope(parsed.value);
            return;
          }
        }

        const response = await fetch('/api/auth/me');
        if (!response.ok) {
          setPwaAuthScope('guest');
          sessionStorage.setItem(cacheKey, JSON.stringify({ value: 'guest', expiresAt: now + 60_000 }));
          return;
        }

        const user = await response.json();
        const scope = user?.id ? `auth:${user.id}` : 'guest';
        setPwaAuthScope(scope);
        sessionStorage.setItem(cacheKey, JSON.stringify({ value: scope, expiresAt: now + 5 * 60_000 }));
      } catch {
        setPwaAuthScope('guest');
      }
    };

    const idleId = typeof window !== 'undefined' && 'requestIdleCallback' in window
      ? window.requestIdleCallback(() => void syncAuthScope(), { timeout: 5000 })
      : setTimeout(() => void syncAuthScope(), 2000);

    return () => {
      if (typeof idleId === 'number') {
        if ('cancelIdleCallback' in window) {
          (window as unknown as { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(idleId);
        } else {
          clearTimeout(idleId);
        }
      }
    };
  }, [pathname]);

  const applyUpdate = () => {
    if (!waitingWorker) {
      return;
    }

    setIsUpdating(true);
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  };

  return (
    <>
      {children}
      {!hideAmbientPwaUi ? <PWAInstallPrompt /> : null}
      {!hideAmbientPwaUi ? <OfflineIndicator /> : null}
      <PWAUpdatePrompt
        visible={showUpdatePrompt}
        updating={isUpdating}
        onDismiss={() => setShowUpdatePrompt(false)}
        onReload={applyUpdate}
      />
    </>
  );
}
