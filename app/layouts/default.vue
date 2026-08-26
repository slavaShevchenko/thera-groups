<script setup lang="ts">
const { isLoading } = useLoadingIndicator({
  duration: 3000,
  throttle: 150,
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
