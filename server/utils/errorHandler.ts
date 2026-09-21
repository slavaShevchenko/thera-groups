const TRUSTED_ERROR_CODES = new Set([
  'VALIDATION_FAILED',
  'NOT_FOUND',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'CONFLICT',
  'RATE_LIMITED',
])

export function sanitizeError(error: unknown, context: string) {
  console.error(`[${context}]`, error)

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
      return createError({
        statusCode: httpError.statusCode,
        statusMessage: httpError.statusMessage || 'Request failed',
        data: { code: httpError.data.code, ...(httpError.data.field ? { field: httpError.data.field } : {}) },
      })
    }

    return createError({
      statusCode: httpError.statusCode || 500,
      statusMessage: 'Request failed',
      data: { code: 'INTERNAL' },
    })
  }

  return createError({
    statusCode: 500,
    statusMessage: 'Internal server error',
    data: { code: 'INTERNAL' },
  })
}

export function mapPrismaError(error: unknown, context: string) {
  if (error && typeof error === 'object' && 'code' in error) {
    const prismaError = error as {
      code: string
      meta?: { target?: string[] }
    }

    if (prismaError.code === 'P2002') {
      const field = prismaError.meta?.target?.[0] || 'field'
      return createError({
        statusCode: 409,
        statusMessage: `${field} already exists`,
        data: { code: 'CONFLICT', field },
      })
    }
    if (prismaError.code === 'P2025') {
      return createError({
        statusCode: 404,
        statusMessage: 'Not found',
        data: { code: 'NOT_FOUND' },
      })
    }
    if (prismaError.code === 'P2003') {
      return createError({
        statusCode: 400,
        statusMessage: 'Related record exists',
        data: { code: 'VALIDATION_FAILED' },
      })
    }
    if (prismaError.code === 'P2014') {
      return createError({
        statusCode: 400,
        statusMessage: 'Required related record missing',
        data: { code: 'VALIDATION_FAILED' },
      })
    }
  }

  return sanitizeError(error, context)
}
