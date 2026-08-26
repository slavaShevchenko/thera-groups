<script setup lang="ts">
defineProps<{
  visible: boolean
}>()
</script>

<template>
  <Transition name="loader">
    <div
      v-if="visible"
      class="page-loader"
      aria-live="polite"
      aria-label="Завантаження"
    >
      <svg
        width="56"
        height="56"
        viewBox="0 0 56 56"
        class="page-loader__spinner"
        aria-hidden="true"
      >
        <circle
          cx="28"
          cy="28"
          r="24"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
          stroke-dasharray="150 100"
        />
      </svg>

      <span class="page-loader__brand">TheraGroups</span>

      <div class="page-loader__bar">
        <div class="page-loader__bar-fill"></div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.page-loader {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-lg);
  background: var(--color-primary);
  color: #fff;
}

.page-loader__spinner {
  animation: spin 1s linear infinite;
}

.page-loader__brand {
  font-family: var(--font-family-heading);
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.02em;
  animation: brand-fade 0.4s ease-out 0.1s both;
}

.page-loader__bar {
  width: 200px;
  height: 3px;
  background: rgba(255, 255, 255, 0.25);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.page-loader__bar-fill {
  width: 40%;
  height: 100%;
  background: #fff;
  border-radius: var(--radius-full);
  animation: bar-slide 1.4s ease-in-out infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes brand-fade {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes bar-slide {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(350%);
  }
}

.loader-enter-active {
  transition: opacity 0.3s ease-out, transform 0.3s ease-out;
}

.loader-leave-active {
  transition: opacity 0.25s ease-in, transform 0.25s ease-in;
}

.loader-enter-from {
  opacity: 0;
  transform: scale(0.96);
}

.loader-leave-to {
  opacity: 0;
  transform: scale(1.04);
}
</style>
