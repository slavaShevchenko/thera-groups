import { LIMITS } from '~~/shared/constants/limits'

const POLL_INTERVAL = 30_000

export function useUnreadCount() {
  const count = ref(0)
  let intervalId: ReturnType<typeof setInterval> | null = null

  async function fetchCount() {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
    try {
      const data = await $fetch<{ count: number }>('/api/notifications/unread-count')
      count.value = data.count
    }
    catch {
      // Silent by design: poll failure keeps previous count
    }
  }

  function startPolling() {
    // The badge is browser-only state, and Nuxt throws on setInterval during SSR.
    // AppHeader starts polling from an immediate watch on isAuthenticated, which used to
    // be false on the server only because the session never resolved there — so this ran
    // client-side by accident. Guarding here keeps every caller safe, not just that one.
    if (import.meta.server) return

    stopPolling()
    fetchCount()
    intervalId = setInterval(fetchCount, POLL_INTERVAL)
  }

  function stopPolling() {
    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'visible') {
      fetchCount()
      if (!intervalId) {
        intervalId = setInterval(fetchCount, POLL_INTERVAL)
      }
    }
    else {
      stopPolling()
    }
  }

  function setupLifecycle() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange)
    }
  }

  function teardownLifecycle() {
    stopPolling()
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }

  const displayCount = computed(() => {
    if (count.value > LIMITS.COUNTER_DISPLAY_CAP) return `${LIMITS.COUNTER_DISPLAY_CAP}+`
    return count.value
  })

  return {
    count,
    displayCount,
    fetchCount,
    startPolling,
    stopPolling,
    setupLifecycle,
    teardownLifecycle,
  }
}
