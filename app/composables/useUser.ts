interface TherapistProfileBrief {
  id: string
  firstName: string
  lastName: string
  verificationStatus: string
}

interface AuthUser {
  id: string
  email: string
  role: string
  therapistProfile?: TherapistProfileBrief | null
}

interface LoginPayload {
  email: string
  password: string
}

interface RegisterPayload {
  email: string
  password: string
  role: 'VISITOR' | 'THERAPIST'
  preferredLocale?: 'ua' | 'en'
  therapistData?: {
    firstName: string
    lastName: string
    bio?: string
    qualification?: string
  }
}

const user = () => useState<AuthUser | null>('auth-user', () => null)
const initialized = () => useState('auth-initialized', () => false)

export const useUser = () => {
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => !!user().value)

  async function fetchUser() {
    if (user().value || isLoading.value) return
    if (import.meta.server) return

    isLoading.value = true
    try {
      user().value = await $fetch<AuthUser>('/api/auth/me')
      initialized().value = true
    }
    catch {
      user().value = null
    }
    finally {
      isLoading.value = false
    }
  }

  async function login(payload: LoginPayload) {
    isLoading.value = true
    error.value = null

    try {
      const response = await $fetch<{ success: boolean, user: AuthUser }>('/api/auth/login', {
        method: 'POST',
        body: payload,
      })

      user().value = response.user
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

      user().value = response.user
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
      user().value = null
    }
  }

  if (!initialized().value && !user().value) {
    fetchUser()
  }

  return {
    user: readonly(user),
    isAuthenticated,
    isLoading: readonly(isLoading),
    error: readonly(error),
    fetchUser,
    login,
    register,
    logout,
  }
}
