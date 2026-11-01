<script setup lang="ts">
import type { Group } from '~~/types'

withDefaults(
  defineProps<{
    title: string
    groups: Group[]
    description?: string
    linkTo?: string
    linkText?: string
    emptyText?: string
  }>(),
  {
    description: '',
    linkTo: '',
    linkText: '',
    emptyText: '',
  },
)
</script>

<template>
  <section class="group-section">
    <header class="group-section__header">
      <div class="group-section__heading">
        <h2 class="group-section__title">
          {{ title }}
        </h2>
        <p
          v-if="description"
          class="group-section__description"
        >
          {{ description }}
        </p>
      </div>

      <NuxtLink
        v-if="linkTo"
        :to="linkTo"
        class="group-section__link"
      >
        {{ linkText }}
        <UiIcon
          name="arrow-right"
          class="group-section__link-icon"
        />
      </NuxtLink>
    </header>

    <div
      v-if="groups.length > 0"
      class="group-section__grid"
    >
      <GroupCard
        v-for="group in groups"
        :key="group.id"
        :group="group"
      />
    </div>

    <!--
      A heading with nothing under it reads as a broken page. The caller supplies the
      wording, so this stays presentational and the "view all" link above still makes
      sense as the way out.
    -->
    <UiEmptyState
      v-else-if="emptyText"
      icon="🗓️"
      :title="emptyText"
    />
  </section>
</template>

<style scoped>
.group-section__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
}

.group-section__title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  margin: 0;
  line-height: var(--line-height-tight);
}

.group-section__description {
  font-size: var(--font-size-md);
  color: var(--color-text-muted);
  margin: var(--spacing-xs) 0 0;
}

.group-section__link {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  flex-shrink: 0;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-primary);
}

.group-section__link:hover {
  text-decoration: none;
  color: var(--color-primary-hover);
}

.group-section__link-icon {
  width: 1rem;
  height: 1rem;
}

.group-section__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(300px, 100%), 1fr));
  gap: var(--spacing-lg);
}
</style>
