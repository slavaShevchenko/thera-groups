<script setup lang="ts">
const { t, locale } = useLocale()

/**
 * Creating an article is a POST that answers with the slug the server chose, and the editor
 * for that slug is a different route. So this page holds no form state of its own: it renders
 * the shared editor, and on success hands the slug to the edit page, which loads it back.
 *
 * Going through the edit page rather than staying here is what makes the URL match the
 * article — reload after a save and the same article is still open. No `forceHide()` is needed
 * around the redirect: the editor calls `finishLoading()` in its own `finally`, before and
 * after this runs.
 */
function onSaved(slug: string) {
  navigateTo(`/${locale.value}/admin/articles/${slug}`)
}

useHead({
  title: () => t('admin.articles.new'),
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
  ],
})
</script>

<template>
  <div class="admin-article-new">
    <header class="admin-article-new__header">
      <h1 class="admin-article-new__title">
        {{ t('admin.articles.new') }}
      </h1>
      <p class="admin-article-new__description">
        {{ t('admin.articles.newDescription') }}
      </p>
    </header>

    <AdminArticleForm @saved="onSaved" />
  </div>
</template>

<style scoped>
.admin-article-new {
  max-width: var(--container-width);
  margin: 0 auto;
  padding: var(--spacing-xl) var(--spacing-lg);
}

.admin-article-new__header {
  margin-bottom: var(--spacing-xl);
}

.admin-article-new__title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  margin: 0 0 var(--spacing-sm);
}

.admin-article-new__description {
  font-size: var(--font-size-md);
  color: var(--color-text-muted);
  margin: 0;
  max-width: 70ch;
}
</style>
