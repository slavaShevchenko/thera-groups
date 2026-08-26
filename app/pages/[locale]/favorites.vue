<script setup lang="ts">
const { t, locale } = useLocale()
const { isAuthenticated, isLoading: isUserLoading } = useUser()

const groups = ref<Record<string, unknown>[]>([])
const isLoading = ref(true)

watch(isUserLoading, (loading) => {
  if (loading) return

  if (!isAuthenticated.value) {
    navigateTo(`/${locale.value}/auth/login`)
    return
  }

  loadFavorites()
}, { immediate: true })

async function loadFavorites() {
  isLoading.value = true
  try {
    groups.value = await $fetch<Record<string, unknown>[]>('/api/favorites/my')
  }
  catch {
    groups.value = []
  }
  finally {
    isLoading.value = false
  }
}

useHead({ title: () => t('favorites.title') })
</script>

<template>
  <div class="favorites-page">
    <h1 class="favorites-page__title">
      {{ t('favorites.title') }}
    </h1>

    <div
      v-if="isLoading || isUserLoading"
      class="favorites-page__status"
    >
      {{ t('common.loading') }}
    </div>

    <div
      v-else-if="groups.length === 0"
      class="favorites-page__empty"
    >
      <div class="favorites-page__empty-icon">
        &#x2764;
      </div>
      <p class="favorites-page__empty-text">
        {{ t('favorites.empty') }}
      </p>
      <NuxtLink
        :to="`/${locale}/groups`"
        class="favorites-page__cta"
      >
        {{ t('favorites.emptyCta') }}
      </NuxtLink>
    </div>

    <div
      v-else
      class="favorites-page__grid"
    >
      <GroupCard
        v-for="group in groups"
        :key="group.id"
        :group="group"
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

.favorites-page__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-2xl);
  text-align: center;
}

.favorites-page__empty-icon {
  font-size: 3rem;
  opacity: 0.4;
}

.favorites-page__empty-text {
  font-size: var(--font-size-lg);
  color: var(--color-text-muted);
  margin: 0;
}

.favorites-page__cta {
  display: inline-flex;
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-primary);
  color: #fff;
  border-radius: var(--radius-md);
  font-weight: var(--font-weight-medium);
  text-decoration: none;
}

.favorites-page__cta:hover {
  background: var(--color-primary-hover);
  color: #fff;
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
