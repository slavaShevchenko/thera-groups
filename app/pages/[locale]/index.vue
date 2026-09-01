<script setup lang="ts">
const { t, locale } = useLocale()
const requestURL = useRequestURL()

interface Filters {
  q: string
  type: string
  format: string
  dateFrom: string
}

const filters = ref<Filters>({
  q: '',
  type: '',
  format: '',
  dateFrom: '',
})

const queryParams = computed(() => {
  const params: Record<string, string> = {}
  if (filters.value.q) params.q = filters.value.q
  if (filters.value.type) params.type = filters.value.type
  if (filters.value.format) params.format = filters.value.format
  if (filters.value.dateFrom) params.dateFrom = filters.value.dateFrom
  return params
})

const appliedQuery = ref<Record<string, string>>({})

let filterDebounce: ReturnType<typeof setTimeout> | null = null

watch(filters, () => {
  if (filterDebounce) clearTimeout(filterDebounce)
  filterDebounce = setTimeout(() => {
    appliedQuery.value = { ...queryParams.value }
  }, 300)
}, { deep: true })

const { data: filteredGroups, pending: countPending } = await useFetch('/api/groups', {
  key: 'home-filter-count',
  query: appliedQuery,
})

const totalCount = computed(() => filteredGroups.value?.length ?? null)

function onSearchSubmit() {
  const params = new URLSearchParams()
  if (filters.value.q) params.set('q', filters.value.q)
  if (filters.value.type) params.set('type', filters.value.type)
  if (filters.value.format) params.set('format', filters.value.format)
  if (filters.value.dateFrom) params.set('dateFrom', filters.value.dateFrom)

  const qs = params.toString()
  navigateTo(`/${locale.value}/groups${qs ? `?${qs}` : ''}`)
}

const { data: latestGroups, pending, error } = await useFetch('/api/groups/latest', {
  key: 'latest-groups',
})

const canonicalUrl = computed(() => `${requestURL.origin}/${locale.value}`)

useHead({
  title: () => t('seo.homeTitle'),
  link: [
    { rel: 'canonical', href: canonicalUrl.value },
  ],
  meta: [
    { name: 'description', content: () => t('seo.homeDescription') },
    { name: 'robots', content: 'index, follow' },
    { property: 'og:title', content: () => t('seo.homeTitle') },
    { property: 'og:description', content: () => t('seo.homeDescription') },
    { property: 'og:url', content: canonicalUrl.value },
    { property: 'og:type', content: 'website' },
  ],
})

const localeHead = useLocaleHead()
useHead(localeHead)
</script>

<template>
  <div class="home-page">
    <HeroSection
      :title="t('pages.home.heroTitle')"
      :description="t('pages.home.heroDescription')"
    >
      <GroupFilters
        v-model="filters"
        :submit-label="t('pages.home.searchButton')"
        :total-count="totalCount"
        :loading="countPending"
        @submit="onSearchSubmit"
      />
    </HeroSection>
    <div class="home-page__content">
      <div
        v-if="pending"
        class="home-page__status"
      >
        {{ t('common.loading') }}
      </div>

      <div
        v-else-if="error"
        class="home-page__status home-page__status--error"
      >
        {{ t('common.errors.fetchFailed') }}
      </div>

      <GroupSection
        v-else
        :title="t('pages.home.latestGroups')"
        :groups="latestGroups ?? []"
        :link-to="`/${locale}/groups`"
        :link-text="t('pages.home.showAll')"
      />
    </div>

    <!-- TODO: позже — блоки «популярные» и «спонсируемые» -->
  </div>
</template>

<style scoped>
.home-page__content {
  max-width: var(--container-width);
  margin: 0 auto;
}

.home-page__status {
  text-align: center;
  padding: var(--spacing-2xl);
  font-size: var(--font-size-lg);
  color: var(--color-text-muted);
}

.home-page__status--error {
  color: var(--color-error);
}
</style>
