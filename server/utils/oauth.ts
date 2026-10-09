import type { H3Event } from 'h3'
import type { GoogleSignupRole } from '../validators/auth'

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
