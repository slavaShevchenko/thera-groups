<script setup lang="ts">
const router = useRouter()
const isLoading = ref(false)
let hideTimeout: ReturnType<typeof setTimeout> | null = null

router.beforeEach(() => {
  if (hideTimeout) {
    clearTimeout(hideTimeout)
    hideTimeout = null
  }
  isLoading.value = true
})

router.afterEach(() => {
  hideTimeout = setTimeout(() => {
    isLoading.value = false
  }, 100)
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
