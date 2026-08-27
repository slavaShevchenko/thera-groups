<script setup lang="ts">
defineProps<{
  visible: boolean
}>()

const brandText = 'TheraGroups'
const brandLetters = computed(() => brandText.split(''))
</script>

<template>
  <Transition name="loader">
    <div
      v-if="visible"
      class="page-loader"
      aria-live="polite"
      aria-label="Завантаження"
    >
      <span
        class="page-loader__brand"
        :aria-label="brandText"
      >
        <span
          v-for="(letter, index) in brandLetters"
          :key="index"
          class="page-loader__letter"
          :style="{ animationDelay: `${index * 0.06}s` }"
          aria-hidden="true"
        >{{ letter }}</span>
      </span>

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

.page-loader__brand {
  font-family: var(--font-family-heading);
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.02em;
}

.page-loader__letter {
  display: inline-block;
  animation: letter-wave 1.4s ease-in-out infinite;
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

@keyframes letter-wave {
  0%, 60%, 100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-8px);
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
