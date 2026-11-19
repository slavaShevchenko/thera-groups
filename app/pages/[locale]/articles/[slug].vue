<script setup lang="ts">
import type { ArticleData } from '~~/types'

const { t, locale, pathLocale } = useLocale()
const route = useRoute()
const siteUrl = useRuntimeConfig().public.siteUrl as string

const slug = computed(() => route.params.slug as string)

const { data: article, pending, error } = await useFetch<ArticleData>(`/api/articles/${slug.value}`, {
  // The locale is part of the key, and both the key and the query are computed rather than
  // snapshots. A language switch does remount this page, but Nuxt holds one live `_asyncData`
  // entry per key string and only consults getCachedData for a key it has not seen, so under
  // `article-<slug>` the new instance found the previous language's entry still registered
  // (it mounts before the old one unmounts) and rendered the stale copy. Changing the key is
  // also what drives the switch: Nuxt resolves the new one through getCachedData, which is the
  // entry breadcrumbEntity.global.ts wrote for this locale before render, so it costs no
  // second request.
  key: computed(() => `article-${slug.value}-${pathLocale.value}`),
  // Nuxt's default getCachedData reads static.data on a server render, which is empty for a
  // dynamic route, so without this the handler would run twice — once for the breadcrumb's
  // title and once for the page.
  query: computed(() => ({ locale: pathLocale.value })),
  getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] as ArticleData | undefined,
})

if (!article.value && !pending.value) {
  // The status is passed through rather than flattened to 404: a 503 from the database is a
  // page that exists and should be retried, and telling a crawler it does not exist is how a
  // live article gets dropped from the index during an outage.
  throw createError({
    statusCode: error.value?.statusCode ?? 404,
    statusMessage: 'Article not found',
  })
}

const canonicalUrl = computed(() =>
  article.value ? `${siteUrl}/${pathLocale.value}/articles/${article.value.slug}` : '',
)

const jsonLd = computed(() => {
  if (!article.value) return ''
  return buildArticleJsonLd({
    article: article.value,
    siteUrl,
    canonicalUrl: canonicalUrl.value,
    locale: pathLocale.value,
    publisherName: t('seo.siteName'),
  })
})

useSeoPage({
  title: () => article.value
    ? `${article.value.title} | ${t('seo.siteName')}`
    : t('seo.siteName'),
  // The server's own cut of the body rather than the raw markdown: a description with `##` and
  // `**` in it is what a search result shows when the page supplies nothing better.
  description: () => article.value?.metaDescription ?? '',
  canonicalUrl: canonicalUrl.value,
  ogType: 'article',
  jsonLd: () => jsonLd.value,
})

const publishedLabel = computed(() =>
  article.value ? formatSiteDay(article.value.publishedDate, locale.value) : '',
)

const authorUrl = computed(() =>
  article.value?.author?.slug
    ? `/${locale.value}/organizers/${article.value.author.slug}`
    : null,
)
</script>

<template>
  <article
    v-if="article"
    class="article-page"
  >
    <header class="article-page__header">
      <h1 class="article-page__title">
        {{ article.title }}
      </h1>

      <div class="article-page__meta">
        <time
          class="article-page__date"
          :datetime="article.publishedDate"
        >
          {{ publishedLabel }}
        </time>

        <span
          v-if="article.author"
          class="article-page__author"
        >
          <span class="article-page__author-label">{{ t('articles.author') }}</span>
          <NuxtLink
            v-if="authorUrl"
            class="article-page__author-link"
            :to="authorUrl"
          >
            {{ article.author.name }}
          </NuxtLink>
          <span v-else>{{ article.author.name }}</span>
        </span>
      </div>
    </header>

    <div class="article-page__body">
      <MarkdownContent :blocks="article.content" />
    </div>

    <footer class="article-page__footer">
      <NuxtLink
        class="article-page__back"
        :to="`/${locale}/articles`"
      >
        <UiIcon
          name="arrow-left"
          :size="16"
          aria-hidden="true"
        />
        {{ t('articles.backToList') }}
      </NuxtLink>
    </footer>
  </article>
</template>

<style scoped>
.article-page {
  max-width: var(--container-width);
  margin: 0 auto;
  padding: var(--spacing-xl) var(--spacing-lg);
}

.article-page__header {
  /* The reading measure, and the same one the body and the list cards use: a column that
     changes width between the excerpt and the article reads as two different documents. */
  max-width: 70ch;
  margin-bottom: var(--spacing-xl);
}

.article-page__title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  margin: 0 0 var(--spacing-md) 0;
  line-height: var(--line-height-tight);
}

.article-page__meta {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--spacing-xs) var(--spacing-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.article-page__author {
  display: inline-flex;
  align-items: baseline;
  gap: var(--spacing-xs);
}

.article-page__author-label {
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: var(--font-size-xs);
}

.article-page__author-link {
  color: var(--color-text-muted);
}

.article-page__author-link:hover {
  color: var(--color-primary);
}

.article-page__body {
  max-width: 70ch;
}

.article-page__footer {
  max-width: 70ch;
  margin-top: var(--spacing-2xl);
  padding-top: var(--spacing-lg);
  border-top: var(--border-width) solid var(--color-border);
}

.article-page__back {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-primary-text);
}

.article-page__back:hover {
  color: var(--color-primary-hover);
}
</style>
