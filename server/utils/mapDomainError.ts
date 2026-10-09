import { DomainError, ValidationError } from './domainErrors'

// Every subclass sets its own HTTP-facing code in domainErrors.ts, so one lookup replaces
// an instanceof ladder that has to be extended for each new error type.
const DOMAIN_STATUS: Record<string, number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  CONFLICT: 409,
  VALIDATION_FAILED: 400,
}

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
    statusMessage: domainError.message,
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
