<script setup lang="ts">
const { t } = useLocale()

const { data: groups, pending, error } = await useFetch('/api/groups', {
  key: 'groups',
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

    <div
      v-if="pending"
      class="catalog-page__status"
    >
      {{ t('common.loading') }}
    </div>

    <div
      v-else-if="error"
      class="catalog-page__status catalog-page__status--error"
    >
      {{ t('common.errors.fetchFailed') }}
    </div>

    <div
      v-else-if="groups && groups.length > 0"
      class="catalog-page__grid"
    >
      <GroupCard
        v-for="group in groups"
        :key="group.id"
        :group="group"
      />
    </div>

    <div
      v-else
      class="catalog-page__status"
    >
      {{ t('pages.catalog.noGroups') }}
    </div>
  </div>
</template>

<style scoped>
.catalog-page {
  padding: var(--spacing-xl) var(--spacing-lg);
  max-width: var(--container-width);
  margin: 0 auto;
}

.catalog-page__header {
  margin-bottom: var(--spacing-2xl);
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

.catalog-page__status {
  text-align: center;
  padding: var(--spacing-2xl);
  font-size: var(--font-size-lg);
  color: var(--color-text-muted);
}

.catalog-page__status--error {
  color: var(--color-error);
}

.catalog-page__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--spacing-lg);
}
</style>
