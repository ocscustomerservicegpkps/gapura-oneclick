
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@/types';
import { fetchWithDemo } from '@/lib/utils';

interface UseAuthReturn {

    user: User | null;

    loading: boolean;

    isAuthenticated: boolean;

    refresh: () => Promise<void>;
}

export function useAuth(redirectOnFail: boolean = true): UseAuthReturn {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchUser = useCallback(async (signal?: AbortSignal) => {
        try {
            const res = await fetchWithDemo('/api/auth/me', { signal } as RequestInit);
            if (res.ok) {
                const data = await res.json();
                setUser(data);
            } else if (redirectOnFail) {
                router.push('/auth/login');
            }
        } catch (error) {

            if (error instanceof DOMException && error.name === 'AbortError') return;
            console.error('Auth error:', error);
            if (redirectOnFail) {
                router.push('/auth/login');
            }
        } finally {
            setLoading(false);
        }
    }, [router, redirectOnFail]);

    useEffect(() => {

        const controller = new AbortController();
        fetchUser(controller.signal);
        return () => controller.abort();
    }, [fetchUser]);

    return {
        user,
        loading,
        isAuthenticated: !!user,
        refresh: fetchUser
    };
}
