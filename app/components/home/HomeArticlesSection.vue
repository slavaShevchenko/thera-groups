<script setup lang="ts">
import type { ArticleTeaser } from '~~/types'

/**
 * The latest articles on the home page: six headlines, a date and a byline each, two rows of
 * three.
 *
 * It exists for the links. An article the home page points at is one a crawler meets on its
 * first request rather than three clicks into the archive, and the block is the only thing on
 * the home page that says the reading surface exists at all.
 *
 * Fetches for itself so the home page stays a composition of sections, and `await`s it so the
 * links are in the SSR HTML — a block whose whole purpose is being crawled cannot be the one
 * thing on the page rendered after hydration.
 */
const { t, pathLocale } = useLocale()

const { data } = await useFetch<ArticleTeaser[]>('/api/articles/latest', {
  // The locale is in the key and both it and the query are computed, the pairing the article
  // page uses: Nuxt keeps one live `_asyncData` entry per key string, so a language switch
  // under a shared key would find the previous language's headlines still registered.
  key: computed(() => `home-latest-articles-${pathLocale.value}`),
  query: computed(() => ({ locale: pathLocale.value })),
})

const articles = computed<ArticleTeaser[]>(() => data.value ?? [])

const archiveUrl = computed(() => `/${pathLocale.value}/articles`)

function articleUrl(slug: string): string {
  return `/${pathLocale.value}/articles/${slug}`
}

/**
 * The byline's link target, for an author who has one.
 *
 * Whether there is a link at all is decided server-side: `mapByline` nulls the slug of a
 * profile that is not VERIFIED or belongs to a deactivated account, because
 * `organizer.profile.view` refuses both and the link would land on a 404. The name still
 * renders, as text.
 */
function organizerUrl(slug: string): string {
  return `/${pathLocale.value}/organizers/${slug}`
}
</script>

<template>
  <!--
    No section at all when the archive is empty or the call failed — the same call the
    latest-events block above makes. A heading with nothing under it reads as a broken page,
    and a discovery block that cannot list anything is worth less than the space it would
    take: the archive keeps its own empty state and its own retry.
  -->
  <section
    v-if="articles.length"
    class="home-articles"
  >
    <header class="home-articles__header">
      <h2 class="home-articles__title">
        {{ t('pages.home.articles.title') }}
      </h2>

      <NuxtLink
        class="home-articles__link"
        :to="archiveUrl"
      >
        {{ t('pages.home.articles.showAll') }}
        <UiIcon
          name="arrow-right"
          class="home-articles__link-icon"
          aria-hidden="true"
        />
      </NuxtLink>
    </header>

    <p class="home-articles__text">
      {{ t('pages.home.articles.text1') }}
    </p>
    <p class="home-articles__text">
      {{ t('pages.home.articles.text2') }}
    </p>

    <div class="home-articles__grid">
      <article
        v-for="article in articles"
        :key="article.slug"
        class="home-articles__card"
      >
        <div class="home-articles__meta">
          <time
            class="home-articles__date"
            :datetime="article.publishedDate"
          >
            {{ formatSiteDay(article.publishedDate, pathLocale) }}
          </time>

          <span
            v-if="article.author"
            class="home-articles__author"
          >
            <span class="home-articles__author-label">{{ t('articles.author') }}</span>
            <NuxtLink
              v-if="article.author.slug"
              class="home-articles__author-link"
              :to="organizerUrl(article.author.slug)"
            >
              {{ article.author.name }}
            </NuxtLink>
            <span v-else>{{ article.author.name }}</span>
          </span>
        </div>

        <!-- The title is the card's link to the article, and the byline is the only other
             one. Making the whole card a link too would nest an `<a>` in an `<a>`, which is
             invalid HTML browsers silently restructure — the reason `ArticleCard` is not a
             link either. -->
        <h3 class="home-articles__card-title">
          <NuxtLink
            class="home-articles__card-link"
            :to="articleUrl(article.slug)"
          >
            {{ article.title }}
          </NuxtLink>
        </h3>
      </article>
    </div>
  </section>
</template>

<style scoped>
.home-articles {
  max-width: var(--container-width);
  margin: 0 auto;
  padding: var(--spacing-2xl) var(--spacing-lg);
}

.home-articles__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-sm);
}

.home-articles__title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  margin: 0;
  line-height: var(--line-height-tight);
}

.home-articles__text {
  font-size: var(--font-size-md);
  color: var(--color-text-muted);
  line-height: var(--line-height-normal);
  margin: 0;
}

.home-articles__text + .home-articles__text {
  margin-top: var(--spacing-xs);
}

.home-articles__link {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  flex-shrink: 0;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-primary);
}

.home-articles__link:hover {
  text-decoration: none;
  color: var(--color-primary-hover);
}

.home-articles__link-icon {
  width: 1rem;
  height: 1rem;
}

.home-articles__grid {
  display: grid;
  /* Two rows of three, and the count is fixed by `ARTICLE_LIMITS.HOME_TEASER_COUNT` rather
     than by `auto-fill`: a row that fills itself from the container width would put four or
     two cards on a line depending on the viewport, and the block is specified in rows. */
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-lg);
  margin-top: var(--spacing-lg);
}

.home-articles__card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding: var(--spacing-lg);
  background: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--transition-base);
}

.home-articles__card:hover {
  box-shadow: var(--shadow-md);
}

.home-articles__meta {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--spacing-xs) var(--spacing-md);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.home-articles__author {
  display: inline-flex;
  align-items: baseline;
  gap: var(--spacing-xs);
}

.home-articles__author-label {
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Muted, the way `ArticleCard` mutes it: the byline is part of the meta row, not a second
   call to action competing with the title. */
.home-articles__author-link {
  color: var(--color-text-muted);
}

.home-articles__author-link:hover {
  color: var(--color-primary);
}

.home-articles__author-link:focus-visible {
  outline: 2px solid var(--color-primary-text);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

.home-articles__card-title {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
  color: var(--color-text);
  margin: 0;
}

.home-articles__card-link {
  color: inherit;
  text-decoration: none;
}

.home-articles__card-link:hover {
  color: var(--color-primary);
  text-decoration: none;
}

.home-articles__card-link:focus-visible {
  outline: 2px solid var(--color-primary-text);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

/* Three rows of two */
@media (max-width: 1024px) {
  .home-articles__grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* One column, six rows */
@media (max-width: 560px) {
  .home-articles {
    padding: var(--spacing-xl) var(--spacing-md);
  }

  .home-articles__title {
    font-size: var(--font-size-lg);
  }

  .home-articles__text {
    font-size: var(--font-size-sm);
  }

  .home-articles__grid {
    grid-template-columns: 1fr;
    gap: var(--spacing-md);
  }
}
</style>
