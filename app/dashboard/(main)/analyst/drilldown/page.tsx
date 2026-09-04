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
    // A custom range arrives as from/to. Interpolating the {from,to} object into
    // the URL produced period=[object Object], which matched neither 'week' nor
    // 'month' — so every custom-range drilldown silently showed all-time data
    // under a '30 Hari Terakhir' heading.
    const customFrom = searchParams.get('from');
    const customTo = searchParams.get('to');
    const hasCustomRange = period === 'custom' && Boolean(customFrom && customTo);

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

                if (hasCustomRange) {
                    params.set('from', new Date(`${customFrom}T00:00:00+07:00`).toISOString());
                    params.set('to', new Date(`${customTo}T23:59:59+07:00`).toISOString());
                } else if (period !== 'all') {
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
    }, [period, type, value, hasCustomRange, customFrom, customTo]);

    const filteredReports = useMemo(() => {

        let filtered = allReports;
        if (hasCustomRange) {
            const from = new Date(`${customFrom}T00:00:00+07:00`).getTime();
            const to = new Date(`${customTo}T23:59:59+07:00`).getTime();
            filtered = filtered.filter(r => {
                // date_of_event first, matching the dashboard this drilldown is
                // reached from — filtering on created_at here put a report in
                // the range on one screen and out of it on the next.
                const at = new Date(r.date_of_event || r.created_at).getTime();
                return at >= from && at <= to;
            });
        } else if (period !== 'all') {
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
    }, [allReports, type, value, period, hasCustomRange, customFrom, customTo]);

    const title = useMemo(() => {
        const base = TITLE_MAP[type] || 'Report Detail';
        return `${base}: ${value}`;
    }, [type, value]);

    return (
        <DrilldownDetailView
            title={title}
            subtitle={hasCustomRange ? `Periode: ${customFrom} s/d ${customTo}` : period === 'week' ? 'Periode: 7 Hari Terakhir' : period === 'month' ? 'Periode: 30 Hari Terakhir' : undefined}
            backHref="/dashboard/analyst"
            reports={filteredReports}
            loading={loading}
            userRole="ANALYST"
        />
    );
}
