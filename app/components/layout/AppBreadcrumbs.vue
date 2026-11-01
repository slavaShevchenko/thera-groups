<script setup lang="ts">
import type { BreadcrumbItem } from '~/composables/useBreadcrumbs'

interface VisibleBreadcrumbItem extends BreadcrumbItem {
  /** Marks the synthesized "…" placeholder, which is neither a link nor the current page. */
  ellipsis?: boolean
}

const props = withDefaults(defineProps<{
  items: BreadcrumbItem[]
  isIndexable?: boolean
}>(), {
  isIndexable: true,
})

const { t } = useLocale()
const siteUrl = useRuntimeConfig().public.siteUrl as string
const route = useRoute()

// Truncate long names. The full text still reaches the user through `title`.
function truncateName(name: string, maxLength = 40): string {
  return name.length <= maxLength ? name : name.slice(0, maxLength) + '…'
}

// Mobile: show only last 2 items + ellipsis if more than 3
const visibleItems = computed<VisibleBreadcrumbItem[]>(() => {
  if (props.items.length <= 3) {
    return props.items
  }
  // Show ellipsis + last 2 items
  return [
    { name: '…', ellipsis: true },
    ...props.items.slice(-2),
  ]
})

// Generate JSON-LD BreadcrumbList
const jsonLd = computed(() => buildBreadcrumbJsonLd({
  items: props.items,
  siteUrl,
  currentPath: route.path,
  indexable: props.isIndexable,
}))

/**
 * A computed, not `jsonLd.value`. The layout mounts this component once and keeps the
 * instance across SPA navigation, so a value read at setup froze the trail of whichever
 * page rendered first and every later route went on advertising it to crawlers.
 */
useHead({
  script: computed(() =>
    jsonLd.value
      ? [{ type: 'application/ld+json' as const, innerHTML: jsonLd.value }]
      : [],
  ),
})
</script>

<template>
  <nav
    v-if="items.length > 0"
    :aria-label="t('breadcrumbs.ariaLabel')"
    class="breadcrumbs"
  >
    <ol class="breadcrumbs__list">
      <li
        v-for="(item, index) in visibleItems"
        :key="index"
        class="breadcrumbs__item"
      >
        <!--
          The collapsed-steps placeholder is decorative: it is not a link, and above all
          not the current page, which is what an unmarked `v-else` branch made it look like
          to a screen reader.
        -->
        <span
          v-if="item.ellipsis"
          class="breadcrumbs__ellipsis"
          aria-hidden="true"
        >…</span>
        <NuxtLink
          v-else-if="item.path && index < visibleItems.length - 1"
          :to="item.path"
          class="breadcrumbs__link"
          :title="item.name"
        >
          {{ truncateName(item.name) }}
        </NuxtLink>
        <span
          v-else
          :aria-current="index === visibleItems.length - 1 ? 'page' : undefined"
          class="breadcrumbs__current"
          :title="item.name"
        >
          {{ truncateName(item.name) }}
        </span>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.breadcrumbs {
  margin-bottom: var(--spacing-md);
  font-size: var(--font-size-sm);
}

.breadcrumbs__list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-xs);
  list-style: none;
  margin: 0;
  padding: 0;
}

.breadcrumbs__item {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  line-height: 1.2;
}

/* Separator via CSS */
.breadcrumbs__item::before {
  content: '/';
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.breadcrumbs__item:first-child::before {
  content: none;
}

.breadcrumbs__link {
  color: var(--color-text-muted);
  text-decoration: none;
  transition: color var(--transition-base);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.breadcrumbs__link:hover {
  color: var(--color-primary);
}

.breadcrumbs__link:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

.breadcrumbs__current {
  color: var(--color-text);
  font-weight: var(--font-weight-medium);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.breadcrumbs__ellipsis {
  color: var(--color-text-muted);
}

/* Mobile: compact size */
@media (max-width: 640px) {
  .breadcrumbs {
    font-size: var(--font-size-xs);
  }

  .breadcrumbs__link,
  .breadcrumbs__current {
    max-width: 150px;
  }
}
</style>
