/**
 * One canonical form for an email address, everywhere the server compares or stores one.
 *
 * `User.email` is `@unique` and every lookup goes through `findUnique({ where: { email } })`,
 * which PostgreSQL resolves with a byte-for-byte comparison. GoTrue, on the other hand,
 * stores addresses lower-cased and matches case-insensitively. Before this normalizer the
 * two disagreed: `User@Example.com` existed in `auth.users` as `user@example.com`, so a
 * second registration of `user@example.com` found no `public.User` row, concluded the auth
 * record was an orphan left by a failed sign-up, and **deleted somebody else's account**.
 *
 * The rule is therefore not cosmetic — it is what keeps the orphan-cleanup in
 * `register.post.ts` from being reachable with an address the victim spelled differently.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}
