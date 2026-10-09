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

/**
 * The three 409s below carry their own code instead of the generic `CONFLICT` because the
 * visitor has to be told *which* door is closed: a full group may free a seat, an ended
 * one never will, and a group with applicants cannot be deleted at all. `CONFLICT` alone
 * would leave the UI guessing between three different messages.
 */
export class GroupFullError extends DomainError {
  constructor(message = 'Group is full') {
    super(message, 'GROUP_FULL')
    this.name = 'GroupFullError'
  }
}

export class GroupEndedError extends DomainError {
  constructor(message = 'Group has ended') {
    super(message, 'GROUP_ENDED')
    this.name = 'GroupEndedError'
  }
}

export class HasApplicationsError extends DomainError {
  constructor(message = 'Group has applications and cannot be deleted') {
    super(message, 'HAS_APPLICATIONS')
    this.name = 'HasApplicationsError'
  }
}
