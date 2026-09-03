<script setup lang="ts">
const { t, locale } = useLocale()
const route = useRoute()
const { fetchUser } = useUser()
const { startLoading, finishLoading } = usePageLoading()

const error = ref(false)

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
    })

    await fetchUser(true)
    navigateTo(`/${locale.value}/`)
  }
  catch {
    error.value = true
  }
  finally {
    finishLoading()
  }
})

useHead({
  title: () => t('auth.callbackProcessing'),
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
  ],
})
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <div
        v-if="error"
        class="auth-card__error-state"
      >
        <p class="auth-card__error-text">
          {{ t('auth.callbackError') }}
        </p>
        <NuxtLink
          :to="`/${locale}/auth/login`"
          class="auth-card__error-link"
        >
          {{ t('auth.login.title') }}
        </NuxtLink>
      </div>
      <div
        v-else
        class="auth-card__loading-state"
      >
        <div class="auth-card__spinner"></div>
        <p class="auth-card__loading-text">
          {{ t('auth.callbackProcessing') }}
        </p>
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

.auth-card {
  width: 100%;
  max-width: 420px;
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: var(--spacing-2xl);
  box-shadow: var(--shadow-md);
  text-align: center;
}

.auth-card__loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
}

.auth-card__spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: auth-spin 0.6s linear infinite;
}

@keyframes auth-spin {
  to { transform: rotate(360deg); }
}

.auth-card__loading-text {
  font-size: var(--font-size-md);
  color: var(--color-text-muted);
  margin: 0;
}

.auth-card__error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
}

.auth-card__error-text {
  font-size: var(--font-size-md);
  color: var(--color-error);
  margin: 0;
}

.auth-card__error-link {
  font-size: var(--font-size-sm);
  color: var(--color-primary);
  text-decoration: underline;
}
</style>
