import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/auth-utils';
import { getVirtualAssistantDailyLimit } from '@/lib/virtual-assistant';
import { VirtualAssistantChat } from '@/components/virtual-assistant/VirtualAssistantChat';

export const dynamic = 'force-dynamic';

export default async function VirtualAssistantPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    const session = token ? await verifySession(token) : null;

    if (!session) {
        redirect('/auth/login?next=/virtual-assistant');
    }

    return (
        <VirtualAssistantChat
            userEmail={session.email}
            dailyLimit={getVirtualAssistantDailyLimit()}
        />
    );
}
