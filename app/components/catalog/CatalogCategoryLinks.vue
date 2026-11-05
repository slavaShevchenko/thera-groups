<script setup lang="ts">
import { GROUP_TYPES } from '~~/shared/constants/groupTypes'

const props = withDefaults(
  defineProps<{
    /** Group type value of the page rendering this nav, e.g. `CONFERENCE`. Omit on `/catalog`. */
    activeType?: string
  }>(),
  {
    activeType: undefined,
  },
)

const { t, locale } = useLocale()

const categories = computed(() =>
  GROUP_TYPES.map(type => ({
    value: type.value,
    label: t(`groupTypes.${type.value}`),
    to: `/${locale.value}/catalog/${type.slug}`,
  })),
)
</script>

<template>
  <nav
    class="category-links"
    :aria-label="t('catalog.categoriesLabel')"
  >
    <ul class="category-links__list">
      <li class="category-links__item">
        <NuxtLink
          class="category-links__link"
          :class="{ 'category-links__link--active': !props.activeType }"
          :aria-current="props.activeType ? undefined : 'page'"
          :to="`/${locale}/catalog`"
        >
          {{ t('catalog.allCategories') }}
        </NuxtLink>
      </li>

      <li
        v-for="category in categories"
        :key="category.value"
        class="category-links__item"
      >
        <NuxtLink
          class="category-links__link"
          :class="{ 'category-links__link--active': category.value === props.activeType }"
          :aria-current="category.value === props.activeType ? 'page' : undefined"
          :to="category.to"
        >
          {{ category.label }}
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.category-links {
  margin-bottom: var(--spacing-xl);
}

.category-links__list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  margin: 0;
  padding: 0;
  list-style: none;
}

.category-links__item {
  margin: 0;
}

.category-links__link {
  display: inline-flex;
  align-items: center;
  padding: var(--spacing-xs) var(--spacing-md);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  line-height: var(--line-height-tight);
  text-decoration: none;
  white-space: nowrap;
  transition: background-color var(--transition-base), color var(--transition-base),
    border-color var(--transition-base);
}

.category-links__link:hover {
  border-color: var(--color-primary);
  color: var(--color-primary-text);
}

.category-links__link:focus-visible {
  outline: 2px solid var(--color-primary-text);
  outline-offset: 2px;
}

.category-links__link--active,
.category-links__link--active:hover {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-white);
}
</style>
