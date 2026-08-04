import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Operational Dashboard — Gapura OneClick',
};

export default function OPLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
