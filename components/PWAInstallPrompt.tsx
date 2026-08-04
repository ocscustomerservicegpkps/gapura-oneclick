
'use client';

import { useState, useEffect } from 'react';
import { Download, X, Smartphone, Share, ExternalLink } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {

  prompt: () => Promise<void>;

  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Platform = 'ios' | 'android' | 'desktop' | null;

interface PwaDebugState {
  beforeInstallPrompt: boolean;
  serviceWorkerSupported: boolean;
  serviceWorkerReady: boolean;
  manifestLinked: boolean;
  manifestReachable: boolean;
  environment: string;
}

function getInitialInstalledState() {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.matchMedia('(display-mode: standalone)').matches;
}

function getInitialPlatform(): Platform {
  if (typeof navigator === 'undefined') {
    return null;
  }

  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
    return 'ios';
  }

  if (userAgent.includes('android')) {
    return 'android';
  }

  return 'desktop';
}

function detectInstallEnvironment(): string {
  if (typeof navigator === 'undefined') {
    return 'unknown';
  }

  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('bluestacks')) return 'bluestacks';
  if (ua.includes('wv')) return 'android-webview';
  if (ua.includes('emulator')) return 'android-emulator';
  if (ua.includes('cros')) return 'chromeos';
  if (ua.includes('edg')) return 'edge';
  if (ua.includes('chrome')) return 'chromium';
  if (ua.includes('safari')) return 'safari';
  return 'browser';
}

function getBrowserInstallHint(platform: Platform, environment: string) {
  if (platform === 'ios') {
    return 'Gunakan tombol Share lalu pilih Add to Home Screen.';
  }

  if (environment === 'bluestacks') {
    return 'BlueStacks sering tidak memicu install prompt web standar. Gunakan ikon download/install di toolbar browser kanan atas.';
  }

  if (environment === 'android-webview') {
    return 'Browser berbasis WebView biasanya tidak mendukung prompt install. Buka link ini di Chrome penuh agar opsi install tersedia.';
  }

  return 'Gunakan menu browser atau ikon install di toolbar untuk memasang aplikasi.';
}

function getInitialDebugState(): PwaDebugState {
  if (typeof window === 'undefined' || typeof navigator === 'undefined' || typeof document === 'undefined') {
    return {
      beforeInstallPrompt: false,
      serviceWorkerSupported: false,
      serviceWorkerReady: false,
      manifestLinked: false,
      manifestReachable: false,
      environment: 'unknown',
    };
  }

  const manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;

  return {
    beforeInstallPrompt: false,
    serviceWorkerSupported: 'serviceWorker' in navigator,
    serviceWorkerReady: false,
    manifestLinked: Boolean(manifestLink?.href),
    manifestReachable: false,
    environment: detectInstallEnvironment(),
  };
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isInstalled, setIsInstalled] = useState(getInitialInstalledState);
  const [platform] = useState<Platform>(getInitialPlatform);
  const [showBrowserHint, setShowBrowserHint] = useState(false);
  const [debugState, setDebugState] = useState<PwaDebugState>(getInitialDebugState);

  useEffect(() => {
    if (getInitialInstalledState()) {
      return;
    }

    const dismissed = localStorage.getItem('pwa-install-dismissed');
    const dismissedTime = dismissed ? parseInt(dismissed) : 0;
    const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);

    if (daysSinceDismissed < 7) {
      return;
    }

    const showTimer = window.setTimeout(() => {
      setShowPrompt(true);
    }, 10000);

    const manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    const serviceWorkerSupported = 'serviceWorker' in navigator;

    if (serviceWorkerSupported) {
      navigator.serviceWorker.ready
        .then(() => {
          setDebugState((current) => ({ ...current, serviceWorkerReady: true }));
        })
        .catch(() => {
          setDebugState((current) => ({ ...current, serviceWorkerReady: false }));
        });
    }

    if (manifestLink?.href) {
      fetch(manifestLink.href, { method: 'GET' })
        .then((response) => {
          setDebugState((current) => ({ ...current, manifestReachable: response.ok }));
        })
        .catch(() => {
          setDebugState((current) => ({ ...current, manifestReachable: false }));
        });
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setDebugState((current) => ({ ...current, beforeInstallPrompt: true }));
      setShowPrompt(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.clearTimeout(showTimer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      if (platform === 'ios') {
        setShowPrompt(true);
      }
      return;
    }

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setIsInstalled(true);
    } else {
      // Native dismissal should suppress the prompt for the same 7-day
      // window as the in-app close button, or it reappears on next reload.
      localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    }

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setExpanded(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  const installHint = getBrowserInstallHint(platform, debugState.environment);
  const showManualInstallHelp = platform !== 'ios' && !deferredPrompt;

  if (isInstalled) return null;

  return (
    <>
      {showPrompt && !expanded && (
        <div
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 pl-3 pr-2 py-2.5 text-white shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-300"
        >
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <Smartphone className="w-4 h-4 shrink-0" />
            <span className="text-sm font-semibold whitespace-nowrap">Install App</span>
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Close"
            className="p-1 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {showPrompt && expanded && (
        <div
          className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto animate-in fade-in slide-in-from-bottom-8 duration-300"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-emerald-100 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-4 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 backdrop-blur p-2 rounded-lg">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold">Install OneClick</h3>
                    <p className="text-sm text-white/90">Akses lebih cepat & offline</p>
                  </div>
                </div>
                <button
                  onClick={handleDismiss}
                  className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4">
              {platform === 'ios' ? (
                <div className="space-y-3 text-sm text-gray-700">
                  <p>Untuk menginstall aplikasi OneClick di iPhone/iPad:</p>
                  <ol className="list-decimal list-inside space-y-2">
                    <li>Tap tombol <Share className="w-4 h-4 inline mx-1" /> Share di bawah</li>
                    <li>Scroll ke bawah, tap <strong>&quot;Add to Home Screen&quot;</strong></li>
                    <li>Tap <strong>&quot;Add&quot;</strong> di pojok kanan atas</li>
                  </ol>
                </div>
              ) : (
                <div className="space-y-3 text-sm text-gray-700">
                  <p className="font-medium">Fitur yang didapat:</p>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-600 mt-1">✓</span>
                      <span>Akses cepat dari home screen</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-600 mt-1">✓</span>
                      <span>Bekerja offline</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-600 mt-1">✓</span>
                      <span>Tampilan full-screen seperti aplikasi</span>
                    </li>
                  </ul>
                </div>
              )}

              {platform !== 'ios' && deferredPrompt && (
                <button
                  onClick={handleInstallClick}
                  className="w-full mt-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold py-3 px-4 rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Install Sekarang
                </button>
              )}

              {showManualInstallHelp && (
                <div className="mt-4 space-y-3">
                  <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    {installHint}
                  </p>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setShowBrowserHint((current) => !current)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-50"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Buka menu browser
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowBrowserHint((current) => !current)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-50"
                    >
                      <Download className="h-4 w-4" />
                      Gunakan ikon install
                    </button>
                  </div>

                  {showBrowserHint ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      {debugState.environment === 'bluestacks' ? (
                        <p>Di BlueStacks, cari ikon download/install di toolbar kanan atas browser. Jika tidak muncul, browser ini kemungkinan tidak mendukung install prompt PWA penuh.</p>
                      ) : (
                        <p>Di Android Chromium, buka menu titik tiga browser lalu cari opsi seperti <strong>Install app</strong>, <strong>Add to Home screen</strong>, atau gunakan ikon install di kanan address bar/toolbar bila tersedia.</p>
                      )}
                    </div>
                  ) : null}
                </div>
              )}

              <button
                onClick={handleDismiss}
                className="w-full mt-2 text-gray-500 hover:text-gray-700 text-sm py-2 transition-colors"
              >
                Nanti saja
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
