<script setup lang="ts">
import type { Filters, Group } from '~~/types'
import { slugToGroupTypeEnum, groupTypeToSlug } from '~~/shared/utils/groupTypeSlug'

const { t, locale } = useLocale()
const route = useRoute()
const router = useRouter()
const requestURL = useRequestURL()

const typeSlug = route.params.type as string
const groupType = slugToGroupTypeEnum(typeSlug)

// If invalid type slug, show 404
if (!groupType) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Group type not found',
  })
}

const routeQuery = route.query

const filters = ref<Filters>({
  q: typeof routeQuery.q === 'string' ? routeQuery.q : '',
  type: groupType,
  format: typeof routeQuery.format === 'string' ? routeQuery.format : '',
  dateFrom: typeof routeQuery.dateFrom === 'string' ? routeQuery.dateFrom : '',
})

// When type is selected, redirect to /catalog/[type]
// When type is cleared, redirect to /catalog
watch(() => filters.value.type, (newType) => {
  if (!newType) {
    // Type cleared - return to main catalog
    router.push(`/${locale.value}/catalog`)
  }
  else if (newType !== groupType) {
    // Type changed - go to new type page
    const slug = groupTypeToSlug(newType)
    if (slug) {
      router.push(`/${locale.value}/catalog/${slug}`)
    }
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
  // Якщо змінився type - не оновлюємо appliedQuery (буде редирект)
  if (newFilters.type !== oldFilters?.type) {
    return
  }
  filterDebounce = setTimeout(() => {
    appliedQuery.value = { ...queryParams.value }
  }, 300)
}, { deep: true })

const { data, pending } = await useFetch<{ groups: Group[], total: number, page: number, totalPages: number }>('/api/groups', {
  key: `groups-type-${groupType}`,
  query: computed(() => ({ ...appliedQuery.value, type: groupType })),
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
      query: { ...appliedQuery.value, type: groupType, page: String(nextPage) },
    })
    allGroups.value = [...allGroups.value, ...result.groups]
    currentPage.value = result.page
    totalPages.value = result.totalPages
    total.value = result.total
  }
  catch {
    // ignore
  }
  finally {
    loadingMore.value = false
  }
}

// Sync URL (without type since it's in the path)
watch(appliedQuery, (q) => {
  const params = new URLSearchParams(q)
  const qs = params.toString()
  router.replace(`/${locale.value}/catalog/${typeSlug}${qs ? `?${qs}` : ''}`)
}, { immediate: true })

const totalCount = computed(() => total.value)

// SEO
const typeTitle = computed(() => t(`groupTypes.${groupType}`))
const seoTitle = computed(() => t(`seo.typePages.${typeSlug}.title`, { type: typeTitle.value }))
const seoDescription = computed(() => t(`seo.typePages.${typeSlug}.description`, { type: typeTitle.value }))
const pageDescription = computed(() => t(`typePages.${typeSlug}.description`, { type: typeTitle.value }))

const canonicalUrl = computed(() => `${requestURL.origin}/${locale.value}/catalog/${typeSlug}`)

const jsonLd = computed(() => {
  if (!allGroups.value?.length) return undefined
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    'name': seoTitle.value,
    'description': seoDescription.value,
    'itemListElement': allGroups.value.map((g, i) => ({
      '@type': 'ListItem',
      'position': i + 1,
      'name': g.title,
      'url': `${requestURL.origin}/${locale.value}/groups/${g.slug}`,
    })),
  })
})

useSeoPage({
  title: () => seoTitle.value,
  description: () => seoDescription.value,
  canonicalUrl: canonicalUrl.value,
  jsonLd: () => jsonLd.value ?? '',
})
</script>

<template>
  <div class="type-catalog">
    <div class="type-catalog__header">
      <h1 class="type-catalog__title">
        {{ typeTitle }}
      </h1>
      <p class="type-catalog__description">
        {{ pageDescription }}
      </p>
    </div>

    <GroupFilters
      v-model="filters"
      :show-type="false"
      :total-count="totalCount"
      :loading="pending"
      live
    />

    <div
      v-if="pending"
      class="type-catalog__loading"
    >
      {{ t('common.loading') }}
    </div>

    <div
      v-else-if="!allGroups.length"
      class="type-catalog__empty"
    >
      <p>{{ t('typePages.noResults') }}</p>
      <NuxtLink :to="`/${locale}/catalog`">
        {{ t('common.browseGroups') }}
      </NuxtLink>
    </div>

    <template v-else>
      <div class="type-catalog__grid">
        <GroupCard
          v-for="group in allGroups"
          :key="group.id"
          :group="group"
          back-source="catalog"
        />
      </div>

      <div
        v-if="hasMore"
        class="type-catalog__load-more"
      >
        <UiButton
          variant="secondary"
          :disabled="loadingMore"
          @click="loadMore"
        >
          {{ loadingMore ? t('common.loading') : t('pagination.loadMore') }}
        </UiButton>
        <span class="type-catalog__progress">
          {{ allGroups.length }} / {{ total }}
        </span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.type-catalog {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--spacing-xl) var(--spacing-md);
}

.type-catalog__header {
  margin-bottom: var(--spacing-xl);
}

.type-catalog__title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  margin: 0 0 var(--spacing-md);
}

.type-catalog__description {
  font-size: var(--font-size-lg);
  color: var(--color-text-secondary);
  margin: 0 0 var(--spacing-sm);
  line-height: 1.6;
}

.type-catalog__loading,
.type-catalog__empty {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--color-text-muted);
}

.type-catalog__empty a {
  color: var(--color-primary);
  text-decoration: underline;
}

.type-catalog__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--spacing-lg);
}

.type-catalog__load-more {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-xl);
}

.type-catalog__progress {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}
</style>
