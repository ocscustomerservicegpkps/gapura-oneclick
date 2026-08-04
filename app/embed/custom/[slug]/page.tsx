import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { CustomDashboardContent } from './CustomDashboardContent';

export const revalidate = 300;

export default function CustomDashboardPage() {
  return (
    <div className="custom-dashboard-preview">
      <Suspense fallback={
        <div className="min-h-[60vh] flex flex-col items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-[var(--brand-primary)]" />
          <p className="text-sm text-[var(--text-muted)] mt-4">Loading dashboard...</p>
        </div>
      }>
        <CustomDashboardContent />
      </Suspense>
    </div>
  );
}
