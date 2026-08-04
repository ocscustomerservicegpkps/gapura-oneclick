'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { type Report } from '@/types';
import { reportsFromPayload } from '@/lib/report-page';
import { DrilldownDetailView } from '@/components/dashboard/DrilldownDetailView';

const TITLE_MAP: Record<string, string> = {
    category: 'Reports by Category',
    station: 'Reports by Station',
    month: 'Reports by Month',
    status: 'Reports by Status',
    airline: 'Reports by Airline',
    area: 'Reports by Area',
    severity: 'Reports by Severity',
};

export default function AnalystDrilldownPage() {
    const searchParams = useSearchParams();
    const type = searchParams.get('type') || '';
    const value = searchParams.get('value') || '';
    const period = searchParams.get('period') || 'all';

    const [allReports, setAllReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        const fetchReports = async () => {
            setLoading(true);
            try {
                const params = new URLSearchParams();
                if (type === 'category') params.set('category', value);
                if (type === 'station') params.set('station', value);
                if (type === 'status') params.set('status', value);
                if (type === 'airline') params.set('airline', value);
                if (type === 'area') params.set('area', value);
                if (type === 'severity' && value !== 'all') params.set('severity', value);

                if (period !== 'all') {
                    const daysBack = period === 'week' ? 7 : period === 'month' ? 30 : 0;
                    if (daysBack > 0) {
                        params.set('from', new Date(Date.now() - daysBack * 86_400_000).toISOString());
                        params.set('to', new Date().toISOString());
                    }
                }

                const res = await fetch(`/api/admin/reports?${params.toString()}`);
                if (res.ok) {
                    const data = reportsFromPayload<Report>(await res.json());
                    if (active) setAllReports(data);
                }
            } catch (err) {
                console.error('Failed to fetch drilldown data:', err);
            } finally {
                if (active) setLoading(false);
            }
        };
        fetchReports();
        return () => { active = false; };
    }, [period, type, value]);

    const filteredReports = useMemo(() => {

        let filtered = allReports;
        if (period !== 'all') {
            const now = new Date();
            const daysMap: Record<string, number> = { week: 7, month: 30 };
            const daysBack = daysMap[period] || 0;
            if (daysBack > 0) {
                const cutoff = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
                filtered = filtered.filter(r => new Date(r.created_at) >= cutoff);
            }
        }

        switch (type) {
            case 'category':
                return filtered.filter(r => r.category === value);
            case 'station':
                return filtered.filter(r => r.stations?.code === value);
            case 'month': {
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                return filtered.filter(r => {
                    const date = new Date(r.created_at);
                    const m = months[date.getMonth()];
                    const y = date.getFullYear().toString().slice(-2);
                    const monYY = `${m} ${y}`;
                    return m === value || monYY === value;
                });
            }
            case 'status':
                return filtered.filter(r => r.status === value);
            case 'airline':
                return filtered.filter(r => r.airlines === value);
            case 'area':
                return filtered.filter(r => (r.area || 'General') === value);
            case 'severity':
                if (value === 'all') return filtered;
                return filtered.filter(r => 
                    String(r.severity).toUpperCase() === String(value).toUpperCase() ||
                    (String(value).toUpperCase() === 'TOP RISK' && (String(r.severity).toUpperCase() === 'CRITICAL' || String(r.severity).toUpperCase() === 'TOP RISK')) ||
                    (String(value).toUpperCase() === 'HIGH RISK' && (String(r.severity).toUpperCase() === 'HIGH' || String(r.severity).toUpperCase() === 'HIGH RISK'))
                );
            default:
                return filtered;
        }
    }, [allReports, type, value, period]);

    const title = useMemo(() => {
        const base = TITLE_MAP[type] || 'Report Detail';
        return `${base}: ${value}`;
    }, [type, value]);

    return (
        <DrilldownDetailView
            title={title}
            subtitle={period !== 'all' ? `Periode: ${period === 'week' ? '7 Hari Terakhir' : '30 Hari Terakhir'}` : undefined}
            backHref="/dashboard/analyst"
            reports={filteredReports}
            loading={loading}
            userRole="ANALYST"
        />
    );
}
