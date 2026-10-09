import type { BackToSource } from '~~/types'

export const BACK_TO_KEY = 'psyGroup.backTo'

export type { BackToSource } from '~~/types'

// The link is set immediately before navigating to a group, so an older entry is debris
// from earlier browsing and must not be attached to an unrelated group.
const BACK_TO_MAX_AGE_MS = 5_000

interface StoredBackTo {
  source: BackToSource
  at: number
}

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

function readStoredBackTo(): StoredBackTo | null {
  const raw = safeGetSessionStorage(BACK_TO_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<StoredBackTo>
    if (typeof parsed?.source !== 'string' || typeof parsed?.at !== 'number') return null
    return { source: parsed.source, at: parsed.at }
  }
  catch {
    // A tab left open across a deploy still holds the old bare-string format.
    return null
  }
}

function isPageReload(): boolean {
  if (typeof window === 'undefined') return false

  const entries = window.performance?.getEntriesByType?.('navigation') as PerformanceNavigationTiming[] | undefined
  return entries?.[0]?.type === 'reload'
}

export function setBackTo(source: BackToSource) {
  const stored: StoredBackTo = { source, at: Date.now() }
  safeSetSessionStorage(BACK_TO_KEY, JSON.stringify(stored))
}

export function clearBackTo() {
  safeRemoveSessionStorage(BACK_TO_KEY)
}

/**
 * The pending back link, or null when there is none worth showing.
 *
 * Deliberately does not clear on success: the entry has to survive a refresh of the group
 * page, which used to lose its "back to catalog" link because the first mount consumed it.
 * Staleness is what keeps it from leaking instead — an entry older than the navigation that
 * created it is dropped, unless this document load is itself a reload.
 */
export function takeBackTo(): BackToSource | null {
  const stored = readStoredBackTo()
  if (!stored) return null

  if (!isPageReload() && Date.now() - stored.at > BACK_TO_MAX_AGE_MS) {
    clearBackTo()
    return null
  }

  return stored.source
}
