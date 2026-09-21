import type { BackToSource } from '~~/types'

export const BACK_TO_KEY = 'psyGroup.backTo'

export type { BackToSource } from '~~/types'

function safeGetSessionStorage(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return sessionStorage.getItem(key)
  }
  catch {
    return null
  }
}

function safeSetSessionStorage(key: string, value: string) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(key, value)
  }
  catch {
    // silently ignore — private browsing or quota exceeded
  }
}

function safeRemoveSessionStorage(key: string) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(key)
  }
  catch {
    // silently ignore
  }
}

export function setBackTo(source: BackToSource) {
  safeSetSessionStorage(BACK_TO_KEY, source)
}

export function readBackTo(): BackToSource | null {
  return safeGetSessionStorage(BACK_TO_KEY) as BackToSource | null
}

export function clearBackTo() {
  safeRemoveSessionStorage(BACK_TO_KEY)
}

export function consumeBackTo(): BackToSource | null {
  const value = readBackTo()
  if (value) {
    clearBackTo()
  }
  return value
}
