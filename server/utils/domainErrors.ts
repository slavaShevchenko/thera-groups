export class DomainError extends Error {
  code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'DomainError'
    this.code = code
  }
}

export class NotFoundError extends DomainError {
  constructor(message = 'Not found') {
    super(message, 'NOT_FOUND')
    this.name = 'NotFoundError'
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Forbidden') {
    super(message, 'FORBIDDEN')
    this.name = 'ForbiddenError'
  }
}

export class ConflictError extends DomainError {
  constructor(message = 'Conflict') {
    super(message, 'CONFLICT')
    this.name = 'ConflictError'
  }
}

export class ValidationError extends DomainError {
  field?: string

  constructor(message: string, field?: string) {
    super(message, 'VALIDATION_FAILED')
    this.name = 'ValidationError'
    this.field = field
  }
}
