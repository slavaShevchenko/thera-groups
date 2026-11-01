/**
 * Why a session was dropped, agreed between `/api/auth/me` and the client that reads it.
 *
 * `ACCOUNT_DISABLED` is the only value: an account whose `isActive` was flipped while its
 * cookie was still valid has to be told apart from one that simply never signed in, or the
 * login page cannot explain the redirect and the visitor signs straight back in to meet a
 * bare 403. Doubles as the `?reason=` query value so one token covers both hops.
 */
export const AUTH_SESSION_DISABLED = 'ACCOUNT_DISABLED'

/**
 * How long a resolved `/api/auth/me` answer is trusted before the route guard re-reads it.
 *
 * A ban has to reach a session that is already open, and re-reading on every navigation
 * would put a Supabase round-trip plus a database read behind every click.
 */
export const SESSION_MAX_AGE_MS = 60_000
