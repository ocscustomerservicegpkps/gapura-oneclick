import { DashboardWorkspaceSkeleton } from '@/components/dashboard/DashboardWorkspaceSkeleton';

export default function DashboardLoading() {
  return (
    <div className="min-h-screen min-h-[100dvh] w-full overflow-x-hidden" style={{ background: 'var(--surface-0)' }}>
      <DashboardWorkspaceSkeleton
        title="Loading workspace"
        subtitle="Verifying session and preparing dashboard."
      />
    </div>
  );
}
