'use client';

import { createContext, useContext } from 'react';

interface AuthUser {
    id: string;
    email: string;
    role: string;
    full_name?: string;
    division?: string;
    station_id?: string;
    status?: string;
    avatar_url?: string;
    phone?: string;
    nik?: string;
    station?: { id: string; code: string; name: string };
    unit?: { name: string };
    position?: { name: string };
}

interface AuthContextType {
    user: AuthUser | null;
    loading: boolean;
    refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    refresh: async () => {},
});

export function useAuthContext() {
    return useContext(AuthContext);
}
