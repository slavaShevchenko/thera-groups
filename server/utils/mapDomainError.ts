import { DomainError, NotFoundError, ForbiddenError, ConflictError, ValidationError } from './domainErrors'

export function mapDomainError(error: unknown): never {
  if (error instanceof NotFoundError) {
    throw createError({
      statusCode: 404,
      statusMessage: error.message,
      data: { code: error.code },
    })
  }
  if (error instanceof ForbiddenError) {
    throw createError({
      statusCode: 403,
      statusMessage: error.message,
      data: { code: error.code },
    })
  }
  if (error instanceof ConflictError) {
    throw createError({
      statusCode: 409,
      statusMessage: error.message,
      data: { code: error.code },
    })
  }
  if (error instanceof ValidationError) {
    throw createError({
      statusCode: 400,
      statusMessage: error.message,
      data: { code: error.code, ...(error.field ? { field: error.field } : {}) },
    })
  }
  if (error instanceof DomainError) {
    throw createError({
      statusCode: 400,
      statusMessage: error.message,
      data: { code: error.code },
    })
  }
  throw error as never
}
