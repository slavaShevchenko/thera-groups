/**
 * A post-login destination arrives in the query string, so an attacker can craft
 * `/auth/login?returnTo=//evil.com`. Only a same-origin absolute path is accepted:
 * `//host` and `/\host` are rejected because browsers resolve both as protocol-relative
 * URLs, and a backslash anywhere else is never part of a legitimate route.
 */
export function isSafeReturnTo(value: unknown): value is string {
  if (typeof value !== 'string' || !value.startsWith('/')) return false
  if (value.startsWith('//')) return false
  return !value.includes('\\')
}

export function resolveReturnTo(value: unknown, locale: string): string {
  return isSafeReturnTo(value) ? value : `/${locale}/`
}
