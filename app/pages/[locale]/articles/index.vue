<script setup lang="ts">
import type { ArticleListItem } from '~~/types'

interface ArticlesResponse {
  articles: ArticleListItem[]
  total: number
  page: number
  totalPages: number
}

const { t, pathLocale } = useLocale()
const route = useRoute()
const siteUrl = useRuntimeConfig().public.siteUrl as string

/**
 * The page number, from the URL rather than from component state.
 *
 * A query param so a page of the list is a shareable, crawlable address. "Load more" — what
 * the organizer catalog does — appends into one document, which leaves every article past the
 * first ten reachable only by running JavaScript. Here the pagination is real `<a href>`s, so
 * a crawler walks the whole archive on its own.
 */
const pageParam = computed(() => {
  const raw = Number(route.query.page)
  return Number.isInteger(raw) && raw > 0 ? raw : 1
})

const basePath = computed(() => `/${pathLocale.value}/articles`)

/**
 * Self-referencing, and page 1 carries no `?page=1`. A canonical pointing every page at the
 * first one is how an archive gets its back half deindexed; a canonical with `?page=1` on the
 * clean URL is a second address for a page that already has one.
 */
const canonicalUrl = computed(() =>
  pageParam.value > 1
    ? `${siteUrl}${basePath.value}?page=${pageParam.value}`
    : `${siteUrl}${basePath.value}`,
)

const { data, status, error: fetchError, refresh } = await useAsyncData<ArticlesResponse>(
  computed(() => `articles-list-${pathLocale.value}`),
  () => $fetch<ArticlesResponse>('/api/articles', {
    query: { page: String(pageParam.value), locale: pathLocale.value },
  }),
  { watch: [() => route.query.page, pathLocale] },
)

// A page number past the end is a 404, not an empty list. Serving 200 with no items is the
// soft-404 Google says it drops from the index, and it is also the answer a stale `?page=12`
// link in somebody's bookmarks deserves.
if (data.value && pageParam.value > data.value.totalPages) {
  throw createError({ statusCode: 404, statusMessage: 'Articles page not found' })
}

const articles = computed<ArticleListItem[]>(() => data.value?.articles ?? [])
const totalPages = computed(() => data.value?.totalPages ?? 1)
const isLoading = computed(() => status.value === 'pending')

function pageUrl(page: number): string {
  return page > 1 ? `${basePath.value}?page=${page}` : basePath.value
}

/**
 * An `ItemList` of the articles on this page, and only on page 1.
 *
 * Page 1 is the one a crawler and a human both treat as "the list of articles"; the same
 * markup on page 7 would describe seven items as the whole collection. The later pages are
 * still fully described by their canonical and hreflang set.
 */
const jsonLd = computed(() => {
  if (pageParam.value > 1 || articles.value.length === 0) return ''

  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    'name': t('seo.articlesTitle'),
    // The number of ListItems below, not the size of the whole archive: `numberOfItems`
    // describes the list this markup contains, and a value that disagrees with it is the
    // kind of inconsistency the rich-result test reports rather than ignores.
    'numberOfItems': articles.value.length,
    'itemListElement': articles.value.map((article, index) => ({
      '@type': 'ListItem' as const,
      'position': index + 1,
      'url': `${siteUrl}/${pathLocale.value}/articles/${article.slug}`,
    })),
  })
})

useSeoPage({
  // `seo.articlesTitle` already ends in the site name, so the page marker goes in front of
  // it. Appending `— Сторінка 2 | PsyGroup` instead would put the brand on one title twice.
  title: () => pageParam.value > 1
    ? `${t('pagination.page')} ${pageParam.value} — ${t('seo.articlesTitle')}`
    : t('seo.articlesTitle'),
  description: () => t('seo.articlesDescription'),
  canonicalUrl: canonicalUrl.value,
  jsonLd: () => jsonLd.value,
})

const supportEmail = computed(() => t('contacts.email.address'))
</script>

<template>
  <div class="articles-page">
    <header class="articles-page__header">
      <h1 class="articles-page__title">
        {{ t('articles.title') }}
      </h1>
      <p class="articles-page__description">
        {{ t('pages.articles.description') }}
      </p>
    </header>

    <div
      v-if="isLoading && articles.length === 0"
      class="articles-page__status"
    >
      {{ t('common.loading') }}
    </div>

    <div
      v-else-if="fetchError"
      class="articles-page__error"
    >
      <p>{{ t('errors.failedToLoad') }}</p>
      <UiButton
        variant="secondary"
        @click="refresh"
      >
        {{ t('common.retry') }}
      </UiButton>
    </div>

    <div
      v-else-if="articles.length > 0"
      class="articles-page__list"
    >
      <ArticleCard
        v-for="article in articles"
        :key="article.slug"
        :article="article"
      />
    </div>

    <UiEmptyState
      v-else
      :title="t('emptyStates.articles.title')"
    />

    <nav
      v-if="totalPages > 1"
      class="articles-page__pagination"
      :aria-label="t('pagination.label')"
    >
      <!-- Real links, not buttons: the point of URL-driven pagination is that a crawler can
           follow it, and an `<a>` it cannot click is a page it will never reach. -->
      <NuxtLink
        v-if="pageParam > 1"
        class="articles-page__page-link"
        :to="pageUrl(pageParam - 1)"
        :aria-label="t('pagination.previous')"
        rel="prev"
      >
        <span aria-hidden="true">←</span>
      </NuxtLink>
      <span
        v-else
        class="articles-page__page-link articles-page__page-link--disabled"
        aria-hidden="true"
      >
        ←
      </span>

      <span class="articles-page__page-info">
        {{ pageParam }} / {{ totalPages }}
      </span>

      <NuxtLink
        v-if="pageParam < totalPages"
        class="articles-page__page-link"
        :to="pageUrl(pageParam + 1)"
        :aria-label="t('pagination.next')"
        rel="next"
      >
        <span aria-hidden="true">→</span>
      </NuxtLink>
      <span
        v-else
        class="articles-page__page-link articles-page__page-link--disabled"
        aria-hidden="true"
      >
        →
      </span>
    </nav>

    <aside class="articles-page__propose">
      <h2 class="articles-page__propose-title">
        {{ t('articles.propose.title') }}
      </h2>
      <p class="articles-page__propose-text">
        {{ t('articles.propose.text') }}
      </p>
      <a
        class="articles-page__propose-link"
        :href="`mailto:${supportEmail}`"
      >
        {{ supportEmail }}
      </a>
    </aside>
  </div>
</template>

<style scoped>
.articles-page {
  max-width: var(--container-width);
  margin: 0 auto;
  padding: var(--spacing-xl) var(--spacing-lg);
}

.articles-page__header {
  margin-bottom: var(--spacing-xl);
}

.articles-page__title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  margin: 0 0 var(--spacing-sm) 0;
  line-height: var(--line-height-tight);
}

.articles-page__description {
  font-size: var(--font-size-lg);
  color: var(--color-text-muted);
  margin: 0;
  line-height: var(--line-height-normal);
  max-width: 60ch;
}

.articles-page__status {
  text-align: center;
  padding: var(--spacing-2xl);
  font-size: var(--font-size-lg);
  color: var(--color-text-muted);
}

.articles-page__error {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--color-error-text);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
}

.articles-page__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  /* Reading measure: a text column the width of the container is unreadable, and the cards
     are text. */
  max-width: 60ch;
}

.articles-page__pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
  margin-top: var(--spacing-xl);
}

.articles-page__page-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  text-decoration: none;
  transition: border-color var(--transition-base), color var(--transition-base);
}

.articles-page__page-link:hover {
  border-color: var(--color-primary);
  color: var(--color-primary-text);
  text-decoration: none;
}

.articles-page__page-link--disabled {
  color: var(--color-text-muted);
  opacity: 0.5;
  cursor: default;
}

.articles-page__page-info {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.articles-page__propose {
  margin-top: var(--spacing-2xl);
  padding: var(--spacing-lg);
  max-width: 60ch;
  background: var(--color-background-accent);
  border-radius: var(--radius-lg);
}

.articles-page__propose-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  margin: 0 0 var(--spacing-sm) 0;
}

.articles-page__propose-text {
  font-size: var(--font-size-md);
  line-height: var(--line-height-normal);
  color: var(--color-text-muted);
  margin: 0 0 var(--spacing-sm) 0;
}

.articles-page__propose-link {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
}
</style>
