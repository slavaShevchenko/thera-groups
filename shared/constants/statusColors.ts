export const GROUP_STATUS_COLORS: Record<string, { background: string, color: string }> = {
  DRAFT: { background: 'var(--color-status-pending-bg)', color: 'var(--color-status-pending-text)' },
  PENDING_REVIEW: { background: 'var(--color-status-warning-bg)', color: 'var(--color-status-warning-text)' },
  PUBLISHED: { background: 'var(--color-status-success-bg)', color: 'var(--color-status-success-text)' },
  REJECTED: { background: 'var(--color-status-error-bg)', color: 'var(--color-status-error-text)' },
  FULL: { background: 'var(--color-status-info-bg)', color: 'var(--color-status-info-text)' },
  COMPLETED: { background: 'var(--color-status-pending-bg)', color: 'var(--color-status-pending-text)' },
  CANCELLED: { background: 'var(--color-status-error-bg)', color: 'var(--color-status-error-text)' },
}

export const APPLICATION_STATUS_COLORS: Record<string, { background: string, color: string }> = {
  PENDING: { background: 'var(--color-status-warning-bg)', color: 'var(--color-status-warning-text)' },
  APPROVED: { background: 'var(--color-status-success-bg)', color: 'var(--color-status-success-text)' },
  REJECTED: { background: 'var(--color-status-error-bg)', color: 'var(--color-status-error-text)' },
  WITHDRAWN: { background: 'var(--color-status-pending-bg)', color: 'var(--color-status-pending-text)' },
}
