import type { AuthUser, LoginPayload, RegisterPayload } from '~~/types'

// The in-flight /api/auth/me promise is kept on the Nuxt app instance, not in module
// scope. On the server a module-level Map is shared by every concurrent request, so
// request B would await request A's promise and receive A's user. useState is
// per-request but serializes into the payload, and a Promise cannot be serialized.
const IN_FLIGHT_KEY = '_authMeInFlight'

type AuthFetchHolder = Record<typeof IN_FLIGHT_KEY, Promise<void> | undefined>

export const useUser = () => {
  // useState вызываем ВНУТРИ функции — это правильное место
  const userState = useState<AuthUser | null>('auth-user', () => null)
  const initializedState = useState('auth-initialized', () => false)
  const { locale: localeRef, t } = useLocale()

  // Shared across every caller so a guard, a page and the header observe one transition.
  const isLoading = useState('auth-loading', () => false)
  const error = ref<string | null>(null)

  const nuxtApp = useNuxtApp() as unknown as AuthFetchHolder
  // Forwards the incoming request's cookies on the server, which /api/auth/me needs to
  // resolve the Supabase session. On the client this is plain $fetch.
  const requestFetch = useRequestFetch()

  const isAuthenticated = computed(() => !!userState.value)

  /**
   * Resolves the session exactly once per app instance (per request on the server).
   * Every caller receives the same promise, so a plugin, a route guard and a page can
   * all await it without triggering parallel requests.
   *
   * Never rejects and never redirects: an unresolvable session simply means "not
   * authenticated", and deciding where that leads belongs to the route guard.
   */
  async function fetchUser(force = false): Promise<void> {
    if (!force && initializedState.value) return

    const inFlight = nuxtApp[IN_FLIGHT_KEY]
    if (!force && inFlight) return inFlight

    const promise = (async () => {
      isLoading.value = true
      try {
        const data = await requestFetch<{ user: AuthUser | null }>('/api/auth/me')
        userState.value = data.user
        // Settled only on an answer, and the anonymous `{ user: null }` counts as one.
        // A failure must stay retryable: if an SSR resolution marked itself done after
        // throwing, a database blip would sign everybody out for the life of the page.
        initializedState.value = true
      }
      catch {
        // Silent by design: an unresolvable session means "not authenticated". Where that
        // leads is the route guard's decision, never this composable's.
        userState.value = null
      }
      finally {
        isLoading.value = false
        nuxtApp[IN_FLIGHT_KEY] = undefined
      }
    })()

    nuxtApp[IN_FLIGHT_KEY] = promise
    return promise
  }

  async function login(payload: LoginPayload, options?: { returnTo?: unknown }) {
    isLoading.value = true
    error.value = null

    try {
      const response = await $fetch<{ success: boolean, user: AuthUser }>('/api/auth/login', {
        method: 'POST',
        body: payload,
      })

      userState.value = response.user
      initializedState.value = true
      await navigateTo(resolveReturnTo(options?.returnTo, localeRef.value))
    }
    catch (e: unknown) {
      const err = e as {
        statusCode?: number
        status?: number
        statusMessage?: string
        data?: { statusMessage?: string }
      }
      const status = err?.statusCode ?? err?.status
      const statusMessage = err?.data?.statusMessage || err?.statusMessage || ''

      // login.post.ts answers 403 only for a deactivated account; bad credentials are 401.
      if (status === 403) {
        error.value = t('auth.errors.accountDisabled')
      }
      else if (statusMessage === 'Invalid credentials') {
        error.value = t('auth.errors.credentialsInvalid')
      }
      else {
        error.value = t('common.errors.fetchFailed')
      }
    }
    finally {
      isLoading.value = false
    }
  }

  async function register(payload: RegisterPayload) {
    isLoading.value = true
    error.value = null

    try {
      const response = await $fetch<{ success: boolean, user: AuthUser }>('/api/auth/register', {
        method: 'POST',
        body: payload,
      })

      return response.user
    }
    catch (e: unknown) {
      const err = e as { data?: { statusMessage?: string, details?: { message: string }[] }, statusMessage?: string }
      const statusMessage = err?.data?.statusMessage || err?.statusMessage || ''

      if (statusMessage === 'User with this email already exists') {
        error.value = t('auth.errors.emailExists')
      }
      else if (err?.data?.details) {
        error.value = err.data.details.map(d => d.message).join('. ')
      }
      else {
        error.value = t('common.errors.fetchFailed')
      }

      return null
    }
    finally {
      isLoading.value = false
    }
  }

  async function logout() {
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
    }
    catch {
      // Silent by design: logout failure still clears local state
    }
    finally {
      userState.value = null
      initializedState.value = true
    }
  }

  return {
    user: readonly(userState),
    isAuthenticated,
    isLoading: readonly(isLoading),
    error: readonly(error),
    fetchUser,
    login,
    register,
    logout,
  }
}
