export type PillVariant = 'neutral' | 'primary' | 'success' | 'warning' | 'error' | 'info'

export const GROUP_STATUS_VARIANTS: Record<string, PillVariant> = {
  DRAFT: 'neutral',
  PENDING_REVIEW: 'warning',
  PUBLISHED: 'success',
  REJECTED: 'error',
  FULL: 'info',
  COMPLETED: 'neutral',
  CANCELLED: 'error',
}

export const APPLICATION_STATUS_VARIANTS: Record<string, PillVariant> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
  WITHDRAWN: 'neutral',
}
