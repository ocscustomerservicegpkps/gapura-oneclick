import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth-utils';
import { sendTestEmail } from '@/lib/notifications';

async function checkAuth() {
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    if (!token) return null;

    const session = await verifySession(token);
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'ANALYST')) {
        return null;
    }

    return session;
}

export async function POST(req: Request) {
    const user = await checkAuth();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { email } = await req.json();
        if (!email || !email.includes('@')) {
            return NextResponse.json({ error: 'Email tidak valid' }, { status: 400 });
        }


        await sendTestEmail({
            to: email,
            // full_name is optional on SessionPayload and can be undefined;
            // email is always present and comes from the verified session.
            requestedBy: `${user.email} (${user.role})`,
            subject: '[OneClick] Test Konfigurasi Email Notifikasi'
        });

        return NextResponse.json({ success: true, message: `Email test berhasil dikirim ke ${email}.` });
    } catch (err) {
        console.error('[NOTIFICATIONS] Test email failed:', err);
        return NextResponse.json({
            error: 'Failed to send test email'
        }, { status: 500 });
    }
}
