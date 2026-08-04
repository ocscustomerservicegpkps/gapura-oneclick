import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logSecurityAudit } from '@/lib/security/audit-logger';
import { SecurityStats, SecurityAlert, AuthMetrics, NetworkStatus, ThreatActor } from '@/types/security';

export async function GET(request: Request) {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.split(' ')[1] || request.headers.get('cookie')?.split('session=')[1]?.split(';')[0];

    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await verifySession(token);
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: config } = await supabaseAdmin
        .from('security_configs')
        .select('value')
        .eq('key', 'demo_access_enabled')
        .single();

    const isDemoEnabled = config?.value === true;

    if (session.role !== 'SUPER_ADMIN' && !isDemoEnabled) {
        await logSecurityAudit({
            actorId: session.id,
            action: 'ACCESS_SECURITY_DASHBOARD',
            entityType: 'SECURITY_DASHBOARD',
            entityId: '/api/security/dashboard-data',
            newValue: { status: 'FAILURE', error: 'Insufficient permissions' }
        });
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const isDemo = session.role !== 'SUPER_ADMIN';

    await logSecurityAudit({
        actorId: session.id,
        action: 'ACCESS_SECURITY_DASHBOARD',
        entityType: 'SECURITY_DASHBOARD',
        entityId: '/api/security/dashboard-data',
        newValue: { status: 'SUCCESS' }
    });

    // Demo mode must show the dashboard's shape without ever touching real
    // telemetry — previously only alert titles/descriptions and threat-actor
    // IPs were masked, while stats/auth/network metrics and alert
    // severity/timing/counts were the real production values. Return fully
    // synthetic data and skip the real queries entirely.
    if (isDemo) {
        const now = new Date().toISOString();
        const demoStats: SecurityStats = {
            totalBlocked: 128,
            malwareDetected: 3,
            intrusionAttempts: 42,
            vulnerabilityScore: 87,
            patchStatusCount: 46,
            totalSystems: 50,
        };
        const demoAlerts: SecurityAlert[] = [1, 2, 3].map((n) => ({
            id: `demo-alert-${n}`,
            title: 'Security Alert',
            description: 'Detail disembunyikan pada mode demo.',
            severity: 'MEDIUM',
            status: 'OPEN',
            created_at: now,
            updated_at: now,
        }));
        const demoAuth: AuthMetrics = {
            failedAttempts: 12,
            successfulLogins: 340,
            suspiciousActivities: 2,
            lastAttackOrigin: 'Demo Network',
        };
        const demoNetwork: NetworkStatus = {
            trafficIn: 2_400_000,
            trafficOut: 900_000,
            activeConnections: 24,
            portScansDetected: 1,
        };
        const demoThreatActors: ThreatActor[] = [
            { ip: '203.0.113.xxx', eventCount: 14, riskScore: 32, lastSeen: now, status: 'BLOCKED' },
            { ip: '198.51.100.xxx', eventCount: 6, riskScore: 12, lastSeen: now, status: 'ACTIVE' },
        ];

        return NextResponse.json({
            stats: demoStats,
            alerts: demoAlerts.map((a) => ({ ...a, canAcknowledge: false })),
            auth: demoAuth,
            network: demoNetwork,
            threatActors: demoThreatActors,
            isDemo: true,
            timestamp: now,
        }, {
            headers: { 'Cache-Control': 'private, no-store, max-age=0' },
        });
    }

    const [
        { count: totalBlocked },
        { count: malwareDetected },
        { count: intrusionAttempts },
        { data: liveAlerts },
        { count: failedAttempts },
        { count: successfulLogins },
        { data: lastTraffic },
        { data: threatEvents },
        { data: blockedIpsData },
        { count: totalUsers }
    ] = await Promise.all([
        supabaseAdmin.from('security_events').select('id', { count: 'exact', head: true }).eq('event_type', 'blocked'),
        supabaseAdmin.from('security_events').select('id', { count: 'exact', head: true }).eq('event_type', 'malware'),
        supabaseAdmin.from('security_events').select('id', { count: 'exact', head: true }).eq('event_type', 'login').eq('payload->>success', 'false'),
        supabaseAdmin.from('security_alerts').select('id, title, description, severity, status, created_at, updated_at').order('created_at', { ascending: false }).limit(10),
        supabaseAdmin.from('security_events').select('id', { count: 'exact', head: true }).eq('event_type', 'login').eq('payload->>success', 'false').gt('created_at', new Date(Date.now() - 86400000).toISOString()),
        supabaseAdmin.from('security_events').select('id', { count: 'exact', head: true }).eq('event_type', 'login').eq('payload->>success', 'true').gt('created_at', new Date(Date.now() - 86400000).toISOString()),
        supabaseAdmin.from('security_events').select('payload').eq('event_type', 'traffic').gt('created_at', new Date(Date.now() - 3600000).toISOString()),
        supabaseAdmin.from('security_events').select('ip_address, severity, created_at, event_type').not('ip_address', 'is', null).order('created_at', { ascending: false }).limit(200),
        supabaseAdmin.from('blocked_ips').select('ip_address'),
        supabaseAdmin.from('users').select('id', { count: 'exact', head: true })
    ]);

    const stats: SecurityStats = {
        totalBlocked: totalBlocked || 0,
        malwareDetected: malwareDetected || 0,
        intrusionAttempts: intrusionAttempts || 0,
        vulnerabilityScore: 100 - (liveAlerts?.length || 0) * 5,

        patchStatusCount: Math.max(0, (totalUsers || 0) - (liveAlerts?.filter(a => a.severity === 'CRITICAL').length || 0)),
        totalSystems: totalUsers || 10
    };

    const alerts: SecurityAlert[] = (liveAlerts || []).map(a => ({
        id: a.id,
        title: a.title,
        description: a.description,
        severity: a.severity as SecurityAlert['severity'],
        status: a.status as SecurityAlert['status'],
        created_at: a.created_at,
        updated_at: a.updated_at
    }));

    const auth: AuthMetrics = {
        failedAttempts: failedAttempts || 0,
        successfulLogins: successfulLogins || 0,
        suspiciousActivities: (liveAlerts?.filter(a => a.severity === 'CRITICAL').length || 0),
        lastAttackOrigin: 'Global Network'
    };

    const totalTrafficBytes = lastTraffic?.reduce((acc, curr) => acc + (curr.payload?.bytes || 0), 0) || 0;
    const baseTrafficIn = (lastTraffic?.length || 0) > 0 ? totalTrafficBytes : (2.4e6 + Math.random() * 1e6);
    const uniqueThreatIps = new Set((threatEvents || []).map(e => e.ip_address)).size;

    const network: NetworkStatus = {
        trafficIn: Math.floor(baseTrafficIn * 0.7),
        trafficOut: Math.floor(baseTrafficIn * 0.3),
        activeConnections: Math.max(uniqueThreatIps, lastTraffic?.length || 0, 1),
        portScansDetected: liveAlerts?.filter(a => a.title.toLowerCase().includes('scan')).length || 0
    };

    const blockedSet = new Set((blockedIpsData || []).map(b => b.ip_address));
    const actorsMap = new Map<string, ThreatActor>();

    (threatEvents || []).forEach(e => {
        const entry = actorsMap.get(e.ip_address) || {
            ip: e.ip_address,
            eventCount: 0,
            riskScore: 0,
            lastSeen: e.created_at,
            status: (blockedSet.has(e.ip_address) ? 'BLOCKED' : 'ACTIVE') as 'BLOCKED' | 'ACTIVE'
        };

        entry.eventCount += 1;
        entry.riskScore += e.severity === 'CRITICAL' ? 25 : e.severity === 'HIGH' ? 10 : 2;
        if (new Date(e.created_at) > new Date(entry.lastSeen)) entry.lastSeen = e.created_at;

        actorsMap.set(e.ip_address, entry);
    });

    const threatActors = Array.from(actorsMap.values())
        .sort((a, b) => b.riskScore - a.riskScore)
        .slice(0, 5);

    return NextResponse.json({
        stats,
        alerts,
        auth,
        network,
        threatActors,
        isDemo: false,
        timestamp: new Date().toISOString()
    }, {
        headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
}
