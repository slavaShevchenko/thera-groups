<script setup lang="ts">
import type { OrganizerListItem } from '~~/types'

const { t, locale } = useLocale()

const siteUrl = useRuntimeConfig().public.siteUrl as string
const canonicalUrl = computed(() => `${siteUrl}/${locale.value}/organizers`)

useSeoPage({
  title: () => t('seo.organizersTitle'),
  description: () => t('seo.organizersDescription'),
  canonicalUrl: canonicalUrl.value,
})

const { data, pending, error: fetchError, refresh } = await useAsyncData(
  'organizers-catalog',
  () => $fetch<{ organizers: OrganizerListItem[], total: number, page: number, totalPages: number }>('/api/organizers'),
)

const allOrganizers = ref<OrganizerListItem[]>(data.value?.organizers ?? [])
const currentPage = ref(data.value?.page ?? 1)
const totalPages = ref(data.value?.totalPages ?? 1)
const total = ref(data.value?.total ?? 0)
const loadingMore = ref(false)

watch(data, (newData) => {
  if (newData) {
    allOrganizers.value = newData.organizers
    currentPage.value = newData.page
    totalPages.value = newData.totalPages
    total.value = newData.total
  }
})

const hasMore = computed(() => currentPage.value < totalPages.value)

async function loadMore() {
  if (loadingMore.value || !hasMore.value) return
  loadingMore.value = true
  try {
    const nextPage = currentPage.value + 1
    const result = await $fetch<{ organizers: OrganizerListItem[], total: number, page: number, totalPages: number }>('/api/organizers', {
      query: { page: String(nextPage) },
    })
    allOrganizers.value = [...allOrganizers.value, ...result.organizers]
    currentPage.value = result.page
    totalPages.value = result.totalPages
    total.value = result.total
  }
  catch {
    // Silent by design: organizers load failure shows empty state
  }
  finally {
    loadingMore.value = false
  }
}

const organizersCount = computed(() => total.value)
</script>

<template>
  <div class="organizers-page">
    <header class="organizers-page__header">
      <h1 class="organizers-page__title">
        {{ t('common.organizers') }}
      </h1>
    </header>

    <div class="organizers-page__content">
      <p class="organizers-page__count">
        {{ t('organizers.found', { count: String(organizersCount) }) }}
      </p>

      <div
        v-if="pending"
        class="organizers-page__status"
      >
        {{ t('common.loading') }}
      </div>

      <div
        v-else-if="fetchError"
        class="organizers-page__error"
      >
        <p>{{ t('errors.failedToLoad') }}</p>
        <UiButton
          variant="secondary"
          @click="refresh"
        >
          {{ t('common.retry') }}
        </UiButton>
      </div>

      <div
        v-else-if="allOrganizers && allOrganizers.length > 0"
        class="organizers-page__body"
      >
        <div class="organizers-page__grid">
          <OrganizerCatalogCard
            v-for="organizer in allOrganizers"
            :key="organizer.id"
            :organizer="organizer"
          />
        </div>

        <div
          v-if="hasMore"
          class="organizers-page__load-more"
        >
          <UiButton
            variant="secondary"
            :disabled="loadingMore"
            @click="loadMore"
          >
            {{ loadingMore ? t('common.loading') : t('pagination.loadMore') }}
          </UiButton>
          <span class="organizers-page__progress">
            {{ allOrganizers.length }} / {{ total }}
          </span>
        </div>
      </div>

      <UiEmptyState
        v-else
        :title="t('emptyStates.organizers.title')"
      >
        <UiButton
          :to="`/${locale}/profile/edit`"
          variant="secondary"
        >
          {{ t('emptyStates.organizers.cta') }}
        </UiButton>
      </UiEmptyState>
    </div>
  </div>
</template>

<style scoped>
.organizers-page {
  padding: var(--spacing-xl) var(--spacing-lg);
  max-width: var(--container-width);
  margin: 0 auto;
}

.organizers-page__header {
  margin-bottom: var(--spacing-lg);
}

.organizers-page__title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  margin: 0;
  line-height: var(--line-height-tight);
}

.organizers-page__content {
  min-width: 0;
}

.organizers-page__count {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin: 0 0 var(--spacing-md) 0;
}

.organizers-page__status {
  text-align: center;
  padding: var(--spacing-2xl);
  font-size: var(--font-size-lg);
  color: var(--color-text-muted);
}

.organizers-page__error {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--color-error-text);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
}

.organizers-page__body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

.organizers-page__grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--spacing-lg);
}

@media (max-width: 1100px) {
  .organizers-page__grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .organizers-page__grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .organizers-page__grid {
    grid-template-columns: 1fr;
  }
}

.organizers-page__load-more {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
}

.organizers-page__progress {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}
</style>
