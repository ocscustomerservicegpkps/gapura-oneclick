/**
 * Evidence URLs rendered as anchors for the chart export tables.
 *
 * These tables are handed to a grid that renders the string as HTML, and the
 * URLs come out of report rows that were filled in from the public form and the
 * Google Sheet — neither of which is trusted input. Five of the six chart data
 * modules built the anchor by interpolating the raw value straight into
 * `href="…"`, so a stored `javascript:` URL executed on click and a value
 * containing a quote could close the attribute and add markup of its own.
 *
 * Kept in one place because that drift is exactly how five of the six ended up
 * unsafe while hub-report was fixed.
 */

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** `null` for anything that is not an http(s) URL — notably `javascript:` and `data:`. */
export function toSafeHttpUrl(candidate: string): string | null {
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export interface EvidenceLinkOptions {
  /** Anchor text prefix — "Link 1", "Evidence 1", … */
  label?: string;
  /** Anchors rendered before the "+N more" suffix. */
  max?: number;
  separator?: string;
}

export function buildEvidenceLinkHtml(evidenceUrls: unknown, options: EvidenceLinkOptions = {}): string {
  const { label = 'Link', max = 3, separator = ' ' } = options;
  if (!evidenceUrls) return '-';

  const rawCandidates: string[] = Array.isArray(evidenceUrls)
    ? evidenceUrls.map(String)
    : typeof evidenceUrls === 'string'
      ? (() => {
          const trimmed = evidenceUrls.trim();
          if (!trimmed) return [];
          // A single URL can legitimately contain commas (query strings, path
          // segments), so only split when the whole value isn't already one
          // valid URL by itself.
          if (toSafeHttpUrl(trimmed)) return [trimmed];
          return trimmed.split(/[;\s]+/).filter(Boolean);
        })()
      : [];

  const urls = rawCandidates
    .map((candidate) => toSafeHttpUrl(candidate.trim()))
    .filter((url): url is string => url !== null);

  if (urls.length === 0) return '-';

  const shown = urls.slice(0, max);
  const suffix = urls.length > max ? ` +${urls.length - max} more` : '';
  const anchors = shown
    .map((url, index) => {
      const text = urls.length === 1 ? label : `${label} ${index + 1}`;
      return `<a href="${escapeHtmlAttr(url)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">${text}</a>`;
    })
    .join(separator);

  return anchors + suffix;
}
