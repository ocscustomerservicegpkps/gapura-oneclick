"use client";

import { purgePwaClientState } from "@/lib/pwa/client-state";
import { clearAiClientCache } from "@/lib/ai/client-cache";

const LOGOUT_ENDPOINT = "/api/auth/logout";
const LOGOUT_REDIRECT = "/auth/login?logout=1";

// How long to wait for the server to clear the session cookie before leaving
// anyway. Navigating first made the app *look* signed out while the cookie was
// still live, so the next click — Quick Access, say — hit the middleware with a
// valid session and got redirected to the dashboard.
const COOKIE_CLEAR_TIMEOUT_MS = 2500;

let logoutInFlight = false;

export async function performOptimisticLogout() {
  if (logoutInFlight) return;
  logoutInFlight = true;

  try {
    purgePwaClientState();
  } catch {}

  try {
    clearAiClientCache();
  } catch {}

  // keepalive still set: if the tab is closed mid-logout the request is
  // delivered anyway. The wait is capped so a hung request can never strand
  // the user on the page they just signed out of.
  const cleared = fetch(LOGOUT_ENDPOINT, {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: "{}",
  }).catch(() => {});

  await Promise.race([
    cleared,
    new Promise((resolve) => setTimeout(resolve, COOKIE_CLEAR_TIMEOUT_MS)),
  ]);

  window.location.replace(LOGOUT_REDIRECT);
}
