<script setup lang="ts">
const { t, locale } = useLocale()

const { data: latestGroups, pending, error } = await useFetch('/api/groups/latest', {
  key: 'latest-groups',
})
</script>

<template>
  <div class="home-page">
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

    <!-- TODO: позже — блоки «популярные» и «спонсируемые» -->
  </div>
</template>

<style scoped>
.home-page {
  padding: var(--spacing-xl) var(--spacing-lg);
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
