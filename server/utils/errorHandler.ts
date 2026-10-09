import type { H3Event } from 'h3'
import { findDomainError, toDomainHttpError } from './mapDomainError'

const TRUSTED_ERROR_CODES = new Set([
  'VALIDATION_FAILED',
  'NOT_FOUND',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'CONFLICT',
  'RATE_LIMITED',
  'DATABASE_UNAVAILABLE',
  'SERVICE_BUSY',
])

// Prisma driver failures carry a `P####` code but no HTTP semantics of their own.
const PRISMA_CODE = /^P\d{4}$/

// An error a handler already logged must not be logged a second time by the
// Nitro `error` hook. Non-enumerable and a symbol, so it never reaches the client.
const LOGGED = Symbol.for('groupThera:errorLogged')

type PrismaErrorLike = { code: string, meta?: { target?: string[] } }

function markLogged<T>(error: T): T {
  if (error && typeof error === 'object') {
    Object.defineProperty(error, LOGGED, { value: true, configurable: true })
  }
  return error
}

export function isLogged(error: unknown): boolean {
  return !!error
    && typeof error === 'object'
    && (error as Record<symbol, unknown>)[LOGGED] === true
}

export function isPrismaError(error: unknown): error is PrismaErrorLike {
  return !!error
    && typeof error === 'object'
    && typeof (error as { code?: unknown }).code === 'string'
    && PRISMA_CODE.test((error as { code: string }).code)
}

/**
 * Finds the driver error behind a failure.
 *
 * h3 wraps anything thrown in a handler with `createError()`, which builds a new
 * H3Error copying only message/stack/data/statusCode/statusMessage — the `code`
 * field is dropped and the original survives as `cause`. So by the time an error
 * reaches Nitro's `onError`, `P1001` is one level down, not on the error itself.
 * The walk is depth-limited in case a cause chain ever points back at itself.
 */
export function findPrismaError(error: unknown): PrismaErrorLike | null {
  let current: unknown = error

  for (let depth = 0; current && depth < 5; depth += 1) {
    if (isPrismaError(current)) return current
    current = (current as { cause?: unknown }).cause
  }

  return null
}

/**
 * Whether a Prisma failure should decide the response. An H3Error whose status a
 * handler already chose deliberately (a 404 or 409 it threw itself) wins; only an
 * unshaped 500 is remapped.
 */
export function isUnhandledPrismaFailure(error: unknown): boolean {
  if (!findPrismaError(error)) return false

  const statusCode = (error as { statusCode?: unknown } | null)?.statusCode
  return statusCode === undefined || statusCode === 500
}

/**
 * Whether a domain failure should decide the response. Same rule as above: a handler that
 * already shaped the error (including one that called `mapDomainError` itself) wins, and
 * only the unshaped 500 h3 wrapped around a raw `DomainError` is remapped. Most handlers
 * call a service directly with no try/catch, so without this a `NotFoundError` reached
 * the client as an opaque 500 INTERNAL.
 */
export function isUnhandledDomainFailure(error: unknown): boolean {
  if (!findDomainError(error)) return false

  const statusCode = (error as { statusCode?: unknown } | null)?.statusCode
  return statusCode === undefined || statusCode === 500
}

/**
 * Writes one log line per failure: `warn` for the 4xx a client caused, `error`
 * for the 5xx we caused. Shared by `sanitizeError`, the Nitro `error` hook and
 * the Nitro `errorHandler` so every source reports in the same shape.
 */
export function logHandlerError(
  error: unknown,
  context: { source: string, event?: H3Event },
) {
  const rawStatusCode = (error as { statusCode?: unknown } | null)?.statusCode
  const statusCode = typeof rawStatusCode === 'number' ? rawStatusCode : 500
  const rawMessage = (error as { message?: string } | null)?.message ?? ''
  // Prisma messages span several lines, which would push `path=` off the first
  // line and break one-line-per-error log grepping.
  const message = rawMessage.replace(/\s+/g, ' ').trim() || 'Unknown error'

  const event = context.event
  // Query strings can carry OAuth codes and tokens, so only the path is logged.
  const rawPath = event?.path || event?.node?.req?.url
  const path = rawPath?.split('?')[0] || 'unknown'

  // The P-code decides the response, so it belongs on the greppable first line:
  // the attached error object keeps it under `[cause]` only in production, where
  // Node's inspector prints own properties. Dev loggers flatten a cause to its
  // message and stack, which would leave a schema-drift 500 unidentifiable.
  const prismaCode = findPrismaError(error)?.code
  const suffix = ` path=${path}${prismaCode ? ` prisma=${prismaCode}` : ''}`

  markLogged(error)

  if (statusCode >= 400 && statusCode < 500) {
    console.warn(`[${context.source}] ${statusCode} ${message}${suffix}`)
    return
  }

  console.error(`[${context.source}] ${statusCode} ${message}${suffix}`, error)
}

/**
 * Logs an error captured by the Nitro runtime `error` hook.
 *
 * The hook receives a context wrapper (`{ event, tags }`), not the event itself.
 * Raw Prisma failures are mapped first so the logged status matches the response.
 */
export function logCapturedError(error: unknown, context?: { event?: H3Event }) {
  logHandlerError(toHttpError(error), { source: 'unhandled', event: context?.event })
}

/**
 * Turns an unshaped failure into the HTTP error the client will receive: a raw Prisma
 * driver error into its mapped status, a raw `DomainError` into the 4xx it stands for.
 * Anything a handler already shaped passes through untouched.
 *
 * Shared by `logCapturedError` and the Nitro `errorHandler`, so the status written to the
 * log line and the status sent over the wire cannot disagree.
 */
export function toHttpError(error: unknown): unknown {
  if (isUnhandledPrismaFailure(error)) return mapPrismaError(error, 'prisma')
  if (isUnhandledDomainFailure(error)) return toDomainHttpError(error)

  return error
}

export function sanitizeError(error: unknown, context: string) {
  logHandlerError(error, { source: context })

  if (
    error
    && typeof error === 'object'
    && 'statusCode' in error
    && typeof (error as { statusCode: unknown }).statusCode === 'number'
  ) {
    const httpError = error as {
      statusCode: number
      statusMessage?: string
      data?: { code?: string, field?: string }
    }

    if (httpError.data?.code && TRUSTED_ERROR_CODES.has(httpError.data.code)) {
      return markLogged(createError({
        statusCode: httpError.statusCode,
        statusMessage: httpError.statusMessage || 'Request failed',
        data: { code: httpError.data.code, ...(httpError.data.field ? { field: httpError.data.field } : {}) },
      }))
    }

    return markLogged(createError({
      statusCode: httpError.statusCode || 500,
      statusMessage: 'Request failed',
      data: { code: 'INTERNAL' },
    }))
  }

  return markLogged(createError({
    statusCode: 500,
    statusMessage: 'Internal server error',
    data: { code: 'INTERNAL' },
  }))
}

/**
 * Maps a Prisma driver failure onto an HTTP error, accepting either the raw
 * driver error or the H3Error h3 wrapped around it. Pure: it never logs, because
 * the Nitro `error` hook logs whatever a handler ends up throwing.
 * Anything without a Prisma error in its cause chain falls through to
 * `sanitizeError`, so an already-shaped H3Error keeps its status and trusted code.
 */
export function mapPrismaError(error: unknown, context: string) {
  const prismaError = findPrismaError(error)

  if (!prismaError) {
    return sanitizeError(error, context)
  }

  switch (prismaError.code) {
    case 'P2002': {
      const field = prismaError.meta?.target?.[0] || 'field'
      return createError({
        statusCode: 409,
        statusMessage: `${field} already exists`,
        data: { code: 'CONFLICT', field },
        cause: prismaError,
      })
    }

    case 'P2025':
      return createError({
        statusCode: 404,
        statusMessage: 'Not found',
        data: { code: 'NOT_FOUND' },
        cause: prismaError,
      })

    case 'P2003':
      return createError({
        statusCode: 400,
        statusMessage: 'Related record exists',
        data: { code: 'VALIDATION_FAILED' },
        cause: prismaError,
      })

    case 'P2014':
      return createError({
        statusCode: 400,
        statusMessage: 'Required related record missing',
        data: { code: 'VALIDATION_FAILED' },
        cause: prismaError,
      })

    // Unreachable database, missing database, timed out query or transaction —
    // all recoverable without a deploy, so the client is told to retry.
    case 'P1001':
    case 'P1002':
    case 'P1003':
    case 'P5003':
      return createError({
        statusCode: 503,
        statusMessage: 'Database temporarily unavailable',
        data: { code: 'DATABASE_UNAVAILABLE' },
        cause: prismaError,
      })

    case 'P2024':
      return createError({
        statusCode: 503,
        statusMessage: 'Service temporarily busy',
        data: { code: 'SERVICE_BUSY' },
        cause: prismaError,
      })

    // Schema drift (P2021/P2022/P2023 — a migration that was never applied) and
    // any undocumented P-code land here. Nothing a client can act on, so the body
    // stays generic; the P-code reaches the operator via `cause` and the log line.
    default:
      return createError({
        statusCode: 500,
        statusMessage: 'Internal server error',
        data: { code: 'INTERNAL' },
        cause: prismaError,
      })
  }
}
