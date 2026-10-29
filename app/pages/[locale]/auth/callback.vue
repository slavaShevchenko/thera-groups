<script setup lang="ts">
const { t, locale } = useLocale()
const route = useRoute()
const { fetchUser } = useUser()
const { startLoading, finishLoading } = usePageLoading()

type CallbackFailure = 'generic' | 'providerConflict'

const failure = ref<CallbackFailure | null>(null)

/**
 * `/api/auth/google` answers 409 for exactly one thing: the address belongs to an account
 * signed up through a different provider (`emailOwnedByAnotherIdentity`). It deserves its
 * own wording because it is the one failure here the visitor can act on, and because
 * "sign in again" is not the fix — the other provider is.
 */
function isProviderConflict(error: unknown): boolean {
  const { statusCode, data } = (error ?? {}) as { statusCode?: number, data?: { code?: string } }
  return statusCode === 409 || data?.code === 'CONFLICT'
}

const failureMessage = computed(() =>
  failure.value === 'providerConflict'
    ? t('auth.callbackProviderConflict')
    : t('auth.callbackError'),
)

onMounted(async () => {
  const code = route.query.code as string | undefined

  if (!code) {
    navigateTo(`/${locale.value}/auth/login`)
    return
  }

  startLoading()
  try {
    await $fetch('/api/auth/google', {
      method: 'POST',
      body: { code },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    await fetchUser(true)
    navigateTo(`/${locale.value}/`)
  }
  catch (error) {
    // Rendered inline rather than thrown: app/error.vue maps by status code only and drops
    // statusMessage, so a thrown 400 could never show the reason it was carrying.
    failure.value = isProviderConflict(error) ? 'providerConflict' : 'generic'
  }
  finally {
    finishLoading()
  }
})

useHead({
  title: () => t('auth.callbackProcessing'),
  meta: [
    { name: 'robots', content: 'noindex, nofollow' }],
})
</script>

<template>
  <div class="auth-page">
    <div class="auth-page__status">
      <p
        v-if="!failure"
        role="status"
        class="auth-page__text"
      >
        {{ t('auth.callbackProcessing') }}
      </p>

      <div
        v-else
        class="auth-page__error"
        role="alert"
      >
        <p class="auth-page__error-text">
          {{ failureMessage }}
        </p>
        <!-- The provider code is single-use, so a Retry button could only fail again. -->
        <UiButton
          variant="secondary"
          :to="`/${locale}/auth/login`"
        >
          {{ t('auth.callbackTryAnotherWay') }}
        </UiButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: var(--spacing-2xl) var(--spacing-lg);
  min-height: 60vh;
}

.auth-page__status {
  text-align: center;
}

.auth-page__text {
  font-size: var(--font-size-md);
  color: var(--color-text-muted);
}

.auth-page__error {
  max-width: 28rem;
  padding: var(--spacing-lg);
  background: var(--color-error-bg-soft);
  border: var(--border-width) solid var(--color-error-border-soft);
  border-radius: var(--radius-md);
  text-align: center;
}

.auth-page__error-text {
  margin: 0 0 var(--spacing-md);
  font-size: var(--font-size-md);
  color: var(--color-error-text);
}
</style>
