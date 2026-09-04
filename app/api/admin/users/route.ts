import { after, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import { verifySession } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { hashPassword } from '@/lib/auth-utils';
import { notifyAccountStatusChange, type AccountStatusEvent } from '@/lib/notifications';

const VALID_ROLES = [
    'SUPER_ADMIN',
    'DIVISI_OS', 'DIVISI_OCS', 'DIVISI_OT', 'DIVISI_UQ',
    'DIVISI_OP',
    'DIVISI_HC',
    'DIVISI_HT',
    'DIVISI_ESKALASI',
    'ANALYST',
    'MANAGER_CABANG',
    'STAFF_CABANG',
];

const VALID_DIVISIONS = ['OCS', 'OS', 'OP', 'OT', 'UQ', 'HC', 'HT', 'GENERAL'];
const VALID_STATUSES = ['pending', 'active', 'rejected', 'suspended'];

const DEFAULT_UNITS: Record<string, { name: string }> = {
    '00000000-0000-0000-0000-000000000101': { name: 'Ramp' },
    '00000000-0000-0000-0000-000000000102': { name: 'Passenger Service' },
    '00000000-0000-0000-0000-000000000103': { name: 'Cargo' },
    '00000000-0000-0000-0000-000000000104': { name: 'GSE' },
    '00000000-0000-0000-0000-000000000105': { name: 'Security' },
    '00000000-0000-0000-0000-000000000106': { name: 'Administrasi' },
};

const DEFAULT_POSITIONS: Record<string, { name: string; level: number }> = {
    '00000000-0000-0000-0000-000000000201': { name: 'Super Admin', level: 1 },
    '00000000-0000-0000-0000-000000000202': { name: 'Analyst', level: 2 },
    '00000000-0000-0000-0000-000000000203': { name: 'DIVISI OP', level: 3 },
    '00000000-0000-0000-0000-000000000204': { name: 'DIVISI OP', level: 3 },
    '00000000-0000-0000-0000-000000000205': { name: 'DIVISI OP', level: 3 },
    '00000000-0000-0000-0000-000000000206': { name: 'OS', level: 3 },
    '00000000-0000-0000-0000-000000000207': { name: 'OSF', level: 3 },
    '00000000-0000-0000-0000-000000000208': { name: 'OSL', level: 3 },
    '00000000-0000-0000-0000-000000000209': { name: 'Staff', level: 10 },
    '00000000-0000-0000-0000-00000000020A': { name: 'Officer', level: 9 },
    '00000000-0000-0000-0000-00000000020B': { name: 'Supervisor', level: 8 },
    '00000000-0000-0000-0000-00000000020C': { name: 'Manager', level: 7 },
};

export async function GET(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('session')?.value;
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const payload = await verifySession(token);
        if (!payload) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');

        const role = String(payload.role || '').trim().toUpperCase();
        const isSuper = role === 'SUPER_ADMIN';
        const isManager = role === 'MANAGER_CABANG';

        const client = supabaseAdmin;

        let stationFilter: string | null = null;
        if (!isSuper && isManager) {
            stationFilter = payload.station_id || null;
            if (!stationFilter) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        } else if (!isSuper) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        let query = client
            .from('users')
            .select('id, email, full_name, nik, phone, role, division, status, station_id, unit_id, position_id, created_at, updated_at')
            .order('created_at', { ascending: false });

        if (status) {
            if (!VALID_STATUSES.includes(status)) {
                return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
            }
            query = query.eq('status', status);
        }

        if (stationFilter) {
            query = query.eq('station_id', stationFilter);
        }

        if (isManager) {
            query = query.eq('role', 'STAFF_CABANG');
        }

        const { data, error } = await query;

        if (error) throw error;

        const rows = Array.isArray(data) ? data : [];
        // unit_id/position_id may hold free text (unit kerja/jabatan typed at
        // registration) instead of UUIDs — only UUIDs can be looked up.
        const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
        const stationIds = Array.from(new Set(rows.map((user) => user.station_id).filter(Boolean)));
        const unitIds = Array.from(new Set(rows.map((user) => user.unit_id).filter(Boolean).filter(isUuid)));
        const positionIds = Array.from(new Set(rows.map((user) => user.position_id).filter(Boolean).filter(isUuid)));

        const [stationsResult, unitsResult, positionsResult] = await Promise.all([
            stationIds.length
                ? supabaseAdmin.from('stations').select('id, code, name').in('id', stationIds)
                : Promise.resolve({ data: [], error: null }),
            unitIds.length
                ? supabaseAdmin.from('units').select('id, name').in('id', unitIds)
                : Promise.resolve({ data: [], error: null }),
            positionIds.length
                ? supabaseAdmin.from('positions').select('id, name, level').in('id', positionIds)
                : Promise.resolve({ data: [], error: null }),
        ]);

        if (stationsResult.error) throw stationsResult.error;
        if (unitsResult.error) throw unitsResult.error;
        if (positionsResult.error) throw positionsResult.error;

        const stationsById = new Map((stationsResult.data || []).map((station) => [station.id, station]));
        const unitsById = new Map((unitsResult.data || []).map((unit) => [unit.id, unit]));
        const positionsById = new Map((positionsResult.data || []).map((position) => [position.id, position]));

        const enrichedUsers = rows.map((user) => ({
            ...user,
            avatar_url: null,
            stations: user.station_id ? stationsById.get(user.station_id) || null : null,
            units: user.unit_id
                ? unitsById.get(user.unit_id)
                    || DEFAULT_UNITS[user.unit_id]
                    || (!isUuid(user.unit_id) ? { name: user.unit_id } : null)
                : null,
            positions: user.position_id
                ? positionsById.get(user.position_id)
                    || DEFAULT_POSITIONS[user.position_id]
                    || (!isUuid(user.position_id) ? { name: user.position_id } : null)
                : null,
        }));

        return NextResponse.json(enrichedUsers, {
            headers: { 'Cache-Control': 'private, no-store, max-age=0' },
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        return NextResponse.json({ error: 'Gagal memuat users' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('session')?.value;
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const payload = await verifySession(token);
        if (!payload) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const {
            email,
            full_name,
            nik,
            phone,
            unit_id,
            position_id,
            station_id,
            role,
            division,
            activate = false,
        } = body || {};

        const isSuper = payload.role === 'SUPER_ADMIN';
        const isManager = payload.role === 'MANAGER_CABANG';
        if (!isSuper && !isManager) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (!email || !full_name || !nik || !phone || !position_id) {
            return NextResponse.json({ error: 'All field wajib diisi' }, { status: 400 });
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json({ error: 'Format email tidak valid' }, { status: 400 });
        }
        const nikRegex = /^[A-Z0-9]{5,15}$/i;
        if (!nikRegex.test(nik)) {
            return NextResponse.json({ error: 'NIK harus 5-15 karakter (huruf/angka)' }, { status: 400 });
        }
        const phoneRegex = /^08\d{8,11}$/;
        if (!phoneRegex.test(phone)) {
            return NextResponse.json({ error: 'Nomor HP harus dimulai 08 dan 10-13 digit' }, { status: 400 });
        }

        let targetStationId: string | null = null;
        if (isSuper) {
            targetStationId = station_id || null;
            if (!targetStationId) {
                return NextResponse.json({ error: 'station_id wajib untuk admin' }, { status: 400 });
            }
        } else if (isManager) {
            targetStationId = payload.station_id || null;
            if (!targetStationId) {
                return NextResponse.json({ error: 'Station manager tidak ditemukan' }, { status: 403 });
            }
        }

        const { data: existingEmail } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('email', String(email).toLowerCase())
            .single();
        if (existingEmail) {
            return NextResponse.json({ error: 'Email sudah terdaftar' }, { status: 400 });
        }
        const { data: existingNik } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('nik', String(nik).toUpperCase())
            .single();
        if (existingNik) {
            return NextResponse.json({ error: 'NIK sudah terdaftar' }, { status: 400 });
        }

        let newRole: string = 'STAFF_CABANG';
        let newDivision: string = 'GENERAL';
        if (isSuper && role) {
            if (!VALID_ROLES.includes(role)) {
                return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
            }
            newRole = role;
            if (division) {
                if (!VALID_DIVISIONS.includes(division)) {
                    return NextResponse.json({ error: 'Invalid division' }, { status: 400 });
                }
                newDivision = division;
            }
        }
        if (isManager) {
            newRole = 'STAFF_CABANG';
            newDivision = 'GENERAL';
        }

        // Deliberately unknowable: generated, hashed, and never returned or
        // sent anywhere. An admin-created account is claimed through the OTP
        // password-reset flow (lib/auth/password-reset.ts), so there is no
        // plaintext credential to leak into this response or an admin's logs.
        const tempPassword = randomBytes(12).toString('base64url').slice(0, 16) + '8A!';
        const hashed = await hashPassword(tempPassword);

        const insertData: Record<string, unknown> = {
            email: String(email).toLowerCase(),
            password: hashed,
            full_name: String(full_name).trim(),
            nik: String(nik).toUpperCase(),
            phone,
            station_id: targetStationId,
            unit_id: unit_id || null,
            position_id,
            role: newRole,
            division: newDivision,
            status: isSuper && activate ? 'active' : 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        const { error: insertErr } = await supabaseAdmin.from('users').insert(insertData);
        if (insertErr) {
            console.error('Create user error:', insertErr);
            if (insertErr.code === '23505') {
                const constraint = /violates unique constraint "([^"]+)"/.exec(insertErr.message || '')?.[1];
                const conflictMessage = constraint === 'users_nik_key'
                    ? 'NIK sudah terdaftar'
                    : constraint === 'users_email_key'
                        ? 'Email sudah terdaftar'
                        : 'Data sudah terdaftar';
                return NextResponse.json({ error: conflictMessage }, { status: 400 });
            }
            return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: activate ? 'User dibuat dan diaktifkan' : 'User dibuat, status pending',

        });
    } catch (error) {
        console.error('Create user error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * Maps a status write to the event the account holder should hear about.
 * `active` means two different things — first approval vs. restoring a
 * suspended/rejected account — so the previous status decides the wording.
 */
function accountStatusEvent(previous: string | null, next: string): AccountStatusEvent | null {
    if (next === previous) return null;
    if (next === 'active') return previous === 'pending' ? 'approved' : 'reactivated';
    if (next === 'rejected') return 'rejected';
    if (next === 'suspended') return 'suspended';
    return null;
}

/** Sent after the response so a slow SMTP hop never blocks the admin action. */
function queueAccountStatusEmail(userId: string, previousStatus: string | null, nextStatus: string) {
    const event = accountStatusEvent(previousStatus, nextStatus);
    if (!event) return;

    after(async () => {
        try {
            const { data: user } = await supabaseAdmin
                .from('users')
                .select('email, full_name, role, station_id, updated_at')
                .eq('id', userId)
                .single();
            if (!user) return;

            let stationCode: string | null = null;
            if (user.station_id) {
                const { data: station } = await supabaseAdmin
                    .from('stations')
                    .select('code')
                    .eq('id', user.station_id)
                    .maybeSingle();
                stationCode = station?.code || user.station_id;
            }

            await notifyAccountStatusChange({
                email: user.email,
                fullName: user.full_name,
                role: user.role,
                stationCode,
                event,
                occurredAt: user.updated_at || new Date().toISOString(),
            });
        } catch (error) {
            console.warn('[ADMIN_USERS] Account status email failed (non-blocking):', error);
        }
    });
}

export async function PATCH(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('session')?.value;
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const payload = await verifySession(token);
        if (!payload) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const body = await request.json();
        const { userId, status, role, division, station_id } = body;

        if (!userId) {
            return NextResponse.json({ error: 'User ID required' }, { status: 400 });
        }

        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

        if (payload.role === 'SUPER_ADMIN') {
            // A super admin editing their own row can lock themselves out —
            // suspending the account or handing it a lesser role are both
            // one-way doors, since the resulting user can no longer reach this
            // endpoint to undo it. Editing anyone else is unaffected.
            const isSelf = userId === payload.id;

            if (status) {
                if (!VALID_STATUSES.includes(status)) {
                    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
                }
                if (isSelf && status !== 'active') {
                    return NextResponse.json(
                        { error: 'Tidak dapat menonaktifkan akun Super Admin Anda sendiri' },
                        { status: 400 },
                    );
                }
                updates.status = status;
            }

            if (role) {
                if (!VALID_ROLES.includes(role)) {
                    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
                }
                if (isSelf && role !== 'SUPER_ADMIN') {
                    return NextResponse.json(
                        { error: 'Tidak dapat menurunkan role Super Admin Anda sendiri' },
                        { status: 400 },
                    );
                }
                updates.role = role;
            }

            if (division) {
                 if (!VALID_DIVISIONS.includes(division)) {
                     return NextResponse.json({ error: 'Invalid division' }, { status: 400 });
                 }
                 updates.division = division;
            }

            if (station_id !== undefined) {
                if (station_id) {
                    const { data: stationRow, error: stationError } = await supabaseAdmin
                        .from('stations')
                        .select('id')
                        .eq('id', station_id)
                        .single();
                    if (stationError || !stationRow) {
                        return NextResponse.json({ error: 'Invalid station_id' }, { status: 400 });
                    }
                }
                updates.station_id = station_id || null;
            }

            const previousStatus = status
                ? (await supabaseAdmin.from('users').select('status').eq('id', userId).single()).data?.status ?? null
                : null;

            const { error } = await supabaseAdmin
                .from('users')
                .update(updates)
                .eq('id', userId);

            if (error) throw error;

            if (status) queueAccountStatusEmail(userId, previousStatus, status);
        } else if (payload.role === 'MANAGER_CABANG') {
            if (!status) {
                return NextResponse.json({ error: 'Only status updates allowed' }, { status: 400 });
            }
            if (!['active', 'rejected'].includes(status)) {
                return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
            }

            if (role || division || station_id !== undefined) {
                return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
            }

            const { data: target } = await supabaseAdmin
                .from('users')
                .select('station_id, role, status')
                .eq('id', userId)
                .single();
            if (!payload.station_id || !target) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
            if (payload.station_id !== target.station_id || target.role !== 'STAFF_CABANG') {
                return NextResponse.json({ error: 'Can only manage STAFF_CABANG in your station' }, { status: 403 });
            }
            if (target.status !== 'pending') {
                return NextResponse.json({ error: 'Only pending users can be approved or rejected' }, { status: 400 });
            }
            const { error } = await supabaseAdmin
                .from('users')
                .update({ status, updated_at: new Date().toISOString() })
                .eq('id', userId);
            if (error) throw error;

            queueAccountStatusEmail(userId, target.status, status);
        } else {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating user:', error);
        return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }
}
