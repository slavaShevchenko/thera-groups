<script setup lang="ts">
import type { Filters, Group } from '~~/types'
import { groupTypeToSlug } from '~~/shared/constants/groupTypes'

const props = withDefaults(
  defineProps<{
    fixedType?: string
    showTypeFilter?: boolean
  }>(),
  {
    fixedType: undefined,
    showTypeFilter: true,
  },
)

const { t, locale } = useLocale()
const route = useRoute()
const router = useRouter()

const routeQuery = route.query

const filters = ref<Filters>({
  q: typeof routeQuery.q === 'string' ? routeQuery.q : '',
  type: props.fixedType || '',
  format: typeof routeQuery.format === 'string' ? routeQuery.format : '',
  dateFrom: typeof routeQuery.dateFrom === 'string' ? routeQuery.dateFrom : '',
})

watch(() => filters.value.type, (newType) => {
  if (!props.showTypeFilter) return
  if (newType) {
    const slug = groupTypeToSlug(newType)
    if (slug) {
      router.push(`/${locale.value}/catalog/${slug}`)
    }
  }
  else if (props.fixedType) {
    router.push(`/${locale.value}/catalog`)
  }
})

const queryParams = computed(() => {
  const params: Record<string, string> = {}
  if (filters.value.q) params.q = filters.value.q
  if (filters.value.format) params.format = filters.value.format
  if (filters.value.dateFrom) params.dateFrom = filters.value.dateFrom
  return params
})

const appliedQuery = ref<Record<string, string>>({ ...queryParams.value })

let filterDebounce: ReturnType<typeof setTimeout> | null = null

watch(filters, (newFilters, oldFilters) => {
  if (filterDebounce) clearTimeout(filterDebounce)
  if (newFilters.type !== oldFilters?.type) {
    return
  }
  filterDebounce = setTimeout(() => {
    appliedQuery.value = { ...queryParams.value }
  }, 300)
}, { deep: true })

const fetchQuery = computed(() => {
  const q = { ...appliedQuery.value }
  if (props.fixedType) q.type = props.fixedType
  return q
})

const { data, pending, error: fetchError, refresh } = await useFetch<{ groups: Group[], total: number, page: number, totalPages: number }>('/api/groups', {
  key: computed(() => props.fixedType ? `groups-type-${props.fixedType}` : 'groups'),
  query: fetchQuery,
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
    const query = { ...appliedQuery.value }
    if (props.fixedType) query.type = props.fixedType
    const result = await $fetch<{ groups: Group[], total: number, page: number, totalPages: number }>('/api/groups', {
      query: { ...query, page: String(nextPage) },
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

watch(appliedQuery, (q) => {
  const params = new URLSearchParams(q)
  const qs = params.toString()
  const typeSegment = props.fixedType ? groupTypeToSlug(props.fixedType) : ''
  const basePath = typeSegment
    ? `/${locale.value}/catalog/${typeSegment}`
    : `/${locale.value}/catalog`
  router.replace(`${basePath}${qs ? `?${qs}` : ''}`)
}, { immediate: true })

const totalCount = computed(() => total.value)

const hasActiveFilters = computed(() =>
  filters.value.q
  || filters.value.type
  || filters.value.format
  || filters.value.dateFrom,
)

function resetFilters() {
  filters.value = { q: '', type: props.fixedType || '', format: '', dateFrom: '' }
}

onBeforeUnmount(() => {
  if (filterDebounce) clearTimeout(filterDebounce)
})
</script>

<template>
  <div class="catalog-list">
    <GroupFilters
      v-model="filters"
      :show-type="showTypeFilter"
      :total-count="totalCount"
      :loading="pending"
      live
    />

    <div
      v-if="pending"
      class="catalog-list__status"
    >
      {{ t('common.loading') }}
    </div>

    <div
      v-else-if="fetchError"
      class="catalog-list__error"
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
      v-else-if="allGroups.length > 0"
      class="catalog-list__body"
    >
      <div class="catalog-list__grid">
        <GroupCard
          v-for="group in allGroups"
          :key="group.id"
          :group="group"
          back-source="catalog"
        />
      </div>

      <div
        v-if="hasMore"
        class="catalog-list__load-more"
      >
        <UiButton
          variant="secondary"
          :disabled="loadingMore"
          @click="loadMore"
        >
          {{ loadingMore ? t('common.loading') : t('pagination.loadMore') }}
        </UiButton>
        <span class="catalog-list__progress">
          {{ allGroups.length }} / {{ total }}
        </span>
      </div>
    </div>

    <div
      v-else-if="hasActiveFilters"
      class="catalog-list__empty"
    >
      <p class="catalog-list__empty-title">
        {{ t('common.noResults') }}
      </p>
      <p class="catalog-list__empty-text">
        {{ t('filters.noResultsHint') }}
      </p>
      <UiButton
        variant="secondary"
        @click="resetFilters"
      >
        {{ t('filters.reset') }}
      </UiButton>
    </div>

    <div
      v-else
      class="catalog-list__status"
    >
      <slot name="empty">
        {{ t('pages.catalog.noGroups') }}
      </slot>
    </div>
  </div>
</template>

<style scoped>
.catalog-list__error {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--color-error-text);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
}

.catalog-list__status {
  text-align: center;
  padding: var(--spacing-2xl);
  font-size: var(--font-size-lg);
  color: var(--color-text-muted);
}

.catalog-list__body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

.catalog-list__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(300px, 100%), 1fr));
  gap: var(--spacing-lg);
}

.catalog-list__load-more {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
}

.catalog-list__progress {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.catalog-list__empty {
  text-align: center;
  padding: var(--spacing-2xl);
}

.catalog-list__empty-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  margin: 0 0 var(--spacing-sm);
}

.catalog-list__empty-text {
  font-size: var(--font-size-md);
  color: var(--color-text-muted);
  margin: 0 0 var(--spacing-lg);
}
</style>
