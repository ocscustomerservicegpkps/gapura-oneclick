import './dashboard-theme.css';
import Providers from '@/components/Providers';
import PerformanceTelemetry from '@/components/PerformanceTelemetry';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <Providers>
            <div className="min-h-screen min-h-[100dvh] w-full overflow-x-hidden" style={{ background: 'var(--surface-0)' }}>
                {children}
            </div>
            <PerformanceTelemetry />
        </Providers>
    );
}
