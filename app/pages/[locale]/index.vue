<script setup lang="ts">
const { t, locale } = useLocale()
const requestURL = useRequestURL()

const { data: latestGroups, pending, error } = await useFetch('/api/groups/latest', {
  key: 'latest-groups',
})

// SEO
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
      <GroupSearch />
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
