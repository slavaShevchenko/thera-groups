export const STATUS_COLORS = {
  success: { background: '#D1FAE5', color: '#065F46' },
  warning: { background: '#FEF3C7', color: '#92400E' },
  error: { background: '#FEE2E2', color: '#991B1B' },
} as const

export const APPLICATION_STATUS_COLORS: Record<string, { background: string, color: string }> = {
  PENDING: STATUS_COLORS.warning,
  APPROVED: STATUS_COLORS.success,
  REJECTED: STATUS_COLORS.error,
}

export const GROUP_STATUS_COLORS: Record<string, { background: string, color: string }> = {
  PENDING_REVIEW: STATUS_COLORS.warning,
  PUBLISHED: STATUS_COLORS.success,
  REJECTED: STATUS_COLORS.error,
}
