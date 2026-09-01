<script setup lang="ts">
const { t, locale } = useLocale()
const route = useRoute()
const router = useRouter()
const requestURL = useRequestURL()

interface Filters {
  q: string
  type: string
  format: string
  dateFrom: string
}

// Синхронная инициализация из URL (работает и на SSR)
const routeQuery = route.query

const filters = ref<Filters>({
  q: typeof routeQuery.q === 'string' ? routeQuery.q : '',
  type: typeof routeQuery.type === 'string' ? routeQuery.type : '',
  format: typeof routeQuery.format === 'string' ? routeQuery.format : '',
  dateFrom: typeof routeQuery.dateFrom === 'string' ? routeQuery.dateFrom : '',
})

const queryParams = computed(() => {
  const params: Record<string, string> = {}
  if (filters.value.q) params.q = filters.value.q
  if (filters.value.type) params.type = filters.value.type
  if (filters.value.format) params.format = filters.value.format
  if (filters.value.dateFrom) params.dateFrom = filters.value.dateFrom
  return params
})

// То, что реально уходит в API (с debounce)
const appliedQuery = ref<Record<string, string>>({ ...queryParams.value })

let filterDebounce: ReturnType<typeof setTimeout> | null = null

watch(filters, () => {
  if (filterDebounce) clearTimeout(filterDebounce)
  filterDebounce = setTimeout(() => {
    appliedQuery.value = { ...queryParams.value }
  }, 300)
}, { deep: true })

const { data: groups, pending, error } = await useFetch('/api/groups', {
  key: 'groups',
  query: appliedQuery,
})

// Синхронизация URL
watch(appliedQuery, (q) => {
  const params = new URLSearchParams(q)
  const qs = params.toString()
  router.replace(`/${locale.value}/groups${qs ? `?${qs}` : ''}`)
}, { immediate: true })

const totalCount = computed(() => groups.value?.length ?? 0)

const hasActiveFilters = computed(() =>
  filters.value.q
  || filters.value.type
  || filters.value.format
  || filters.value.dateFrom,
)

function resetFilters() {
  filters.value = { q: '', type: '', format: '', dateFrom: '' }
}

const canonicalUrl = computed(() => `${requestURL.origin}/${locale.value}/groups`)

useHead({
  title: () => t('seo.catalogTitle'),
  link: [
    { rel: 'canonical', href: canonicalUrl },
  ],
  meta: [
    { name: 'description', content: () => t('seo.catalogDescription') },
    { name: 'robots', content: 'index, follow' },
    { property: 'og:title', content: () => t('seo.catalogTitle') },
    { property: 'og:description', content: () => t('seo.catalogDescription') },
    { property: 'og:url', content: canonicalUrl },
    { property: 'og:type', content: 'website' },
  ],
})

const localeHead = useLocaleHead()
useHead(localeHead)
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
      v-else-if="error"
      class="catalog-page__status catalog-page__status--error"
    >
      {{ t('common.errors.fetchFailed') }}
    </div>

    <div
      v-else-if="groups && groups.length > 0"
      class="catalog-page__grid"
    >
      <GroupCard
        v-for="group in groups"
        :key="group.id"
        :group="group"
        back-source="catalog"
      />
    </div>

    <div
      v-else-if="hasActiveFilters"
      class="catalog-page__empty"
    >
      <p class="catalog-page__empty-title">
        {{ t('filters.noResults') }}
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

.catalog-page__status--error {
  color: var(--color-error);
}

.catalog-page__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--spacing-lg);
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
