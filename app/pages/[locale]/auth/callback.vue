<script setup lang="ts">
const { t, locale } = useLocale()
const route = useRoute()
const { fetchUser } = useUser()
const { startLoading, finishLoading } = usePageLoading()

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
  catch {
    throw createError({
      statusCode: 400,
      statusMessage: t('auth.errors.oauthFailed'),
    })
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
        role="status"
        class="auth-page__text"
      >
        {{ t('auth.callbackProcessing') }}
      </p>
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
</style>
