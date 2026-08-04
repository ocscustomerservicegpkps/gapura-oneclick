
const NUMBER_RE = /(?<![A-Za-z_])(\d{1,3}(?:,\d{3})+|\d+,\d{1,2}(?!\d)|\d+(?:\.\d+)?)(?:\s*%)?/g;

function parseNumber(token: string): number | null {
  const trimmed = token.replace(/%$/, '').trim();

  // Decimal comma: "12,5" means 12.5, distinct from the ",\d{3}" thousands
  // grouping handled below.
  if (/^\d+,\d{1,2}$/.test(trimmed)) {
    const n = Number(trimmed.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  let cleaned = trimmed.replace(/,/g, '');
  // Indonesian thousands separator: "5.000" means 5000, not 5.0.
  if (/^\d{1,3}(?:\.\d{3})+$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, '');
  }
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function collectAllowedNumbers(source: unknown, bag = new Set<number>()): Set<number> {
  if (source == null) return bag;
  if (typeof source === 'number' && Number.isFinite(source)) {
    bag.add(source);
    bag.add(Math.round(source));
    return bag;
  }
  if (typeof source === 'string') {
    let m: RegExpExecArray | null;
    const re = new RegExp(NUMBER_RE);
    while ((m = re.exec(source)) != null) {
      const n = parseNumber(m[1]);
      if (n != null) {
        bag.add(n);
        bag.add(Math.round(n));
      }
    }
    return bag;
  }
  if (Array.isArray(source)) {
    for (const item of source) collectAllowedNumbers(item, bag);
    return bag;
  }
  if (typeof source === 'object') {
    for (const v of Object.values(source as Record<string, unknown>)) collectAllowedNumbers(v, bag);
  }
  return bag;
}

export function isGrounded(value: number, allowed: Set<number>, tolerance = 1): boolean {
  if (allowed.has(value) || allowed.has(Math.round(value))) return true;
  // Percentages/shares: `allowed` stores integer percents, so a decimal like
  // "12,5%" is grounded only when it lands within `tolerance` of a real figure.
  // A fabricated decimal ("turun 37,4%") that matches nothing is now rejected,
  // instead of being blanket-accepted just for being in the 0–100 range.
  for (const a of allowed) {
    if (Math.abs(a - value) <= tolerance) return true;
  }
  return false;
}

export function stripUngroundedSentences(text: string, allowed: Set<number>): string {
  if (!text) return text;
  const sentences = text.split(/(?<=[.!?])\s+/);
  const kept: string[] = [];
  for (const s of sentences) {
    const numbers = Array.from(s.matchAll(NUMBER_RE))
      .map((m) => parseNumber(m[1]))
      .filter((n): n is number => n != null);
    if (numbers.every((n) => isGrounded(n, allowed))) kept.push(s);
  }
  return kept.join(' ').trim();
}

export function filterGroundedBullets(items: string[], allowed: Set<number>): string[] {
  return items.filter((item) => {
    const numbers = Array.from(String(item).matchAll(NUMBER_RE))
      .map((m) => parseNumber(m[1]))
      .filter((n): n is number => n != null);
    return numbers.every((n) => isGrounded(n, allowed));
  });
}
