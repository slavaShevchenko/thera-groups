import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { BACK_TO_KEY, clearBackTo, setBackTo, takeBackTo } from '~~/app/utils/backTo'

const NOW = 1_700_000_000_000

/**
 * backTo.ts talks to bare `window`, `sessionStorage` and the Navigation Timing API, none
 * of which exist in the node environment the suite runs in.
 */
function stubStorage() {
  const store = new Map<string, string>()

  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
  })

  return store
}

function stubNavigationType(type?: string) {
  vi.stubGlobal('window', {
    performance: {
      getEntriesByType: (entryType: string) =>
        entryType === 'navigation' && type ? [{ type }] : [],
    },
  })
}

function stubBrowser(navigationType?: string) {
  const store = stubStorage()
  stubNavigationType(navigationType)
  return store
}

describe('backTo', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('stores the source with the moment it was set', () => {
    const store = stubBrowser('navigate')

    setBackTo('catalog')

    expect(JSON.parse(store.get(BACK_TO_KEY)!)).toEqual({ source: 'catalog', at: NOW })
  })

  it('returns the pending source right after a navigation to the group', () => {
    stubBrowser('navigate')
    setBackTo('my')

    expect(takeBackTo()).toBe('my')
  })

  it('keeps the source across a reload, which is the case that used to lose it', () => {
    const store = stubBrowser('navigate')
    setBackTo('catalog')

    // The reload happens a minute later, long past the staleness window, and keeps the
    // same storage — only the navigation type changes.
    vi.mocked(Date.now).mockReturnValue(NOW + 60_000)
    stubNavigationType('reload')

    expect(takeBackTo()).toBe('catalog')
    expect(store.has(BACK_TO_KEY)).toBe(true)
  })

  it('drops and clears a stale entry when this is a fresh navigation', () => {
    const store = stubBrowser('navigate')
    setBackTo('catalog')

    vi.mocked(Date.now).mockReturnValue(NOW + 60_000)

    expect(takeBackTo()).toBeNull()
    expect(store.has(BACK_TO_KEY)).toBe(false)
  })

  it('ignores the bare-string format a tab left open across a deploy still holds', () => {
    const store = stubBrowser('navigate')
    store.set(BACK_TO_KEY, 'catalog')

    expect(takeBackTo()).toBeNull()
  })

  it('ignores malformed JSON', () => {
    const store = stubBrowser('navigate')
    store.set(BACK_TO_KEY, '{not json')

    expect(takeBackTo()).toBeNull()
  })

  it('returns null when nothing was stored', () => {
    stubBrowser('navigate')

    expect(takeBackTo()).toBeNull()
  })

  it('clears on demand', () => {
    const store = stubBrowser('navigate')
    setBackTo('favorites')

    clearBackTo()

    expect(store.has(BACK_TO_KEY)).toBe(false)
    expect(takeBackTo()).toBeNull()
  })

  it('is inert during SSR, where there is no window', () => {
    vi.stubGlobal('window', undefined)
    vi.stubGlobal('sessionStorage', undefined)

    expect(() => setBackTo('catalog')).not.toThrow()
    expect(takeBackTo()).toBeNull()
  })
})
