import Image from 'next/image';
import Link from 'next/link';

// Branded 404 for missing or revoked share links. No existence hints, no
// owner metadata, no links deeper into the application.
export default function ShareNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      <Image src="/logo.png" alt="Gapura" width={110} height={38} className="opacity-80" style={{ width: 'auto', height: 'auto' }} />
      <div>
        <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
          This dashboard is no longer available
        </h1>
        <p className="mt-2 max-w-md text-sm text-[var(--text-muted)]">
          The link may have been revoked by its owner. Please contact the person who shared it.
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex min-h-11 items-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
      >
        Go to Gapura OneClick
      </Link>
    </div>
  );
}
