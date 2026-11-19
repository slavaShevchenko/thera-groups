<script setup lang="ts">
import type { ArticleListItem } from '~~/types'

/**
 * One article in the public list.
 *
 * The card is not itself a link, unlike `GroupCard`: the byline can be one (an author with a
 * verified profile links to their page), and an `<a>` inside an `<a>` is invalid HTML that
 * browsers silently restructure. So the two navigations are separate — the title and the
 * "read more" line, both to the same article — and the card keeps its hover affordance as
 * styling only.
 */
const props = defineProps<{
  article: ArticleListItem
}>()

const { t, locale } = useLocale()

const articleUrl = computed(() => `/${locale.value}/articles/${props.article.slug}`)
const publishedLabel = computed(() => formatSiteDay(props.article.publishedDate, locale.value))
const authorUrl = computed(() =>
  props.article.author?.slug
    ? `/${locale.value}/organizers/${props.article.author.slug}`
    : null,
)
</script>

<template>
  <article class="article-card">
    <div class="article-card__meta">
      <time
        class="article-card__date"
        :datetime="article.publishedDate"
      >
        {{ publishedLabel }}
      </time>

      <span
        v-if="article.author"
        class="article-card__author"
      >
        <span class="article-card__author-label">{{ t('articles.author') }}</span>
        <NuxtLink
          v-if="authorUrl"
          class="article-card__author-link"
          :to="authorUrl"
        >
          {{ article.author.name }}
        </NuxtLink>
        <span v-else>{{ article.author.name }}</span>
      </span>
    </div>

    <h2 class="article-card__title">
      <NuxtLink
        class="article-card__title-link"
        :to="articleUrl"
      >
        {{ article.title }}
      </NuxtLink>
    </h2>

    <p class="article-card__excerpt">
      {{ article.excerpt }}
    </p>

    <NuxtLink
      class="article-card__more"
      :to="articleUrl"
    >
      {{ t('articles.readMore') }}
      <UiIcon
        name="arrow-right"
        :size="16"
        aria-hidden="true"
      />
    </NuxtLink>
  </article>
</template>

<style scoped>
.article-card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-lg);
  background: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--transition-base);
}

.article-card:hover {
  box-shadow: var(--shadow-md);
}

.article-card__meta {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--spacing-xs) var(--spacing-md);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.article-card__author {
  display: inline-flex;
  align-items: baseline;
  gap: var(--spacing-xs);
}

.article-card__author-label {
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Muted the way the byline in `OrganizerCard` is, so an author reads as part of the meta
   row rather than as the card's second call to action — the title and "read more" are those. */
.article-card__author-link {
  color: var(--color-text-muted);
}

.article-card__author-link:hover {
  color: var(--color-primary);
}

.article-card__title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
  color: var(--color-text);
  margin: 0;
}

.article-card__title-link {
  color: inherit;
  text-decoration: none;
}

.article-card__title-link:hover {
  color: var(--color-primary);
  text-decoration: none;
}

.article-card__title-link:focus-visible {
  outline: 2px solid var(--color-primary-text);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

/* Server-side the excerpt is already cut to `ARTICLE_LIMITS.EXCERPT_MAX`; the clamp is the
   visual half of the same budget, so six lines is what the spec asked for whether the text
   arrived short or long. */
.article-card__excerpt {
  margin: 0;
  font-size: var(--font-size-md);
  line-height: var(--line-height-normal);
  color: var(--color-text-muted);
  display: -webkit-box;
  -webkit-line-clamp: 6;
  line-clamp: 6;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.article-card__more {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  margin-top: auto;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-primary-text);
}

.article-card__more:hover {
  color: var(--color-primary-hover);
}
</style>
