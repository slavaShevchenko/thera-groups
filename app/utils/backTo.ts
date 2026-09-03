import type { BackToSource } from '~~/types'

export const BACK_TO_KEY = 'theraGroups.backTo'

export type { BackToSource } from '~~/types'

export function setBackTo(source: BackToSource) {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(BACK_TO_KEY, source)
}

export function consumeBackTo(): BackToSource | null {
  if (typeof window === 'undefined') return null
  const value = sessionStorage.getItem(BACK_TO_KEY) as BackToSource | null
  if (value) {
    sessionStorage.removeItem(BACK_TO_KEY)
  }
  return value
}
