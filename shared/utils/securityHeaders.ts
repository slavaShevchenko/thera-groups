/**
 * HSTS a browser is asked to remember. Five minutes, deliberately.
 *
 * The header cannot be revoked: after seeing `max-age=31536000` a browser refuses plain
 * HTTP for that host for a year, and with `includeSubDomains` it refuses it for every
 * subdomain as well — including one whose certificate later lapses. A first deploy has no
 * way to know that yet, so it starts small and is raised on purpose. See
 * `docs/deployment.md` → "HSTS rollout".
 */
export const DEFAULT_HSTS_MAX_AGE = 300

const NON_NEGATIVE_INTEGER = /^\d+$/

/**
 * Builds the header from the environment, so raising it is a config change and a restart
 * rather than a code edit. Anything that is not a non-negative integer falls back to the
 * default: a typo must not be able to ship `max-age=abc`, which browsers ignore entirely,
 * nor a value nobody reviewed.
 */
export function buildHstsHeader(
  env: Record<string, string | undefined> = {},
): string {
  const raw = env.HSTS_MAX_AGE?.trim() ?? ''
  const maxAge = NON_NEGATIVE_INTEGER.test(raw) ? raw : String(DEFAULT_HSTS_MAX_AGE)
  const includeSubDomains = env.HSTS_INCLUDE_SUBDOMAINS?.trim().toLowerCase() === 'true'

  return `max-age=${maxAge}${includeSubDomains ? '; includeSubDomains' : ''}`
}
