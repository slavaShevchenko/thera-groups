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
  // Если изменился type - не обновляем appliedQuery (будет редирект)
  if (newFilters.type !== oldFilters?.type) {
    return
  }
  filterDebounce = setTimeout(() => {
    appliedQuery.value = { ...queryParams.value }
  }, 300)
}, { deep: true })

const { data: groups, pending } = await useFetch<Group[]>('/api/groups', {
  key: `groups-type-${groupType}`,
  query: computed(() => ({ ...appliedQuery.value, type: groupType })),
})

// Sync URL (without type since it's in the path)
watch(appliedQuery, (q) => {
  const params = new URLSearchParams(q)
  const qs = params.toString()
  router.replace(`/${locale.value}/catalog/${typeSlug}${qs ? `?${qs}` : ''}`)
}, { immediate: true })

const totalCount = computed(() => groups.value?.length ?? 0)

// SEO
const typeTitle = computed(() => t(`groupTypes.${groupType}`))
const seoTitle = computed(() => t(`seo.typePages.${typeSlug}.title`, { type: typeTitle.value }))
const seoDescription = computed(() => t(`seo.typePages.${typeSlug}.description`, { type: typeTitle.value }))
const pageDescription = computed(() => t(`typePages.${typeSlug}.description`, { type: typeTitle.value }))

const canonicalUrl = computed(() => `${requestURL.origin}/${locale.value}/catalog/${typeSlug}`)

const jsonLd = computed(() => {
  if (!groups.value?.length) return undefined
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    'name': seoTitle.value,
    'description': seoDescription.value,
    'itemListElement': groups.value.map((g, i) => ({
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
      v-else-if="!groups?.length"
      class="type-catalog__empty"
    >
      <p>{{ t('typePages.noResults') }}</p>
      <NuxtLink :to="`/${locale}/catalog`">
        {{ t('common.browseGroups') }}
      </NuxtLink>
    </div>

    <div
      v-else
      class="type-catalog__grid"
    >
      <GroupCard
        v-for="group in groups"
        :key="group.id"
        :group="group"
        back-source="catalog"
      />
    </div>
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
</style>
