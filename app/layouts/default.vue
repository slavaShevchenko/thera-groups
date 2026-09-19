<script setup lang="ts">
const { t } = useLocale()
const router = useRouter()
const nuxtApp = useNuxtApp()
const { isLoading, startLoading, finishLoading, forceHide } = usePageLoading()

// Получаем computed массив крошек (использует inject)
const breadcrumbs = useBreadcrumbs()

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
    <a
      href="#main-content"
      class="skip-link"
    >
      {{ t('a11y.skipToContent') }}
    </a>
    <PageLoader :visible="isLoading" />
    <AppHeader />
    <ModerationBanner />
    <AppBreadcrumbs
      v-if="breadcrumbs.length > 0"
      :items="breadcrumbs"
      class="app-layout__breadcrumbs"
    />
    <main
      id="main-content"
      class="app-layout__main"
    >
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

.app-layout__breadcrumbs {
  max-width: var(--container-width);
  margin: 0 auto;
  padding: var(--spacing-md) var(--spacing-lg) 0;
  width: calc(100% - var(--spacing-lg) * 2);
}

.app-layout__main {
  flex: 1;
}

.skip-link {
  position: absolute;
  top: -2.5rem;
  left: 0;
  background: var(--color-primary);
  color: var(--color-white);
  padding: var(--spacing-sm) var(--spacing-md);
  text-decoration: none;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  z-index: 1100;
  border-radius: 0 0 var(--radius-sm) 0;
  transition: top var(--transition-base);
}

.skip-link:focus {
  top: 0;
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
</style>
