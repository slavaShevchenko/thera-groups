export function usePageLoading() {
  const isLoading = useState('pageLoading', () => false)
  const pendingCount = useState('pageLoadingCount', () => 0)
  const generation = useState('pageLoadingGeneration', () => 0)
  const forceHideTimer = useState<ReturnType<typeof setTimeout> | null>('pageLoading-forceHideTimer', () => null)
  let hideTimeout: ReturnType<typeof setTimeout> | null = null

  function scheduleForceHide(gen: number) {
    if (forceHideTimer.value !== null) {
      clearTimeout(forceHideTimer.value)
    }
    forceHideTimer.value = setTimeout(() => {
      if (generation.value === gen) {
        pendingCount.value = 0
        isLoading.value = false
      }
    }, 5000)
  }

  function startLoading() {
    if (hideTimeout) {
      clearTimeout(hideTimeout)
      hideTimeout = null
    }
    generation.value++
    pendingCount.value++
    isLoading.value = true
    scheduleForceHide(generation.value)
  }

  function finishLoading() {
    pendingCount.value = Math.max(0, pendingCount.value - 1)
    if (pendingCount.value === 0) {
      if (forceHideTimer.value !== null) {
        clearTimeout(forceHideTimer.value)
        forceHideTimer.value = null
      }
      hideTimeout = setTimeout(() => {
        isLoading.value = false
      }, 200)
    }
  }

  function forceHide() {
    if (hideTimeout) {
      clearTimeout(hideTimeout)
      hideTimeout = null
    }
    if (forceHideTimer.value !== null) {
      clearTimeout(forceHideTimer.value)
      forceHideTimer.value = null
    }
    generation.value++
    pendingCount.value = 0
    isLoading.value = false
  }

  return { isLoading, startLoading, finishLoading, forceHide }
}
