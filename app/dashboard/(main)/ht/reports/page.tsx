
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HTReportsPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/dashboard/ht?view=reports');
    }, [router]);
    return null;
}
