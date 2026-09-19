export function sanitizeError(error: unknown, context: string) {
  console.error(`[${context}]`, error)

  if (
    error
    && typeof error === 'object'
    && 'statusCode' in error
    && typeof (error as { statusCode: unknown }).statusCode === 'number'
  ) {
    const httpError = error as { statusCode: number, statusMessage?: string }
    return createError({
      statusCode: httpError.statusCode,
      statusMessage: httpError.statusMessage || 'Request failed',
    })
  }

  return createError({
    statusCode: 500,
    statusMessage: 'Internal server error',
  })
}
