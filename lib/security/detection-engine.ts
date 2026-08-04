
import { SecurityEvent, SecurityAlert } from '@/types/security';
import { supabaseAdmin } from '@/lib/supabase-admin';

export class DetectionEngine {
    private static INSTANCE: DetectionEngine | null = null;

    private ringBuffer: (SecurityEvent | undefined)[];
    private ringHead = 0;
    private ringCount = 0;
    private readonly WINDOW_SIZE = 1000;

    private trafficStats = { count: 0, sum: 0, sumSq: 0 };

    private ipFailures = new Map<string, number[]>();
    private readonly MAX_IP_ENTRIES = 5000;

    private pruneIpFailures(): void {
        if (this.ipFailures.size <= this.MAX_IP_ENTRIES) return;

        const toDelete = Math.floor(this.MAX_IP_ENTRIES * 0.2);
        let deleted = 0;
        for (const key of this.ipFailures.keys()) {
            if (deleted >= toDelete) break;
            this.ipFailures.delete(key);
            deleted++;
        }
    }

    public static getInstance(): DetectionEngine {
        if (!DetectionEngine.INSTANCE) {
            DetectionEngine.INSTANCE = new DetectionEngine();
        }
        return DetectionEngine.INSTANCE;
    }

    private constructor() {

        this.ringBuffer = new Array(this.WINDOW_SIZE).fill(undefined);
    }

    public async analyze(events: SecurityEvent[]): Promise<void> {
        for (const event of events) {
            this.pushToWindow(event);
            await this.runRules(event);
        }

        this.pruneIpFailures();
    }

    private pushToWindow(event: SecurityEvent) {

        const slotIndex = this.ringHead % this.WINDOW_SIZE;
        const old = this.ringBuffer[slotIndex];

        if (old !== undefined && this.ringCount >= this.WINDOW_SIZE) {
            this.updateStats(old, 'REMOVE');
        }

        this.ringBuffer[slotIndex] = event;
        this.ringHead++;
        if (this.ringCount < this.WINDOW_SIZE) this.ringCount++;

        this.updateStats(event, 'ADD');
    }

    private updateStats(event: SecurityEvent, mode: 'ADD' | 'REMOVE') {
        const sign = mode === 'ADD' ? 1 : -1;

        if (event.event_type === 'traffic' && typeof event.payload.bytes === 'number') {
            const val = event.payload.bytes;
            this.trafficStats.count += sign;
            this.trafficStats.sum += sign * val;
            this.trafficStats.sumSq += sign * (val * val);
        }

        if (mode === 'REMOVE' && event.event_type === 'login' && event.payload.success === false && event.ip_address) {
            const history = this.ipFailures.get(event.ip_address);
            if (history) {
                const ts = new Date(event.created_at).getTime();
                const idx = history.indexOf(ts);
                if (idx !== -1) history.splice(idx, 1);
                if (history.length === 0) this.ipFailures.delete(event.ip_address);
            }
        }
    }

    public static destroyInstance(): void {
        if (!DetectionEngine.INSTANCE) return;
        DetectionEngine.INSTANCE.ringBuffer = [];
        DetectionEngine.INSTANCE.ipFailures.clear();
        DetectionEngine.INSTANCE.trafficStats = { count: 0, sum: 0, sumSq: 0 };
        DetectionEngine.INSTANCE.ringHead = 0;
        DetectionEngine.INSTANCE.ringCount = 0;
        DetectionEngine.INSTANCE = null;
    }

    private async runRules(event: SecurityEvent) {
        const now = Date.now();

        if (event.event_type === 'login' && event.payload.success === false && event.ip_address) {
            let history = this.ipFailures.get(event.ip_address);
            if (!history) {
                history = [];
                this.ipFailures.set(event.ip_address, history);
            }

            const ts = new Date(event.created_at).getTime();
            history.push(ts);

            while (history.length > 0 && now - history[0] > 30000) {
                history.shift();
            }

            if (history.length > 10) {
                this.createAlert({
                    title: 'Potential Brute Force Attack',
                    description: `IP ${event.ip_address} failed 10+ logins in 30 seconds. Path: ${event.source}`,
                    severity: 'CRITICAL',
                    metadata: { ip: event.ip_address, count: history.length }
                });
            }
        }

        if (event.event_type === 'traffic' && typeof event.payload.bytes === 'number') {
            const { count, sum, sumSq } = this.trafficStats;

            if (count > 50) {
                const mean = sum / count;
                const variance = Math.max(0, (sumSq / count) - (mean * mean));
                const stdDev = Math.sqrt(variance);
                const bytes = event.payload.bytes;
                const zScore = (bytes - mean) / (stdDev || 1);

                if (zScore > 3.5) {
                    this.createAlert({
                        title: 'Data Exfiltration Anomaly',
                        description: `Traffic spike detected. Z-Score: ${zScore.toFixed(2)}. Bytes: ${bytes}`,
                        severity: 'HIGH',
                        metadata: { zScore, bytes, mean, stdDev }
                    });
                }
            }
        }

        if (event.event_type === 'access' && event.payload.action === 'ROLE_CHANGE') {
            if (event.payload.new_role === 'SUPER_ADMIN' && !event.payload.is_authorized_flow) {
                this.createAlert({
                    title: 'Suspicious Privilege Escalation',
                    description: `Unauthorized attempt to elevate to SUPER_ADMIN detected.`,
                    severity: 'CRITICAL',
                    metadata: { actor: event.actor_id }
                });
            }
        }
    }

    private async createAlert(alert: Partial<SecurityAlert>) {
        try {
            const { error } = await supabaseAdmin
                .from('security_alerts')
                .insert([{
                    ...alert,
                    status: 'OPEN',
                    created_at: new Date().toISOString()
                }]);

            if (error) console.error('Alert persistence failed', error);
        } catch (e) {
            console.error('Critical failure in alert generation', e);
        }
    }
}
