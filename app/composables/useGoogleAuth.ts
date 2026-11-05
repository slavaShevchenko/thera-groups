/**
 * Starts the Google OAuth round trip.
 *
 * There is no role to choose: Google signs an existing account in and refuses an identity
 * that has none (`POST /api/auth/google`), so becoming an organizer is never part of this
 * flow — that goes through registration or the profile's "become an organizer" form.
 */
export const useGoogleAuth = () => {
  const { t, locale } = useLocale()

  const isLoading = ref(false)
  const error = ref('')

  // The provider URL comes from our own server, but it is followed with a full-page
  // navigation, so it is checked against the hosts this deployment actually owns.
  function isAllowedTarget(target: URL): boolean {
    const config = useRuntimeConfig()
    const allowedHosts = new Set<string>()

    if (typeof window !== 'undefined') {
      allowedHosts.add(window.location.host)
    }

    for (const raw of [config.public.siteUrl, config.public.supabaseUrl]) {
      if (typeof raw !== 'string' || !raw) continue
      try {
        allowedHosts.add(new URL(raw).host)
      }
      catch {
        // A malformed configured URL simply contributes no host.
      }
    }

    return allowedHosts.size === 0 || allowedHosts.has(target.host)
  }

  async function start() {
    error.value = ''
    isLoading.value = true

    try {
      const response = await $fetch<{ url: string }>('/api/auth/google-start', {
        query: { locale: locale.value },
      })

      if (!response.url) return

      const target = new URL(response.url)
      if (!isAllowedTarget(target)) {
        error.value = t('errors.redirectBlocked')
        return
      }

      window.location.href = target.href
    }
    catch {
      error.value = t('auth.errors.googleFailed')
    }
    finally {
      isLoading.value = false
    }
  }

  return { start, isLoading, error }
}
