
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { type Report, type UserRole } from '@/types';
import { reportsFromPayload } from '@/lib/report-page';
import { ReportMasterDetail } from '@/components/dashboard/ReportMasterDetail';

interface UserSession {

    id: string;

    role: UserRole;

    full_name: string;

    station_id?: string;

    station?: { id: string; code: string; name: string } | null;
}

export default function EmployeeReportsPage() {

    const [reports, setReports] = useState<Report[]>([]);

    const [loading, setLoading] = useState(true);

    const [userSession, setUserSession] = useState<UserSession | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        const { signal } = controller;

        const fetchSession = async () => {
            try {
                const res = await fetch('/api/auth/me', { signal });
                if (res.ok) {
                    const userData = await res.json();
                    if (userData.id) {
                        setUserSession({
                            id: userData.id,
                            role: userData.role,
                            full_name: userData.full_name,
                            station_id: userData.station_id,
                            station: userData.station || null,
                        });
                    }
                }
            } catch (error) {
                if (error instanceof DOMException && error.name === 'AbortError') return;
                console.error('Failed to fetch session:', error);
            }
        };
        fetchSession();

        return () => controller.abort();
    }, []);

    const fetchReports = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/reports');
            if (res.ok) {
                setReports(reportsFromPayload<Report>(await res.json()));
            }
        } catch (error) {
            console.error('Failed to fetch reports:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!userSession) return;
        if (userSession.role === 'MANAGER_CABANG') return;
        void fetchReports();
    }, [userSession]);

    if (!userSession) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center text-sm font-semibold text-slate-500">
                Loading report data...
            </div>
        );
    }

    const displayRole = userSession.role || 'STAFF_CABANG';

    if (userSession.role === 'MANAGER_CABANG') {
        return <ManagerReportsRedirect />;
    }

    return (
        <div className="space-y-6">
            {}
            <ReportMasterDetail
                title="My Reports"
                reports={reports}
                loading={loading}
                userRole={displayRole}
                currentUserId={userSession?.id}
                currentUserStationId={userSession?.station_id}
                onRefresh={fetchReports}
            />
        </div>
    );
}

function ManagerReportsRedirect() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/dashboard/manager/reports');
    }, [router]);
    return (
        <div className="flex min-h-[50vh] items-center justify-center text-sm font-semibold text-slate-500">
            Mengarahkan ke All Reports Cabang...
        </div>
    );
}
