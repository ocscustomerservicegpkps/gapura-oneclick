import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth-utils';
import { DivisionSelectClient } from './DivisionSelectClient';

export default async function DivisionSelectPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    const session = token ? await verifySession(token) : null;

    const role = String(session?.role || '').toUpperCase();
    const division = session?.division ? String(session.division).toUpperCase() : null;

    return <DivisionSelectClient role={role} division={division} />;
}
