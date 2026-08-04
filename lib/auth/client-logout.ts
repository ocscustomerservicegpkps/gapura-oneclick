"use client";

import { purgePwaClientState } from "@/lib/pwa/client-state";
import { clearAiClientCache } from "@/lib/ai/client-cache";

const LOGOUT_ENDPOINT = "/api/auth/logout";
const LOGOUT_REDIRECT = "/auth/login?logout=1";

let logoutInFlight = false;

export function performOptimisticLogout() {
  if (logoutInFlight) return;
  logoutInFlight = true;

  try {
    purgePwaClientState();
  } catch {}

  try {
    clearAiClientCache();
  } catch {}

  // ponytail: fire-and-forget with keepalive so the request survives navigation.
  // Server clears the cookie; if it fails, the middleware redirects on next request.
  fetch(LOGOUT_ENDPOINT, {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: "{}",
  }).catch(() => {});

  window.location.replace(LOGOUT_REDIRECT);
}
