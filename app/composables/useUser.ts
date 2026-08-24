interface OrganizerProfileBrief {
  id: string
  firstName: string
  lastName: string
  verificationStatus: string
}

interface AuthUser {
  id: string
  email: string
  role: string
  organizerProfile?: OrganizerProfileBrief | null
}

interface LoginPayload {
  email: string
  password: string
}

interface RegisterPayload {
  email: string
  password: string
  role: 'VISITOR' | 'ORGANIZER'
  preferredLocale?: 'ua' | 'en'
  organizerData?: {
    firstName: string
    lastName: string
    bio?: string
    qualification?: string
  }
}

// Shared promise для защиты от повторных вызовов
const fetchPromises = new Map<string, Promise<void>>()

export const useUser = () => {
  // useState вызываем ВНУТРИ функции — это правильное место
  const userState = useState<AuthUser | null>('auth-user', () => null)
  const initializedState = useState('auth-initialized', () => false)

  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => !!userState.value)

  async function fetchUser() {
    const fetchKey = 'auth-fetch'

    // Возвращаем существующий promise если уже идёт загрузка
    if (fetchPromises.has(fetchKey)) {
      return fetchPromises.get(fetchKey)
    }

    // Не фетчим на сервере (SSR не форвардит cookies)
    if (import.meta.server) return

    // Если уже загружены — выходим
    if (initializedState.value) return

    const promise = (async () => {
      isLoading.value = true
      try {
        const data = await $fetch<{ user: AuthUser | null }>('/api/auth/me')
        userState.value = data.user
      }
      catch {
        userState.value = null
      }
      finally {
        initializedState.value = true
        isLoading.value = false
        fetchPromises.delete(fetchKey)
      }
    })()

    fetchPromises.set(fetchKey, promise)
    return promise
  }

  async function login(payload: LoginPayload) {
    isLoading.value = true
    error.value = null

    try {
      const response = await $fetch<{ success: boolean, user: AuthUser }>('/api/auth/login', {
        method: 'POST',
        body: payload,
      })

      userState.value = response.user
      initializedState.value = true
      await navigateTo(`/${useLocale().locale.value}/`)
    }
    catch (e: unknown) {
      const err = e as { data?: { statusMessage?: string }, statusMessage?: string }
      const statusMessage = err?.data?.statusMessage || err?.statusMessage || ''

      if (statusMessage === 'Invalid credentials') {
        error.value = useLocale().t('auth.errors.credentialsInvalid')
      }
      else {
        error.value = useLocale().t('common.errors.fetchFailed')
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

      userState.value = response.user
      initializedState.value = true
      return response.user
    }
    catch (e: unknown) {
      const err = e as { data?: { statusMessage?: string, details?: { message: string }[] }, statusMessage?: string }
      const statusMessage = err?.data?.statusMessage || err?.statusMessage || ''

      if (statusMessage === 'User with this email already exists') {
        error.value = useLocale().t('auth.errors.emailExists')
      }
      else if (err?.data?.details) {
        error.value = err.data.details.map(d => d.message).join('. ')
      }
      else {
        error.value = useLocale().t('common.errors.fetchFailed')
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
      // ignore
    }
    finally {
      userState.value = null
      initializedState.value = true
    }
  }

  // Авто-fetch при первом вызове
  if (import.meta.client && !initializedState.value) {
    fetchUser()
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
