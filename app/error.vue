<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()
const { t } = useLocale()

const statusCode = computed(() => props.error.statusCode ?? 500)

const message = computed(() => {
  if (statusCode.value === 404) return t('errors.notFound')
  if (statusCode.value === 403) return t('errors.forbidden')
  if (statusCode.value === 401) return t('errors.unauthorized')
  return t('errors.generic')
})

function handleError() {
  clearError({ redirect: '/' })
}
</script>

<template>
  <div class="error-page">
    <div class="error-page__content">
      <h1 class="error-page__code">
        {{ statusCode }}
      </h1>
      <p class="error-page__message">
        {{ message }}
      </p>
      <button
        class="error-page__button"
        @click="handleError"
      >
        {{ t('common.goHome') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.error-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 1.5rem;
  text-align: center;
}

.error-page__content {
  max-width: 480px;
}

.error-page__code {
  font-size: 5rem;
  font-weight: 700;
  line-height: 1;
  color: var(--color-text-primary, #1a1a1a);
  margin: 0 0 1rem;
}

.error-page__message {
  font-size: 1.25rem;
  color: var(--color-text-secondary, #666);
  margin: 0 0 2rem;
}

.error-page__button {
  display: inline-block;
  padding: 0.75rem 2rem;
  font-size: 1rem;
  font-weight: 500;
  color: #fff;
  background-color: var(--color-primary, #6366f1);
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: opacity 0.2s;
}

.error-page__button:hover {
  opacity: 0.9;
}

.error-page__button:focus-visible {
  outline: 2px solid var(--color-primary, #6366f1);
  outline-offset: 2px;
}
</style>
