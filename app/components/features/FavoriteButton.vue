<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    slug: string
    size?: 'sm' | 'md' | 'lg'
    initialFavorited?: boolean
  }>(),
  {
    size: 'md',
    initialFavorited: false,
  },
)

const emit = defineEmits<{
  toggled: [favorited: boolean]
}>()

const { t, locale } = useLocale()
const { isAuthenticated } = useUser()

const isFavorited = ref(props.initialFavorited)
const isAnimating = ref(false)
const isLoading = ref(false)

const sizeMap = { sm: '1rem', md: '1.25rem', lg: '1.5rem' }
const iconSize = computed(() => sizeMap[props.size])

async function toggle() {
  if (isLoading.value) return

  if (!isAuthenticated.value) {
    navigateTo(`/${locale.value}/auth/login`)
    return
  }

  isLoading.value = true
  isAnimating.value = true

  try {
    if (isFavorited.value) {
      await $fetch(`/api/groups/${props.slug}/favorite`, { method: 'DELETE' })
      isFavorited.value = false
    }
    else {
      await $fetch(`/api/groups/${props.slug}/favorite`, { method: 'POST' })
      isFavorited.value = true
    }
    emit('toggled', isFavorited.value)
  }
  catch {
    // Toggle failed — keep current state
  }
  finally {
    isLoading.value = false
    setTimeout(() => {
      isAnimating.value = false
    }, 300)
  }
}
</script>

<template>
  <button
    type="button"
    class="favorite-btn"
    :class="[
      `favorite-btn--${size}`,
      { 'favorite-btn--active': isFavorited, 'favorite-btn--animating': isAnimating },
    ]"
    :aria-label="isFavorited ? t('groupPage.unfavorite') : t('groupPage.favorite')"
    :disabled="isLoading"
    @click.stop="toggle"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      :width="iconSize"
      :height="iconSize"
      viewBox="0 0 24 24"
      :fill="isFavorited ? 'currentColor' : 'none'"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  </button>
</template>

<style scoped>
.favorite-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: var(--color-surface);
  border-radius: var(--radius-full);
  cursor: pointer;
  color: var(--color-text-muted);
  box-shadow: var(--shadow-sm);
  transition: color var(--transition-base), transform 0.3s ease;
  padding: var(--spacing-xs);
}

.favorite-btn:hover {
  color: var(--color-error);
}

.favorite-btn--active {
  color: var(--color-error);
}

.favorite-btn--animating {
  animation: favorite-pulse 0.3s ease;
}

.favorite-btn--sm {
  width: 2rem;
  height: 2rem;
}

.favorite-btn--md {
  width: 2.5rem;
  height: 2.5rem;
}

.favorite-btn--lg {
  width: 3rem;
  height: 3rem;
}

.favorite-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@keyframes favorite-pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.3); }
  100% { transform: scale(1); }
}
</style>
