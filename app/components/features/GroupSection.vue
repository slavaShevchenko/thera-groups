<script setup lang="ts">
interface SectionGroup {
  id: string
  slug: string
  title: string
  description: string
  format: string
  location: string | null
  price: number
  currency: string
  capacity: number
  startsAt: string
  organizer: {
    firstName: string
    lastName: string
    avatar: string | null
  }
}

withDefaults(
  defineProps<{
    title: string
    groups: SectionGroup[]
    description?: string
    linkTo?: string
    linkText?: string
  }>(),
  {
    description: '',
    linkTo: '',
    linkText: '',
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

    <div class="group-section__grid">
      <GroupCard
        v-for="group in groups"
        :key="group.id"
        :group="group"
      />
    </div>
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
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--spacing-lg);
}
</style>
