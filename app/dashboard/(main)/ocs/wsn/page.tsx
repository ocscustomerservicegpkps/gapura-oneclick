'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { QRCodeWithLogo } from '@/components/ui/QRCodeWithLogo';
import { useExternalLinks } from '@/lib/hooks/useExternalLinks';
import { getLinkUrl } from '@/lib/external-links';

export default function WSNPage() {
  const externalLinks = useExternalLinks();
  const searchParams = useSearchParams();
  const [copied, setCopied] = useState(false);
  const link = useMemo(
    () => ({
      title: 'Weekly Service Notice',
      url: getLinkUrl(externalLinks, 'wsn-weekly'),
    }),
    [externalLinks]
  );

  useEffect(() => {
    const open = searchParams.get('open');
    if (open === 'weekly') {
      window.location.replace(link.url);
    }
  }, [searchParams, link]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  return (
    <div className="min-h-screen bg-[var(--surface-0)]">
      <div className="max-w-[900px] mx-auto px-4 md:px-6 py-16 space-y-8">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Weekly Service Notice</h1>
        <div className="grid gap-4">
          <div className="p-6 rounded-2xl border border-[var(--surface-4)] bg-white flex flex-col gap-5">
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 rounded-2xl transition hover:opacity-95"
            >
              <div className="flex-1 min-w-0">
                <p className="text-lg font-bold text-[var(--text-primary)]">{link.title}</p>
                <p className="text-sm text-[var(--text-muted)]">Click the QR code or card to open the link directly.</p>
              </div>
              <div className="flex items-center justify-center p-3 rounded-xl border border-[var(--surface-4)] bg-[var(--surface-1)]">
                <QRCodeWithLogo value={link.url} size={156} fgColor="#0ea5a6" />
              </div>
            </a>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Link</span>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={link.url}
                  className="flex-1 px-3 py-2 rounded-lg border border-[var(--surface-4)] bg-[var(--surface-1)] text-sm"
                />
                <button
                  onClick={() => copy(link.url)}
                  className="px-4 py-2 rounded-lg bg-[var(--brand-primary)] text-white text-sm font-bold active:scale-95"
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-lg bg-[var(--surface-2)] text-[var(--text-primary)] text-sm font-bold border border-[var(--surface-4)] active:scale-95"
                >
                  Open
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
