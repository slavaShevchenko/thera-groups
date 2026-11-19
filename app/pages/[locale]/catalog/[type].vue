<script setup lang="ts">
import type { Group } from '~~/types'
import { slugToGroupType } from '~~/shared/constants/groupTypes'

const { t, pathLocale, locale } = useLocale()
const route = useRoute()

const typeSlug = computed(() => route.params.type as string)
const groupType = computed(() => slugToGroupType(typeSlug.value))

if (!groupType.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Group type not found',
  })
}

const typeTitle = computed(() => t(`groupTypes.${groupType.value}`))
const seoTitle = computed(() => t(`seo.typePages.${typeSlug.value}.title`, { type: typeTitle.value }))
const seoDescription = computed(() => t(`seo.typePages.${typeSlug.value}.description`, { type: typeTitle.value }))
const pageDescription = computed(() => t(`typePages.${typeSlug.value}.description`, { type: typeTitle.value }))

const siteUrl = useRuntimeConfig().public.siteUrl as string
const canonicalUrl = computed(() => `${siteUrl}/${pathLocale.value}/catalog/${typeSlug.value}`)

// Fetch groups of this type for ItemList JSON-LD
const { data: groupsData } = await useFetch<{ groups: Pick<Group, 'slug'>[] }>('/api/groups', {
  key: computed(() => `catalog-type-jsonld-${typeSlug.value}`),
  query: { type: groupType, limit: '100' },
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
    'name': seoTitle.value,
    'numberOfItems': groups.length,
    itemListElement,
  })
})

useSeoPage({
  title: () => seoTitle.value,
  description: () => seoDescription.value,
  canonicalUrl: canonicalUrl.value,
  jsonLd: jsonLd.value,
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

    <CatalogCategoryLinks
      :active-type="groupType"
    />

    <GroupCatalogList
      :fixed-type="groupType"
    />
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
</style>
