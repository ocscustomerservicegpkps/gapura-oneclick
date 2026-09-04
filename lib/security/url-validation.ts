/** Longest URL any of these fields should ever hold; well past a real link, short of a payload. */
export const MAX_STORED_URL_LENGTH = 2048;

/**
 * Is this a URL safe to persist and later render as a link?
 *
 * Only http(s). Without a scheme check, an admin-supplied `javascript:` or
 * `data:text/html,…` value is stored verbatim and becomes script execution the
 * moment something renders it as an `href` — which is exactly what the
 * resolution-evidence and external-link fields are for.
 */
export function isStorableHttpUrl(value: unknown): value is string {
  const raw = String(value ?? '').trim();
  if (!raw || raw.length > MAX_STORED_URL_LENGTH) return false;
  try {
    const { protocol } = new URL(raw);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}
