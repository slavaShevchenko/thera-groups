<script setup lang="ts">
const router = useRouter()
const nuxtApp = useNuxtApp()
const { isLoading, startLoading, finishLoading, forceHide } = usePageLoading()

function isOnlyLocaleChange(to: string, from: string): boolean {
  const stripLocale = (path: string) => path.replace(/^\/(ua|en)/, '')
  return stripLocale(to) === stripLocale(from)
}

router.beforeEach((to, from) => {
  // Skip loader for locale-only switches
  if (isOnlyLocaleChange(to.path, from.path)) {
    return
  }

  // Skip loader for unmatched routes (404)
  const resolved = router.resolve(to)
  if (resolved.matched.length === 0) {
    return
  }

  startLoading()
})

nuxtApp.hook('page:finish', () => {
  finishLoading()
})

router.onError(() => {
  forceHide()
})

nuxtApp.hook('app:error', () => {
  forceHide()
})
</script>

<template>
  <div class="app-layout">
    <PageLoader :visible="isLoading" />
    <AppHeader />
    <ModerationBanner />
    <main class="app-layout__main">
      <slot></slot>
    </main>
    <AppFooter />
  </div>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-layout__main {
  flex: 1;
}
</style>
