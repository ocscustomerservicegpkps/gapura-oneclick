import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Human Capital — Gapura OneClick',
};

export default function HCLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="preload" href="/api/division-documents?division=HC" as="fetch" crossOrigin="use-credentials" />
      <link rel="preload" href="/api/master-data?type=stations" as="fetch" crossOrigin="use-credentials" />
      {children}
    </>
  );
}
