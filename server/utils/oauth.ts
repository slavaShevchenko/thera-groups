import type { H3Event } from 'h3'
import type { GoogleSignupRole } from '../validators/auth'
import { isLocalhostUrl, useServerConfig } from './config'

const SIGNUP_ROLE_COOKIE = 'google_signup_role'

// Long enough to cover a round trip through Google, short enough that a forgotten cookie
// cannot decide the role of an unrelated sign-in later.
const SIGNUP_ROLE_MAX_AGE = 600

/**
 * Carries the role chosen on the sign-in page across the OAuth redirect.
 *
 * A cookie rather than OAuth `state`: Supabase generates its own state for PKCE and does
 * not round-trip custom values, and putting the role in `redirectTo` would mean another
 * URL to keep inside the Supabase redirect allowlist.
 */
export function setSignupRole(event: H3Event, role: GoogleSignupRole) {
  setCookie(event, SIGNUP_ROLE_COOKIE, role, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SIGNUP_ROLE_MAX_AGE,
  })
}

/**
 * The pending sign-up role, consumed on read so one choice cannot leak into the next
 * sign-in. Anything but an explicit `organizer` is a visitor.
 */
export function takeSignupRole(event: H3Event): GoogleSignupRole {
  const role = getCookie(event, SIGNUP_ROLE_COOKIE)
  deleteCookie(event, SIGNUP_ROLE_COOKIE, { path: '/' })

  return role === 'organizer' ? 'organizer' : 'visitor'
}

/**
 * The origin the provider sends the browser back to, without a trailing slash.
 *
 * `SITE_URL`, never the request's own host. Behind Vercel the function answers on whatever
 * hostname reached it — a preview's `*.vercel.app`, or the literal `localhost` h3 falls back
 * to when no `host` header survives — and `getRequestURL()` reports `http:` unless
 * `x-forwarded-proto` is present. Supabase checks `redirectTo` against its allowlist and, on
 * a miss, sends the browser to the project's Site URL rather than failing, so one origin that
 * is not on that list turns a production sign-in into a landing on `http://localhost:3000`
 * with nothing in the function logs to explain it.
 *
 * A localhost `SITE_URL` means dev, where the value is `nuxt.config.ts`'s fallback rather
 * than a decision: there the request origin wins, so a checkout on another port or a LAN
 * address can still sign in.
 */
export function oauthRedirectOrigin(event: H3Event): string {
  const configured = useServerConfig().siteUrl.replace(/\/+$/, '')

  if (configured && !isLocalhostUrl(configured)) return configured

  return getRequestURL(event).origin
}
