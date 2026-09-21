<script setup lang="ts">
const props = withDefaults(defineProps<{
  items: Array<{ name: string, path?: string }>
  isIndexable?: boolean
}>(), {
  isIndexable: true,
})

const { t } = useLocale()
const requestURL = useRequestURL()
const route = useRoute()

// Truncate long names
function truncateName(name: string, maxLength = 40): { display: string, full: string } {
  if (name.length <= maxLength) {
    return { display: name, full: name }
  }
  return {
    display: name.slice(0, maxLength) + '…',
    full: name,
  }
}

// Mobile: show only last 2 items + ellipsis if more than 3
const visibleItems = computed(() => {
  if (props.items.length <= 3) {
    return props.items
  }
  // Show ellipsis + last 2 items
  return [
    { name: '…', path: undefined },
    ...props.items.slice(-2),
  ]
})

// Generate JSON-LD BreadcrumbList
const jsonLd = computed(() => {
  if (!props.isIndexable || props.items.length === 0) {
    return null
  }

  const itemListElement = props.items.map((item, index) => {
    const element: Record<string, unknown> = {
      '@type': 'ListItem',
      'position': index + 1,
      'name': item.name,
    }

    // Add item URL for all except last (or include last with current URL)
    if (item.path) {
      element.item = `${requestURL.origin}${item.path}`
    }
    else if (index === props.items.length - 1) {
      // Last item - use current URL
      element.item = `${requestURL.origin}${route.path}`
    }

    return element
  })

  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': itemListElement,
  })
})

// Add JSON-LD to head
useHead({
  script: jsonLd.value
    ? [{ type: 'application/ld+json', innerHTML: jsonLd.value }]
    : undefined,
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
        <NuxtLink
          v-if="item.path && index < visibleItems.length - 1"
          :to="item.path"
          class="breadcrumbs__link"
          :title="item.name"
        >
          {{ truncateName(item.name).display }}
        </NuxtLink>
        <span
          v-else
          aria-current="page"
          class="breadcrumbs__current"
          :title="item.name"
        >
          {{ truncateName(item.name).display }}
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
