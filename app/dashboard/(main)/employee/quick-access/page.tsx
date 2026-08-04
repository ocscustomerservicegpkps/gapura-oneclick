
'use client';

import type { CSSProperties, ComponentType } from 'react';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Bot, AlertTriangle, QrCode, ClipboardCheck, BookOpen, ArrowRight, X, ExternalLink, ChevronRight
} from 'lucide-react';
import { QRCodeWithLogo } from '@/components/ui/QRCodeWithLogo';
import { useExternalLinks } from '@/lib/hooks/useExternalLinks';
import { getLinkUrl } from '@/lib/external-links';

type QRLink = { label: string; url: string };
type CategoryIcon = ComponentType<{ className?: string; style?: CSSProperties }>;

type Category =
  | { id: string; title: string; description?: string; icon: CategoryIcon; color: string; span: string; qrLinks: QRLink[] }
  | { id: string; title: string; description?: string; icon: CategoryIcon; color: string; span: string; links: { label: string; sublabel?: string; url: string }[] }
  | { id: string; title: string; description?: string; icon: CategoryIcon; color: string; span: string; primaryHref: string; primaryLabel?: string }
  | { id: string; title: string; description?: string; icon: CategoryIcon; color: string; span: string };

function QuickAccessModal({
  category,
  onClose
}: {
  category: Category | null;
  onClose: () => void;
}) {
  if (!category) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-6">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl bg-white rounded-t-3xl md:rounded-3xl border border-black/10 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-black/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${category.color}20` }}>
              <category.icon className="w-5 h-5" style={{ color: category.color }} />
            </div>
            <h3 className="text-lg font-extrabold">{category.title}</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-black/5">
            <X className="w-5 h-5 text-black/60" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {'qrLinks' in category ? (
            <div className={`grid gap-8 ${category.qrLinks.length > 1 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'} place-items-center`}>
              {category.qrLinks.map((item, idx) => (
                <div
                  key={idx}
                  className="space-y-4 w-full max-w-sm rounded-3xl border border-black/10 bg-white p-5 shadow"
                >
                  <div className="aspect-square rounded-3xl overflow-hidden bg-white border border-black/10 p-6 shadow-sm flex items-center justify-center">
                    <QRCodeWithLogo value={item.url} size={256} fgColor="#0ea5a6" />
                  </div>
                  <div className="text-center">
                    <h4 className="text-lg font-extrabold">{item.label}</h4>
                  </div>
                  <div className="space-y-2 rounded-2xl border border-cyan-100 bg-cyan-50/70 p-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">Link {item.label}</label>
                    <input readOnly value={item.url} className="w-full px-3 py-2 rounded-lg border border-black/10 bg-white text-sm font-semibold" />
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => navigator.clipboard.writeText(item.url)}
                        className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold active:scale-95"
                      >
                        Copy Link
                      </button>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 rounded-lg bg-white text-black text-center text-sm font-bold border border-black/10 active:scale-95"
                      >
                        Click Here
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : 'links' in category ? (
            <div className="flex flex-col gap-4 w-full max-w-2xl">
              {category.links.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-4 p-5 rounded-2xl bg-white border border-black/10 hover:border-emerald-500/40 transition"
                >
                  <category.icon className="w-6 h-6 text-emerald-600" />
                  <div className="flex-1">
                    <div className="text-base font-extrabold">{link.label}</div>
                    {link.sublabel ? <div className="text-xs text-black/60 font-bold">{link.sublabel}</div> : null}
                  </div>
                  <ExternalLink className="w-5 h-5 text-black/20 group-hover:text-emerald-600" />
                </a>
              ))}
            </div>
          ) : 'primaryHref' in category ? (
            <div className="space-y-4">
              <div className="text-sm text-black/70 font-bold">
                Gunakan akses cepat untuk membuka pelaporan irregularity.
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={category.primaryHref}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 text-white font-black"
                >
                  {category.primaryLabel || 'Buka'}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-black/70 font-bold">
                Gunakan akses cepat untuk pelaporan internal.
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link href="/dashboard/employee/new" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 text-white font-black">
                  Create Internal Report
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link href="/dashboard/employee" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl border border-black/10 font-black">
                  My Reports
                </Link>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default function QuickAccessPage() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const externalLinks = useExternalLinks();

  const CATEGORIES: Category[] = useMemo(() => [
    {
      id: 'AIChatbot',
      title: 'I am in Charge',
      description: 'Tanya asisten AI untuk bantuan operasional.',
      icon: Bot,
      color: 'oklch(0.60 0.18 260)',
      span: 'col-span-2 row-span-2 md:col-span-2 md:row-span-2',
      links: [
        { label: 'Buka Virtual Assistant', sublabel: 'Powered by Gapura RAG', url: '/virtual-assistant' }
      ]
    },
    {
      id: 'Irregularity',
      title: 'Irregularity Report',
      description: 'Akses cepat pelaporan internal.',
      icon: AlertTriangle,
      color: 'oklch(0.55 0.22 30)',
      span: 'col-span-2 row-span-2 md:col-span-2 md:row-span-2',
      primaryHref: '/auth/public-report',
      primaryLabel: 'Buka Quick Access Irregularity'
    },
    {
      id: 'JOUMPA',
      title: 'JOUMPA',
      description: 'Staff JOUMPA report access.',
      icon: QrCode,
      color: 'oklch(0.50 0.15 190)',
      span: 'col-span-1 row-span-1',
      qrLinks: [
        { label: 'Staff JOUMPA Report', url: getLinkUrl(externalLinks, 'staff-joumpa') }
      ]
    },
    {
      id: 'SLA',
      title: 'Pengisian Report SLA',
      description: 'Akses cepat pengisian laporan SLA.',
      icon: ClipboardCheck,
      color: 'oklch(0.45 0.18 240)',
      span: 'col-span-2 md:col-span-2 row-span-1',
      qrLinks: [
        { label: 'Pengisian SLA Landside', url: getLinkUrl(externalLinks, 'sla-landside') },
        { label: 'Pengisian SLA Airside', url: getLinkUrl(externalLinks, 'sla-airside') }
      ]
    },
    {
      id: 'Survey',
      title: 'Survey Penumpang',
      description: 'Bantu kami meningkatkan layanan via survey.',
      icon: QrCode,
      color: 'oklch(0.60 0.20 340)',
      span: 'col-span-2 md:col-span-2 row-span-1',
      qrLinks: [
        { label: 'Survey Penumpang', url: getLinkUrl(externalLinks, 'survey-penumpang') },
        { label: 'JOUMPA Survey Penumpang', url: getLinkUrl(externalLinks, 'customer-joumpa') }
      ]
    },
    {
      id: 'WSN',
      title: 'Weekly Service Notice',
      description: 'Akses Weekly Service Notice dalam satu link.',
      icon: QrCode,
      color: 'oklch(0.55 0.18 180)',
      span: 'col-span-2 md:col-span-2 row-span-1',
      qrLinks: [
        { label: 'Weekly Service Notice', url: getLinkUrl(externalLinks, 'wsn-weekly') }
      ]
    },
    {
      id: 'Handbook',
      title: 'Handbook SLA',
      description: 'Panduan standar layanan operasional prima.',
      icon: BookOpen,
      color: 'oklch(0.45 0.20 160)',
      span: 'col-span-2 md:col-span-2 row-span-1',
      links: [
        { label: 'Buka Handbook SLA', sublabel: 'SIS Apps Dev', url: getLinkUrl(externalLinks, 'handbook-sla') }
      ]
    }
  ], [externalLinks]);

  const activeCategory = CATEGORIES.find(c => c.id === activeId) || null;

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Quick Access</h1>
        <p className="text-sm text-black/60 font-bold">Akses cepat ke tool dan formulir operasional.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 auto-rows-[140px] md:auto-rows-[200px]">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveId(cat.id)}
              className={`${cat.span} group relative rounded-2xl border border-black/10 bg-white hover:shadow transition overflow-hidden p-4 md:p-6 text-left`}
            >
              <div className="flex h-full flex-col justify-between">
                <div className="space-y-2">
                  <div className="p-2 rounded-xl bg-white border border-black/10 shadow-inner-rim w-fit">
                    <Icon className="w-5 h-5" style={{ color: cat.color }} />
                  </div>
                  <div>
                    <div className="text-base md:text-xl font-extrabold leading-tight">{cat.title}</div>
                    {cat.description ? <div className="hidden md:block text-xs text-black/60 font-bold">{cat.description}</div> : null}
                  </div>
                </div>
                <div className="flex items-center justify-between text-black/30 group-hover:text-emerald-600">
                  <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest">{'qrLinks' in cat ? 'Quick Access' : 'Luncurkan'}</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <QuickAccessModal category={activeCategory || null} onClose={() => setActiveId(null)} />
    </div>
  );
}
