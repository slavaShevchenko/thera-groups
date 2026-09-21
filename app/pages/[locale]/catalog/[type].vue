<script setup lang="ts">
import { slugToGroupTypeEnum } from '~~/shared/utils/groupTypeSlug'

const { t, locale } = useLocale()
const route = useRoute()

const typeSlug = computed(() => route.params.type as string)
const groupType = computed(() => slugToGroupTypeEnum(typeSlug.value))

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
const canonicalUrl = computed(() => `${siteUrl}/${locale.value}/catalog/${typeSlug.value}`)

useSeoPage({
  title: () => seoTitle.value,
  description: () => seoDescription.value,
  canonicalUrl: canonicalUrl.value,
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

    <CatalogGroupCatalogList
      :fixed-type="groupType"
      :show-type-filter="false"
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
