import Image from 'next/image';

export const metadata = {
  title: 'Gapura OneClick - Shared Dashboard',
  description: 'Read-only published dashboard',
};

// Minimal public shell for shared dashboards: brand mark, content, footer.
// No app navigation, no links into the application, nothing that exposes the
// rest of the product to unauthenticated viewers.
export default function ShareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[oklch(0.98_0.005_200)] text-[var(--text-primary)]">
      <header className="sticky top-0 z-40 border-b border-[var(--surface-3)] bg-[oklch(1_0_0_/_0.85)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="Gapura" width={96} height={32} className="opacity-90" style={{ width: 'auto', height: 'auto' }} priority />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      <footer className="border-t border-[var(--surface-3)] py-6">
        <p className="text-center text-[11px] font-semibold tracking-wider text-[var(--text-muted)] uppercase">
          Shared via Gapura OneClick
        </p>
      </footer>
    </div>
  );
}
