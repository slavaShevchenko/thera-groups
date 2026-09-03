<script setup lang="ts">
const { t, locale } = useLocale()
const route = useRoute()
const { startLoading, finishLoading } = usePageLoading()

const error = ref(false)
const debugInfo = ref<string[]>([])

function log(msg: string) {
  console.log(`[Callback] ${msg}`)
  debugInfo.value.push(msg)
}

onMounted(async () => {
  const code = route.query.code as string | undefined

  log(`mounted, code present: ${!!code}`)

  if (!code) {
    log('no code, redirect to login')
    navigateTo(`/${locale.value}/auth/login`)
    return
  }

  startLoading()
  try {
    const supabase = useSupabase()
    log('calling exchangeCodeForSession...')

    const { error: exchangeError, data } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      log(`exchange failed: ${exchangeError.message}`)
      error.value = true
      return
    }

    log(`exchange success, user id: ${data.user?.id}`)
    log('redirecting to home...')

    // Full reload: новый useUser() сработает с уже установленной сессией
    window.location.href = `/${locale.value}/`
  }
  catch (err) {
    log(`unexpected error: ${err instanceof Error ? err.message : String(err)}`)
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
        <div class="auth-card__debug">
          <p
            v-for="(line, i) in debugInfo"
            :key="i"
            class="auth-card__debug-line"
          >
            {{ line }}
          </p>
        </div>
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

.auth-card__debug {
  width: 100%;
  padding: var(--spacing-sm);
  background: var(--color-background);
  border-radius: var(--radius-md);
  text-align: left;
  max-height: 200px;
  overflow-y: auto;
}

.auth-card__debug-line {
  font-size: var(--font-size-xs);
  font-family: monospace;
  color: var(--color-text-muted);
  margin: 0;
  word-break: break-all;
}

.auth-card__error-link {
  font-size: var(--font-size-sm);
  color: var(--color-primary);
  text-decoration: underline;
}
</style>
