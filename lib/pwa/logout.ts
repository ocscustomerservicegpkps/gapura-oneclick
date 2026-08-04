"use client";

import { performOptimisticLogout } from "@/lib/auth/client-logout";

export function logoutWithPwaCleanup() {
    performOptimisticLogout();
}
