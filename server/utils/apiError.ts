import type { ErrorCode } from './errorCodes'

/**
 * Builds the HTTP error a handler throws.
 *
 * `cause` carries the underlying driver failure (Supabase storage, GoTrue, …) into the
 * single log line the Nitro `error` hook writes: h3 keeps `cause` out of the response
 * body, but `logHandlerError` walks the chain, so the real reason reaches the operator
 * without the handler writing its own second `console.error`.
 */
export function apiError(
  statusCode: number,
  code: ErrorCode,
  message: string,
  data?: Record<string, unknown>,
  cause?: unknown,
) {
  return createError({
    statusCode,
    statusMessage: message,
    data: { code, ...data },
    ...(cause === undefined ? {} : { cause }),
  })
}
