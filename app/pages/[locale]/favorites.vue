<script setup lang="ts">
import type { Group } from '~~/types'

const { t, locale } = useLocale()
const { startLoading, finishLoading } = usePageLoading()

const groups = ref<Group[]>([])
const isLoading = ref(true)
const loadError = ref(false)

// Authentication is enforced by app/middleware/auth.global.ts before this page renders.
onMounted(async () => {
  startLoading()
  try {
    await loadFavorites()
  }
  finally {
    finishLoading()
  }
})

async function loadFavorites() {
  isLoading.value = true
  loadError.value = false
  try {
    groups.value = await $fetch<Group[]>('/api/favorites/my')
  }
  catch {
    loadError.value = true
  }
  finally {
    isLoading.value = false
  }
}

useHead({
  title: () => t('common.favorites'),
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
  ],
})
</script>

<template>
  <div class="favorites-page">
    <h1 class="favorites-page__title">
      {{ t('common.favorites') }}
    </h1>

    <div
      v-if="isLoading"
      class="favorites-page__status"
    >
      {{ t('common.loading') }}
    </div>

    <div
      v-else-if="loadError"
      class="favorites-page__error"
    >
      <p>{{ t('errors.failedToLoad') }}</p>
      <UiButton
        variant="secondary"
        @click="loadFavorites"
      >
        {{ t('common.retry') }}
      </UiButton>
    </div>

    <UiEmptyState
      v-else-if="groups.length === 0"
      icon="❤"
      :title="t('favorites.empty')"
    >
      <NuxtLink
        :to="`/${locale}/catalog`"
        class="favorites-page__cta"
      >
        {{ t('common.browseGroups') }}
      </NuxtLink>
    </UiEmptyState>

    <div
      v-else
      class="favorites-page__grid"
    >
      <GroupCard
        v-for="group in groups"
        :key="group.id"
        :group="group"
        back-source="favorites"
      />
    </div>
  </div>
</template>

<style scoped>
.favorites-page {
  max-width: var(--container-width);
  margin: 0 auto;
  padding: var(--spacing-xl) var(--spacing-lg);
}

.favorites-page__title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  margin: 0 0 var(--spacing-xl);
}

.favorites-page__status {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--color-text-muted);
}

.favorites-page__error {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--color-error-text);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
}

.favorites-page__cta {
  display: inline-flex;
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-primary);
  color: var(--color-white);
  border-radius: var(--radius-md);
  font-weight: var(--font-weight-medium);
  text-decoration: none;
}

.favorites-page__cta:hover {
  background: var(--color-primary-hover);
  color: var(--color-white);
  text-decoration: none;
}

.favorites-page__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-lg);
}

@media (max-width: 1024px) {
  .favorites-page__grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .favorites-page__grid {
    grid-template-columns: 1fr;
  }
}
</style>
