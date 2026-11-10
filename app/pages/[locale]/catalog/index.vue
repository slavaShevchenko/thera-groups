<script setup lang="ts">
const { t, pathLocale } = useLocale()
const siteUrl = useRuntimeConfig().public.siteUrl as string

const canonicalUrl = computed(() => `${siteUrl}/${pathLocale.value}/catalog`)

const jsonLd = computed(() => {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    'name': t('seo.catalogTitle'),
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
