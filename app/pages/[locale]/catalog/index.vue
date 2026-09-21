<script setup lang="ts">
import type { Filters, Group } from '~~/types'
import { groupTypeToSlug } from '~~/shared/utils/groupTypeSlug'

const { t, locale } = useLocale()
const route = useRoute()
const router = useRouter()
const siteUrl = useRuntimeConfig().public.siteUrl as string

// Синхронна ініціалізація з URL (працює і на SSR)
const routeQuery = route.query

const filters = ref<Filters>({
  q: typeof routeQuery.q === 'string' ? routeQuery.q : '',
  type: '', // Type is handled by /groups/[type] route, not here
  format: typeof routeQuery.format === 'string' ? routeQuery.format : '',
  dateFrom: typeof routeQuery.dateFrom === 'string' ? routeQuery.dateFrom : '',
})

// When type is selected, redirect to /catalog/[type]
watch(() => filters.value.type, (newType) => {
  if (newType) {
    const slug = groupTypeToSlug(newType)
    if (slug) {
      router.push(`/${locale.value}/catalog/${slug}`)
    }
  }
})

const queryParams = computed(() => {
  const params: Record<string, string> = {}
  if (filters.value.q) params.q = filters.value.q
  // type is NOT included here - it's handled by the /groups/[type] route
  if (filters.value.format) params.format = filters.value.format
  if (filters.value.dateFrom) params.dateFrom = filters.value.dateFrom
  return params
})

// То, що реально уходит в API (с debounce)
const appliedQuery = ref<Record<string, string>>({ ...queryParams.value })

let filterDebounce: ReturnType<typeof setTimeout> | null = null

watch(filters, (newFilters, oldFilters) => {
  if (filterDebounce) clearTimeout(filterDebounce)
  // Якщо змінився тільки type - не оновлюємо appliedQuery (буде редирект)
  if (newFilters.type !== oldFilters?.type) {
    return
  }
  filterDebounce = setTimeout(() => {
    appliedQuery.value = { ...queryParams.value }
  }, 300)
}, { deep: true })

const { data, pending } = await useFetch<{ groups: Group[], total: number, page: number, totalPages: number }>('/api/groups', {
  key: 'groups',
  query: appliedQuery,
})

const allGroups = ref<Group[]>(data.value?.groups ?? [])
const currentPage = ref(data.value?.page ?? 1)
const totalPages = ref(data.value?.totalPages ?? 1)
const total = ref(data.value?.total ?? 0)
const loadingMore = ref(false)

watch(data, (newData) => {
  if (newData) {
    allGroups.value = newData.groups
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
    const result = await $fetch<{ groups: Group[], total: number, page: number, totalPages: number }>('/api/groups', {
      query: { ...appliedQuery.value, page: String(nextPage) },
    })
    allGroups.value = [...allGroups.value, ...result.groups]
    currentPage.value = result.page
    totalPages.value = result.totalPages
    total.value = result.total
  }
  catch {
    // Silent by design: catalog load failure shows empty state
  }
  finally {
    loadingMore.value = false
  }
}

// Синхронізація URL (без type - він в шляху)
watch(appliedQuery, (q) => {
  const params = new URLSearchParams(q)
  const qs = params.toString()
  router.replace(`/${locale.value}/catalog${qs ? `?${qs}` : ''}`)
}, { immediate: true })

const totalCount = computed(() => total.value)

const hasActiveFilters = computed(() =>
  filters.value.q
  || filters.value.type
  || filters.value.format
  || filters.value.dateFrom,
)

function resetFilters() {
  filters.value = { q: '', type: '', format: '', dateFrom: '' }
}

const canonicalUrl = computed(() => `${siteUrl}/${locale.value}/catalog`)

const jsonLd = computed(() => {
  if (!allGroups.value?.length) return ''
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    'name': t('seo.catalogTitle'),
    'itemListElement': allGroups.value.map((g, i) => ({
      '@type': 'ListItem',
      'position': i + 1,
      'name': g.title,
      'url': `${siteUrl}/${locale.value}/groups/${g.slug}`,
    })),
  })
})

useSeoPage({
  title: () => t('seo.catalogTitle'),
  description: () => t('seo.catalogDescription'),
  canonicalUrl: canonicalUrl.value,
  jsonLd: jsonLd.value,
})
</script>

<template>
  <div class="catalog-page">
    <header class="catalog-page__header">
      <h1 class="catalog-page__title">
        {{ t('pages.catalog.title') }}
      </h1>
      <p class="catalog-page__description">
        {{ t('pages.catalog.description') }}
      </p>
    </header>

    <GroupFilters
      v-model="filters"
      :total-count="totalCount"
      :loading="pending"
      live
    />

    <div
      v-if="pending"
      class="catalog-page__status"
    >
      {{ t('common.loading') }}
    </div>

    <div
      v-else-if="allGroups.length > 0"
      class="catalog-page__body"
    >
      <div class="catalog-page__grid">
        <GroupCard
          v-for="group in allGroups"
          :key="group.id"
          :group="group"
          back-source="catalog"
        />
      </div>

      <div
        v-if="hasMore"
        class="catalog-page__load-more"
      >
        <UiButton
          variant="secondary"
          :disabled="loadingMore"
          @click="loadMore"
        >
          {{ loadingMore ? t('common.loading') : t('pagination.loadMore') }}
        </UiButton>
        <span class="catalog-page__progress">
          {{ allGroups.length }} / {{ total }}
        </span>
      </div>
    </div>

    <div
      v-else-if="hasActiveFilters"
      class="catalog-page__empty"
    >
      <p class="catalog-page__empty-title">
        {{ t('common.noResults') }}
      </p>
      <p class="catalog-page__empty-text">
        {{ t('filters.noResultsHint') }}
      </p>
      <button
        type="button"
        class="catalog-page__reset-btn"
        @click="resetFilters"
      >
        {{ t('filters.reset') }}
      </button>
    </div>

    <div
      v-else
      class="catalog-page__status"
    >
      {{ t('pages.catalog.noGroups') }}
    </div>
  </div>
</template>

<style scoped>
.catalog-page {
  padding: var(--spacing-xl) var(--spacing-lg);
  max-width: var(--container-width);
  margin: 0 auto;
}

.catalog-page__header {
  margin-bottom: var(--spacing-xl);
}

.catalog-page__title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  margin: 0 0 var(--spacing-sm) 0;
  line-height: var(--line-height-tight);
}

.catalog-page__description {
  font-size: var(--font-size-lg);
  color: var(--color-text-muted);
  margin: 0;
  line-height: var(--line-height-normal);
}

.catalog-page__status {
  text-align: center;
  padding: var(--spacing-2xl);
  font-size: var(--font-size-lg);
  color: var(--color-text-muted);
}

.catalog-page__body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

.catalog-page__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--spacing-lg);
}

.catalog-page__load-more {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
}

.catalog-page__progress {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.catalog-page__empty {
  text-align: center;
  padding: var(--spacing-2xl);
}

.catalog-page__empty-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  margin: 0 0 var(--spacing-sm);
}

.catalog-page__empty-text {
  font-size: var(--font-size-md);
  color: var(--color-text-muted);
  margin: 0 0 var(--spacing-lg);
}

.catalog-page__reset-btn {
  display: inline-block;
  padding: var(--spacing-sm) var(--spacing-lg);
  border: var(--border-width) solid var(--color-primary);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-primary);
  font-family: var(--font-family-base);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all var(--transition-base);
}

.catalog-page__reset-btn:hover {
  background: var(--color-primary);
  color: var(--color-surface);
}
</style>
