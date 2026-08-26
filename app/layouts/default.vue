<script setup lang="ts">
const router = useRouter()
const nuxtApp = useNuxtApp()
const { isLoading, startLoading, finishLoading, forceHide } = usePageLoading()

router.beforeEach(() => {
  startLoading()
})

nuxtApp.hook('page:finish', () => {
  finishLoading()
})

router.onError(() => {
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
