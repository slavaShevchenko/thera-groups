<script setup lang="ts">
import type { AdminArticleFormData } from '~~/types'

const { t, locale } = useLocale()
const route = useRoute()

const slug = computed(() => route.params.slug as string)

const { data, pending, error, refresh } = await useFetch<AdminArticleFormData>(
  `/api/admin/articles/${slug.value}`,
  { key: computed(() => `admin-article-${slug.value}`) },
)

// A slug that is not there, and a 403 for somebody who is not an admin, are both verdicts
// about the page rather than transient failures — `auth.global.ts` has already turned away
// anyone unauthenticated, so what is left is worth an error page rather than a retry button.
if (!data.value && !pending.value && isPermanentFetchFailure(error.value)) {
  throw createError({
    statusCode: error.value?.statusCode ?? 404,
    statusMessage: 'Article not found',
  })
}

const savedNotice = ref(false)
let noticeTimer: ReturnType<typeof setTimeout> | null = null

function onSaved() {
  savedNotice.value = true
  if (noticeTimer) clearTimeout(noticeTimer)
  // A save that leaves no trace reads as a save that did nothing, and one that stays forever
  // stops meaning anything. Five seconds is long enough to read and short enough to notice
  // the next time.
  noticeTimer = setTimeout(() => {
    savedNotice.value = false
  }, 5000)
}

function onDeleted() {
  navigateTo(`/${locale.value}/admin/articles`)
}

onBeforeUnmount(() => {
  if (noticeTimer) clearTimeout(noticeTimer)
})

useHead({
  title: () => t('admin.articles.editHeading'),
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
  ],
})
</script>

<template>
  <div class="admin-article-edit">
    <header class="admin-article-edit__header">
      <h1 class="admin-article-edit__title">
        {{ t('admin.articles.editHeading') }}
      </h1>
      <NuxtLink
        class="admin-article-edit__back"
        :to="`/${locale}/admin/articles`"
      >
        <UiIcon
          name="arrow-left"
          :size="16"
          aria-hidden="true"
        />
        {{ t('admin.articles.backToList') }}
      </NuxtLink>
    </header>

    <p
      v-if="savedNotice"
      class="admin-article-edit__notice"
      role="status"
    >
      {{ t('admin.articles.saved') }}
    </p>

    <div
      v-if="error && !isPermanentFetchFailure(error)"
      class="admin-article-edit__error"
    >
      <p>{{ t('errors.failedToLoad') }}</p>
      <UiButton
        variant="secondary"
        size="sm"
        @click="refresh"
      >
        {{ t('common.retry') }}
      </UiButton>
    </div>

    <AdminArticleForm
      v-else-if="data"
      :article-slug="slug"
      :initial-data="data"
      @saved="onSaved"
      @deleted="onDeleted"
    />
  </div>
</template>

<style scoped>
.admin-article-edit {
  max-width: var(--container-width);
  margin: 0 auto;
  padding: var(--spacing-xl) var(--spacing-lg);
}

.admin-article-edit__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.admin-article-edit__title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  margin: 0;
}

.admin-article-edit__back {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-primary-text);
  white-space: nowrap;
}

.admin-article-edit__back:hover {
  color: var(--color-primary-hover);
}

.admin-article-edit__notice {
  margin: 0 0 var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-success-bg-soft);
  border: var(--border-width) solid var(--color-success-border-soft);
  border-radius: var(--radius-md);
  color: var(--color-success-text);
  font-size: var(--font-size-sm);
}

.admin-article-edit__error {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--color-error-text);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
}
</style>
