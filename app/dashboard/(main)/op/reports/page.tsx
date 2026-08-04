'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OPReportsPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/dashboard/op?view=reports');
    }, [router]);

    return null;
}
