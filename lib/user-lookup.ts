import 'server-only';
import { supabaseAdmin } from '@/lib/supabase-admin';

interface RegisteredReporter {
  userId: string;
  fullName: string | null;
}

/**
 * Resolve a public-form reporter e-mail to a registered user, so a submission
 * made with a known e-mail is attributed to that account instead of being
 * anonymous. Match is case-insensitive and whitespace-trimmed, and covers users
 * of any status (registered = owned). Returns null when no account matches or
 * the e-mail is blank.
 */
export async function findRegisteredUserByEmail(email: string): Promise<RegisteredReporter | null> {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;

  // Escape LIKE metacharacters (%, _, \) so an e-mail such as `a_b@x.com`
  // is matched literally rather than as a wildcard pattern.
  const escaped = normalized.replace(/[\\%_]/g, (c) => `\\${c}`);

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, full_name')
    .ilike('email', escaped)
    .limit(1)
    .maybeSingle();

  // A lookup failure (network/DB error) is not the same as "no match" — the
  // caller must be able to tell a transient error apart from a genuine
  // unregistered e-mail instead of silently treating both as anonymous.
  if (error) throw new Error(`findRegisteredUserByEmail lookup failed: ${error.message}`);
  if (!data) return null;
  return { userId: data.id as string, fullName: (data.full_name as string) ?? null };
}
