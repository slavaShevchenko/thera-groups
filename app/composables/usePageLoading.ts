export function usePageLoading() {
  const isLoading = useState('pageLoading', () => false)
  const pendingCount = useState('pageLoadingCount', () => 0)
  let hideTimeout: ReturnType<typeof setTimeout> | null = null

  function startLoading() {
    if (hideTimeout) {
      clearTimeout(hideTimeout)
      hideTimeout = null
    }
    pendingCount.value++
    isLoading.value = true
  }

  function finishLoading() {
    pendingCount.value = Math.max(0, pendingCount.value - 1)
    if (pendingCount.value === 0) {
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
    pendingCount.value = 0
    isLoading.value = false
  }

  return { isLoading, startLoading, finishLoading, forceHide }
}
