
'use client';

import GuestNav from '@/components/GuestNav';
import { useExternalLinks } from '@/lib/hooks/useExternalLinks';
import { getLinkUrl } from '@/lib/external-links';
import { QRCodeWithLogo } from '@/components/ui/QRCodeWithLogo';

export default function JoumpaFeedbackPage() {
  const externalLinks = useExternalLinks();

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      <GuestNav />
      <div className="max-w-3xl mx-auto px-4 pt-12 pb-24 md:pl-[280px]">
        <div className="text-center space-y-2 mb-6">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Customer Feedback Joumpa</h1>
          <p className="text-gray-500">Pindai QR berikut untuk memberikan feedback</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-6 flex items-center justify-center">
          <QRCodeWithLogo value={getLinkUrl(externalLinks, 'customer-joumpa')} size={360} fgColor="#0ea5a6" />
        </div>
      </div>
    </div>
  );
}
