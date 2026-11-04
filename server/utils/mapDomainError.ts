import { DomainError, ValidationError } from './domainErrors'

// Every subclass sets its own HTTP-facing code in domainErrors.ts, so one lookup replaces
// an instanceof ladder that has to be extended for each new error type.
const DOMAIN_STATUS: Record<string, number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  CONFLICT: 409,
  GROUP_FULL: 409,
  GROUP_ENDED: 409,
  HAS_APPLICATIONS: 409,
  VALIDATION_FAILED: 400,
}

/**
 * The only status messages a domain error is allowed to put on the wire.
 *
 * `DomainError.message` is written for a developer: it names the rule that broke and
 * sometimes quotes user input back (`Question "…" requires at least 2 options`). It is also
 * never localized, while every UI string goes through `t()` — so passing it through could
 * only ever show an untranslated internal sentence in a browser, and one carrying whatever
 * the caller had typed. Clients branch on `data.code` instead, and that is unchanged.
 *
 * A fixed phrase per code rather than one blanket string, because the three domain 409s
 * exist precisely so a caller can tell "no seats left" from "the group already ran".
 *
 * Nothing is lost from the operator's side: the original error stays on `cause`, and
 * `logHandlerError` walks that chain, so the real message is still what lands in the log.
 */
const DOMAIN_STATUS_MESSAGE: Record<string, string> = {
  NOT_FOUND: 'Not found',
  FORBIDDEN: 'Forbidden',
  CONFLICT: 'Conflict',
  GROUP_FULL: 'Group is full',
  GROUP_ENDED: 'Group has ended',
  HAS_APPLICATIONS: 'Group has applications',
  VALIDATION_FAILED: 'Validation failed',
}

/** Same generic phrase `sanitizeError` falls back to, so an unmapped code reads alike. */
const UNKNOWN_DOMAIN_STATUS_MESSAGE = 'Request failed'

/**
 * Finds the DomainError behind a failure.
 *
 * h3 wraps anything thrown in a handler with `createError()`, which builds a new H3Error
 * copying message/stack/data/statusCode/statusMessage and keeps the original as `cause`.
 * So a DomainError no handler caught is one level down by the time it reaches Nitro. The
 * walk is depth-limited in case a cause chain ever points back at itself.
 */
export function findDomainError(error: unknown): DomainError | null {
  let current: unknown = error

  for (let depth = 0; current && depth < 5; depth += 1) {
    if (current instanceof DomainError) return current
    current = (current as { cause?: unknown }).cause
  }

  return null
}

/**
 * Pure counterpart of `mapDomainError`: builds the HTTP error instead of throwing, so the
 * shared Nitro pipeline can map a DomainError that no handler caught. The original stays
 * reachable through `cause`, which is what puts its message in the log line.
 *
 * The return type is left inferred because `createError` resolves to h3's variant in the
 * Nitro build and to Nuxt's (optional `statusCode`) in the app build.
 */
export function toDomainHttpError(error: unknown) {
  const domainError = findDomainError(error)

  if (!domainError) return null

  return createError({
    statusCode: DOMAIN_STATUS[domainError.code] ?? 400,
    statusMessage: DOMAIN_STATUS_MESSAGE[domainError.code] ?? UNKNOWN_DOMAIN_STATUS_MESSAGE,
    data: {
      code: domainError.code,
      ...(domainError instanceof ValidationError && domainError.field ? { field: domainError.field } : {}),
    },
    cause: domainError,
  })
}

export function mapDomainError(error: unknown): never {
  throw toDomainHttpError(error) ?? error
}
