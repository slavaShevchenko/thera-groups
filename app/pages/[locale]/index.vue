<script setup lang="ts">
import type { Filters, Group } from '~~/types'
import { groupTypeToSlug } from '~~/shared/utils/groupTypeSlug'

const { t, locale } = useLocale()
const requestURL = useRequestURL()

const filters = ref<Filters>({
  q: '',
  type: '',
  format: '',
  dateFrom: '',
})

function onSearchSubmit() {
  const params = new URLSearchParams()
  if (filters.value.q) params.set('q', filters.value.q)
  if (filters.value.format) params.set('format', filters.value.format)
  if (filters.value.dateFrom) params.set('dateFrom', filters.value.dateFrom)

  const qs = params.toString()

  // Если выбран тип - переходим на /catalog/[type]
  if (filters.value.type) {
    const slug = groupTypeToSlug(filters.value.type)
    if (slug) {
      navigateTo(`/${locale.value}/catalog/${slug}${qs ? `?${qs}` : ''}`)
      return
    }
  }

  // Иначе - на главный каталог
  navigateTo(`/${locale.value}/catalog${qs ? `?${qs}` : ''}`)
}

const { data: latestGroups, pending, error } = await useFetch<Group[]>('/api/groups/latest', {
  key: 'latest-groups',
})

useSeoPage({
  title: () => t('seo.homeTitle'),
  description: () => t('seo.homeDescription'),
  canonicalUrl: () => `${requestURL.origin}/${locale.value}`,
})
</script>

<template>
  <div class="home-page">
    <HeroSection
      :title="t('pages.home.heroTitle')"
      :description="t('pages.home.heroDescription')"
    >
      <GroupFilters
        v-model="filters"
        :submit-label="t('common.show')"
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
        :link-to="`/${locale}/catalog`"
        :link-text="t('pages.home.showAll')"
      />

      <HowItWorksSection />
    </div>

    <!-- TODO: позже — блоки «популярные» и «спонсируемые» -->
  </div>
</template>

<style scoped>
.home-page__content {
  max-width: var(--container-width);
  margin: 0 auto;
  padding: 0 var(--spacing-lg);
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

@media (max-width: 768px) {
  .home-page__content {
    padding: 0 var(--spacing-md);
  }
}
</style>
