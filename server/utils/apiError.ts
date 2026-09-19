import type { ErrorCode } from './errorCodes'

export function apiError(statusCode: number, code: ErrorCode, message: string, data?: Record<string, unknown>) {
  return createError({
    statusCode,
    statusMessage: message,
    data: { code, ...data },
  })
}
