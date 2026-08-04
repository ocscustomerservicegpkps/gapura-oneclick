
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OSReportsPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/dashboard/os?view=reports');
    }, [router]);
    return null;
}
