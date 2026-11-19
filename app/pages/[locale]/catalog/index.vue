<script setup lang="ts">
import type { Group } from '~~/types'

const { t, pathLocale, locale } = useLocale()
const siteUrl = useRuntimeConfig().public.siteUrl as string

const canonicalUrl = computed(() => `${siteUrl}/${pathLocale.value}/catalog`)

// Fetch groups for ItemList JSON-LD (only slugs needed for SEO)
const { data: groupsData } = await useFetch<{ groups: Pick<Group, 'slug'>[] }>('/api/groups', {
  key: 'catalog-jsonld-groups',
  query: { limit: '100' },
  transform: res => ({ groups: res.groups.map(g => ({ slug: g.slug })) }),
})

const jsonLd = computed(() => {
  const groups = groupsData.value?.groups ?? []
  const itemListElement = groups.map((group, index) => ({
    '@type': 'ListItem' as const,
    'position': index + 1,
    'url': `${siteUrl}/${locale.value}/groups/${group.slug}`,
  }))

  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    'name': t('seo.catalogTitle'),
    'numberOfItems': groups.length,
    itemListElement,
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

    <CatalogCategoryLinks />

    <GroupCatalogList />
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
</style>
