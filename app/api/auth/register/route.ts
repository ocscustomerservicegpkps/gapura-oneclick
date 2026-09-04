
import { after, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { hashPassword } from '@/lib/auth-utils';
import { checkDbRateLimit, getClientIpFromRequest } from '@/lib/security/rate-limit';
import { notifyNewStaffRegistration } from '@/lib/notifications';

export async function POST(request: Request) {
    try {
        const clientIp = getClientIpFromRequest(request);
        const rateLimit = await checkDbRateLimit(`register:${clientIp}`, 3, 60 * 60_000);
        if (!rateLimit.success) {
            return NextResponse.json({ error: 'Terlalu banyak registrasi. Try again later.' }, { status: 429 });
        }

        const body = await request.json();
        const {
            email,
            password,
            full_name,
            nik,
            phone,
            station_id,
            unit_kerja,
            jabatan,
            division,
        } = body;

        let stationRow: { id: string; code: string } | null = null;

        const { data: byId } = await supabase
            .from('stations')
            .select('id, code')
            .eq('id', station_id)
            .single();
        if (byId) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            stationRow = byId as any;
        } else {

            const { data: byCode } = await supabase
                .from('stations')
                .select('id, code')
                .eq('code', String(station_id).toUpperCase())
                .single();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (byCode) stationRow = byCode as any;
        }

        if (!stationRow) {
            return NextResponse.json(
                { error: 'Station tidak valid' },
                { status: 400 }
            );
        }

        const stationCode = String(stationRow.code || '').toUpperCase();
        const isKPS = stationCode === 'KPS' || stationCode === 'GPS';

        if (!email || !password || !full_name || !nik || !phone || !station_id) {
             return NextResponse.json(
                { error: 'All field wajib diisi' },
                { status: 400 }
            );
        }

        const KPS_DIVISIONS = ['OP', 'OS', 'UQ', 'OT', 'OCS'];
        const DIVISIONS_WITHOUT_JABATAN = ['UQ', 'OT'];
        const KPS_JABATAN_OPTIONS = ['Staff', 'Analyst', 'Division Head', 'Group Head', 'VP'];
        // Head-office leadership positions get the ANALYST role scoped to their division.
        const KPS_ANALYST_POSITIONS = ['Analyst', 'Division Head', 'Group Head', 'VP'];
        // Branch positions are a closed set — the role comes from this choice,
        // no longer from the email domain.
        const BRANCH_JABATAN_OPTIONS = ['Manager', 'Staff'];

        const unitText = typeof unit_kerja === 'string' ? unit_kerja.trim() : '';
        const jabatanText = typeof jabatan === 'string' ? jabatan.trim() : '';
        const divisionInput = typeof division === 'string' ? division.trim().toUpperCase() : '';

        if (isKPS) {
            if (!KPS_DIVISIONS.includes(divisionInput)) {
                return NextResponse.json(
                    { error: 'Divisi tidak valid' },
                    { status: 400 }
                );
            }
            if (!DIVISIONS_WITHOUT_JABATAN.includes(divisionInput) && !KPS_JABATAN_OPTIONS.includes(jabatanText)) {
                return NextResponse.json(
                    { error: 'Jabatan tidak valid' },
                    { status: 400 }
                );
            }
        } else {
            if (!unitText || unitText.length > 80) {
                return NextResponse.json(
                    { error: 'Unit kerja wajib diisi (maks. 80 karakter)' },
                    { status: 400 }
                );
            }
            if (!BRANCH_JABATAN_OPTIONS.includes(jabatanText)) {
                return NextResponse.json(
                    { error: 'Jabatan tidak valid' },
                    { status: 400 }
                );
            }
        }

        if (password.length < 8) {
            return NextResponse.json(
                { error: 'Password minimal 8 karakter' },
                { status: 400 }
            );
        }
        if (password.length > 128) {
            return NextResponse.json(
                { error: 'Password maksimal 128 karakter' },
                { status: 400 }
            );
        }
        if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
            return NextResponse.json(
                { error: 'Password harus mengandung huruf besar, huruf kecil, dan angka' },
                { status: 400 }
            );
        }

        const nikRegex = /^[A-Z0-9]{5,10}$/i;
        if (!nikRegex.test(nik)) {
            return NextResponse.json(
                { error: 'NIK harus 5-10 karakter (huruf/angka)' },
                { status: 400 }
            );
        }

        const phoneRegex = /^08\d{8,11}$/;
        if (!phoneRegex.test(phone)) {
            return NextResponse.json(
                { error: 'Nomor HP harus dimulai 08 dan 10-13 digit' },
                { status: 400 }
            );
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                { error: 'Format email tidak valid' },
                { status: 400 }
            );
        }

        const { data: existingEmail } = await supabase
            .from('users')
            .select('id')
            .eq('email', email.toLowerCase())
            .single();

        if (existingEmail) {
            return NextResponse.json(
                { error: 'Email sudah terdaftar' },
                { status: 400 }
            );
        }

        const { data: existingNik } = await supabase
            .from('users')
            .select('id')
            .eq('nik', nik.toUpperCase())
            .single();

        if (existingNik) {
            return NextResponse.json(
                { error: 'NIK sudah terdaftar' },
                { status: 400 }
            );
        }

        const hashedPassword = await hashPassword(password);

        let role: string;
        let userDivision: string;
        let unitValue: string | null;
        let positionValue: string | null;

        if (isKPS) {
            // Divisi + jabatan dipetakan ke role: Analyst/Division Head/Group
            // Head/VP -> ANALYST (tetap terikat divisinya), Staff ->
            // DIVISI_<divisi>; UQ/OT tanpa jabatan.
            userDivision = divisionInput;
            unitValue = null;
            if (DIVISIONS_WITHOUT_JABATAN.includes(divisionInput)) {
                role = `DIVISI_${divisionInput}`;
                positionValue = null;
            } else if (KPS_ANALYST_POSITIONS.includes(jabatanText)) {
                role = 'ANALYST';
                positionValue = jabatanText;
            } else {
                role = `DIVISI_${divisionInput}`;
                positionValue = jabatanText;
            }
        } else {
            role = jabatanText === 'Manager' ? 'MANAGER_CABANG' : 'STAFF_CABANG';
            userDivision = 'GENERAL';
            unitValue = unitText;
            positionValue = jabatanText;
        }

        const userData = {
            email: email.toLowerCase(),
            password: hashedPassword,
            full_name: full_name.trim(),
            nik: nik.toUpperCase(),
            phone,
            station_id: stationRow.id,
            unit_id: unitValue,
            position_id: positionValue,
            role,
            division: userDivision,
            status: 'pending',
        };

        const { data: insertedUser, error: insertError } = await supabase
            .from('users')
            .insert(userData)
            .select('id')
            .single();

        if (insertError) {
            console.error('Insert error:', insertError);
            if (insertError.code === '23505') {
                const isNikConflict = insertError.message?.includes('nik');
                return NextResponse.json(
                    { error: isNikConflict ? 'NIK sudah terdaftar' : 'Email sudah terdaftar' },
                    { status: 400 }
                );
            }
            return NextResponse.json(
                { error: 'Gagal mendaftarkan user. Silakan coba lagi.' },
                { status: 500 }
            );
        }

        // Branch managers approve STAFF_CABANG at their own station, so they get
        // told as soon as one registers. Sent after the response so a slow or
        // failing SMTP hop never blocks (or fails) the registration itself.
        if (role === 'STAFF_CABANG' && insertedUser?.id) {
            after(async () => {
                try {
                    await notifyNewStaffRegistration({
                        userId: insertedUser.id,
                        fullName: userData.full_name,
                        email: userData.email,
                        nik: userData.nik,
                        phone: userData.phone,
                        unit: unitValue,
                        position: positionValue,
                        stationId: stationRow.id,
                    });
                } catch (notifyError) {
                    console.warn('[AUTH_API] Manager registration notice failed (non-blocking):', notifyError);
                }
            });
        }

        return NextResponse.json({
            success: true,
            message: 'Registrasi berhasil. Mohon tunggu persetujuan admin.',
        });
    } catch (error) {
        console.error('Registration error:', error);
        return NextResponse.json(
            { error: 'Terjadi kesalahan server' },
            { status: 500 }
        );
    }
}
