import type { H3Event } from 'h3'
import { isLocalhostUrl, useServerConfig } from './config'

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
