import { DashboardWorkspaceSkeleton } from '@/components/dashboard/DashboardWorkspaceSkeleton';

export default function MainDashboardLoading() {
  return (
    <DashboardWorkspaceSkeleton
      title="Opening workspace"
      subtitle="Staging the dashboard shell before interactive modules hydrate."
    />
  );
}
