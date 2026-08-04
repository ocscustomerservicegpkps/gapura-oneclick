
export type SecuritySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SecurityEvent {

    id: string;

    source: string;

    event_type: 'login' | 'traffic' | 'access' | 'anomaly';

    severity: SecuritySeverity;

    payload: Record<string, unknown>;

    ip_address?: string;

    actor_id?: string;

    created_at: string;
}

export interface SecurityAlert {

    id: string;

    title: string;

    description: string;

    severity: SecuritySeverity;

    status: 'OPEN' | 'INVESTIGATING' | 'CONTAINED' | 'RESOLVED';

    source_events?: string[];

    metadata?: Record<string, unknown>;

    assigned_to?: string;

    created_at: string;

    updated_at: string;
}

export interface SecurityStats {

    totalBlocked: number;

    malwareDetected: number;

    intrusionAttempts: number;

    vulnerabilityScore: number;

    patchStatusCount: number;

    totalSystems: number;
}

export interface AuthMetrics {

    failedAttempts: number;

    successfulLogins: number;

    suspiciousActivities: number;

    lastAttackOrigin: string;
}

export interface NetworkStatus {

    trafficIn: number;

    trafficOut: number;

    activeConnections: number;

    portScansDetected: number;
}

export interface ThreatActor {

    ip: string;

    eventCount: number;

    lastSeen: string;

    riskScore: number;

    status: 'ACTIVE' | 'BLOCKED';

    location?: string;
}
