/**
 * Wraps a value for use inside a raw PostgREST filter string (`.or(...)`).
 *
 * PostgREST escapes inside a double-quoted value with a backslash, not by
 * doubling the quote the way SQL does. Doubling it produces `"a""b"`, which
 * PostgREST reads as the value `a` followed by stray tokens — so a crafted
 * identifier can close the quoted value and append filter clauses of its own to
 * the surrounding `or` group.
 *
 * The backslash has to be escaped first; escaping the quote first would then go
 * on to escape the backslash just added.
 */
export function quoteForPostgrestFilter(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
