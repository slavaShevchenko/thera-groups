<script setup lang="ts">
interface OrganizerListItem {
  id: string
  firstName: string
  lastName: string
  slug: string
  avatarUrl: string | null
  city: string | null
  experienceYears: number | null
  specializations: string[]
  groupsCount: number
}

const { t, locale } = useLocale()

const siteUrl = useRuntimeConfig().public.siteUrl as string
const canonicalUrl = computed(() => `${siteUrl}/${locale.value}/organizers`)

useSeoPage({
  title: () => t('seo.organizersTitle'),
  description: () => t('seo.organizersDescription'),
  canonicalUrl: canonicalUrl.value,
})

const { data: organizers, pending } = await useAsyncData(
  'organizers-catalog',
  () => $fetch<OrganizerListItem[]>('/api/organizers'),
)

const organizersCount = computed(() =>
  organizers.value?.length ?? 0,
)
</script>

<template>
  <div class="organizers-page">
    <header class="organizers-page__header">
      <h1 class="organizers-page__title">
        {{ t('common.organizers') }}
      </h1>
    </header>

    <div class="organizers-page__content">
      <p class="organizers-page__count">
        {{ t('organizers.found', { count: String(organizersCount) }) }}
      </p>

      <div
        v-if="pending"
        class="organizers-page__status"
      >
        {{ t('common.loading') }}
      </div>

      <div
        v-else-if="organizers && organizers.length > 0"
        class="organizers-page__grid"
      >
        <OrganizerCatalogCard
          v-for="organizer in organizers"
          :key="organizer.id"
          :organizer="organizer"
        />
      </div>

      <div
        v-else
        class="organizers-page__status"
      >
        {{ t('organizers.empty') }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.organizers-page {
  padding: var(--spacing-xl) var(--spacing-lg);
  max-width: var(--container-width);
  margin: 0 auto;
}

.organizers-page__header {
  margin-bottom: var(--spacing-lg);
}

.organizers-page__title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  margin: 0;
  line-height: var(--line-height-tight);
}

.organizers-page__content {
  min-width: 0;
}

.organizers-page__count {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin: 0 0 var(--spacing-md) 0;
}

.organizers-page__status {
  text-align: center;
  padding: var(--spacing-2xl);
  font-size: var(--font-size-lg);
  color: var(--color-text-muted);
}

.organizers-page__grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--spacing-lg);
}

@media (max-width: 1100px) {
  .organizers-page__grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .organizers-page__grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .organizers-page__grid {
    grid-template-columns: 1fr;
  }
}
</style>
