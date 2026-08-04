
import { DashboardFrame } from '@/components/layout/DashboardFrame';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth-utils';
import { redirect } from 'next/navigation';

export default async function MainDashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;

    const session = token ? await verifySession(token) : null;

    if (!session) {
        redirect('/auth/login');
    }

    return (
        <DashboardFrame role={session.role as string} division={(session.division as string) || null}>
            {children}
        </DashboardFrame>
    );
}
