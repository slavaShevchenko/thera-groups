<script setup lang="ts">
import { ARTICLE_LIMITS } from '~~/shared/constants/limits'
import type { AdminArticleFormData, Locale } from '~~/types'

/**
 * The article editor, shared by create and edit.
 *
 * One component rather than two because the two forms differ in exactly three ways — whether
 * the slug is editable, which verb the request uses, and whether a delete button exists — and
 * a copy of a bilingual markdown form is a copy that drifts. `articleSlug` decides the mode.
 *
 * The existing article is a prop, not a fetch: the edit page loads it with `useFetch` so the
 * 404 for a slug that does not exist is the page's to raise, and so this component has no
 * top-level `await` — an async setup in a child leans on the page's `<Suspense>` boundary in
 * ways that are easy to break and hard to see.
 *
 * The translations are rendered as two stacked fieldsets, not as tabs. Publishing needs both
 * languages complete, and a tab hides the one that is empty: the reason a publish was refused
 * should be on screen at the moment it is refused.
 */
const props = defineProps<{
  /** Absent on `/admin/articles/new`, present on `/admin/articles/[slug]`. */
  articleSlug?: string
  /** What the edit page loaded for `articleSlug`; ignored when there is no slug. */
  initialData?: AdminArticleFormData | null
}>()

const emit = defineEmits<{
  /** Fired after a successful save, with the slug — which create only learns from the response. */
  saved: [slug: string]
  deleted: [slug: string]
}>()

const { t, locale } = useLocale()
const { startLoading, finishLoading } = usePageLoading()

const isEdit = computed(() => !!props.articleSlug)

const ARTICLE_LOCALES: Locale[] = ['ua', 'en']

const form = reactive({
  slug: '',
  status: 'DRAFT' as 'DRAFT' | 'PUBLISHED',
  authorId: null as string | null,
  authorName: null as string | null,
  linkedAuthorName: null as string | null,
  publishedAt: null as string | null,
  translations: {
    ua: { title: '', content: '' },
    en: { title: '', content: '' },
  } as Record<Locale, { title: string, content: string }>,
})

const saveError = ref('')
const slugError = ref('')
/** The two buttons are mutually exclusive, so each needs its own spinner. */
const isSaving = ref(false)
const isChangingStatus = ref(false)

/**
 * Which locales still need writing, mirroring the server's `incompleteLocales`.
 *
 * Duplicated rather than shared because the server's copy reads translation *rows* and this
 * one reads the form: a locale whose title was just cleared in the browser is incomplete now,
 * and waiting for the round trip to find out would report the failure after the admin has
 * already lost the context they were in.
 */
const missingLocales = computed<Locale[]>(() =>
  ARTICLE_LOCALES.filter((loc) => {
    const translation = form.translations[loc]
    return !translation.title.trim() || !translation.content.trim()
  }),
)

const canPublish = computed(() => missingLocales.value.length === 0)

function applyFormData(data: AdminArticleFormData) {
  form.slug = data.slug
  form.status = data.status
  form.authorId = data.authorId
  form.authorName = data.authorName
  form.linkedAuthorName = data.linkedAuthorName
  form.publishedAt = data.publishedAt

  for (const loc of ARTICLE_LOCALES) {
    form.translations[loc] = {
      title: data.translations[loc]?.title ?? '',
      content: data.translations[loc]?.content ?? '',
    }
  }
}

// `immediate` covers the SSR render, where the page has already resolved the data; the watcher
// covers a client navigation between two articles, where it arrives after mount.
watch(() => props.initialData, (data) => {
  if (data) applyFormData(data)
}, { immediate: true })

function buildBody(status: 'DRAFT' | 'PUBLISHED') {
  return {
    status,
    publishedAt: form.publishedAt || null,
    authorId: form.authorId,
    authorName: form.authorName?.trim() || null,
    translations: {
      ua: { title: form.translations.ua.title, content: form.translations.ua.content },
      en: { title: form.translations.en.title, content: form.translations.en.content },
    },
  }
}

/**
 * The slug, and only on create.
 *
 * It is not editable afterwards: renaming it would move a URL the sitemap, the hreflang pair
 * and every inbound link already point at. Left blank on create, the server derives one from
 * the Ukrainian title — which is why the field is optional rather than required.
 */
const slugHint = computed(() =>
  isEdit.value ? t('admin.articles.slugLockedHint') : t('admin.articles.slugHint'),
)

/** The trusted error code, mapped to the one sentence an admin can act on. */
function errorMessage(error: unknown): string {
  const data = (error as { data?: { code?: string, field?: string } })?.data
  if (data?.code === 'CONFLICT') return t('admin.articles.errors.slugTaken')
  if (data?.code === 'VALIDATION_FAILED' && data.field === 'translations') {
    return t('admin.articles.errors.incompleteTranslations')
  }
  if (data?.code === 'NOT_FOUND') return t('admin.articles.errors.authorNotFound')
  return t('errors.saveFailed')
}

async function save(status: 'DRAFT' | 'PUBLISHED') {
  if (isSaving.value || isChangingStatus.value) return

  // Checked before the request so the answer arrives next to the fields it is about, and so a
  // publish that cannot succeed does not spend a round trip saying so.
  if (status === 'PUBLISHED' && !canPublish.value) {
    saveError.value = t('admin.articles.errors.incompleteTranslations', {
      locales: missingLocales.value.map(loc => t(`admin.articles.localeNames.${loc}`)).join(', '),
    })
    return
  }

  isSaving.value = status === form.status
  isChangingStatus.value = status !== form.status
  saveError.value = ''
  slugError.value = ''

  startLoading()
  try {
    if (isEdit.value) {
      await $fetch<AdminArticleFormData>(`/api/admin/articles/${props.articleSlug}`, {
        method: 'PATCH',
        body: buildBody(status),
      })
      form.status = status
      emit('saved', props.articleSlug as string)
    }
    else {
      const slug = form.slug.trim()
      const response = await $fetch<{ success: boolean, article: { slug: string, status: string } }>(
        '/api/admin/articles',
        {
          method: 'POST',
          body: { ...(slug ? { slug } : {}), ...buildBody(status) },
        },
      )
      emit('saved', response.article.slug)
    }
  }
  catch (error) {
    const data = (error as { data?: { code?: string, field?: string } })?.data
    // A taken slug belongs under the slug field, not in the banner at the top: it is the one
    // failure on this form the admin can only fix by editing that one input.
    if (data?.code === 'CONFLICT' && !isEdit.value) slugError.value = t('admin.articles.errors.slugTaken')
    else saveError.value = errorMessage(error)
  }
  finally {
    finishLoading()
    isSaving.value = false
    isChangingStatus.value = false
  }
}

const isDeleteOpen = ref(false)
const isDeleting = ref(false)

async function confirmDelete() {
  if (isDeleting.value || !props.articleSlug) return

  isDeleting.value = true
  try {
    await $fetch(`/api/admin/articles/${props.articleSlug}`, { method: 'DELETE' })
    isDeleteOpen.value = false
    emit('deleted', props.articleSlug)
  }
  catch (error) {
    saveError.value = errorMessage(error)
    isDeleteOpen.value = false
  }
  finally {
    isDeleting.value = false
  }
}

const publicUrl = computed(() =>
  form.slug ? `/${locale.value}/articles/${form.slug}` : '',
)
</script>

<template>
  <div class="article-form">
    <p
      v-if="saveError"
      class="article-form__banner article-form__banner--error"
      role="alert"
    >
      {{ saveError }}
    </p>

    <section class="article-form__section">
      <h2 class="article-form__section-title">
        {{ t('admin.articles.section.publishing') }}
      </h2>

      <div class="article-form__grid">
        <UiInput
          v-if="!isEdit"
          v-model="form.slug"
          :label="t('admin.articles.slug')"
          :placeholder="t('admin.articles.slugPlaceholder')"
          :error="slugError"
          :max-chars="ARTICLE_LIMITS.SLUG_MAX"
          name="slug"
          autocomplete="off"
        />
        <p
          v-else
          class="article-form__slug-locked"
        >
          <span class="article-form__slug-label">{{ t('admin.articles.slug') }}</span>
          <!-- Linked only while it is live: a draft's public URL is a 404, and a link to one
               in the editor reads as a broken page rather than as an unpublished article. -->
          <NuxtLink
            v-if="publicUrl && form.status === 'PUBLISHED'"
            :to="publicUrl"
          >
            {{ form.slug }}
          </NuxtLink>
          <span v-else>{{ form.slug }}</span>
        </p>

        <!-- Not `v-model`: `UiInput` takes a string, and `publishedAt` is null until a day is
             chosen. An empty field means "no date", which the server reads as "today" on
             publish and as "leave it unset" on a draft. -->
        <UiInput
          :model-value="form.publishedAt ?? ''"
          type="date"
          :label="t('admin.articles.publishedAt')"
          name="publishedAt"
          @update:model-value="form.publishedAt = $event || null"
        />
      </div>

      <p class="article-form__hint">
        {{ slugHint }}
      </p>
      <p class="article-form__hint">
        {{ t('admin.articles.publishedAtHint') }}
      </p>
    </section>

    <section class="article-form__section">
      <h2 class="article-form__section-title">
        {{ t('admin.articles.section.author') }}
      </h2>

      <ArticleAuthorPicker
        v-model:author-id="form.authorId"
        v-model:author-name="form.authorName"
        :linked-author-name="form.linkedAuthorName"
      />
    </section>

    <section
      v-for="loc in ARTICLE_LOCALES"
      :key="loc"
      class="article-form__section"
    >
      <fieldset class="article-form__locale">
        <legend class="article-form__legend">
          {{ t(`admin.articles.localeNames.${loc}`) }}
          <UiPill
            :label="missingLocales.includes(loc)
              ? t('admin.articles.localeIncomplete')
              : t('admin.articles.localeComplete')"
            :variant="missingLocales.includes(loc) ? 'warning' : 'success'"
          />
        </legend>

        <div class="article-form__locale-fields">
          <UiInput
            v-model="form.translations[loc].title"
            :label="t('admin.articles.title')"
            :placeholder="t('admin.articles.titlePlaceholder')"
            :max-chars="ARTICLE_LIMITS.TITLE_MAX"
            required
            :name="`title-${loc}`"
          />

          <UiTextarea
            v-model="form.translations[loc].content"
            :label="t('admin.articles.content')"
            :placeholder="t('admin.articles.contentPlaceholder')"
            :max-chars="ARTICLE_LIMITS.CONTENT_MAX"
            :rows="18"
            required
          />

          <p class="article-form__hint">
            {{ t('admin.articles.markdownHint') }}
          </p>
        </div>
      </fieldset>
    </section>

    <div class="article-form__actions">
      <UiButton
        type="button"
        variant="secondary"
        :loading="isSaving"
        :disabled="isChangingStatus"
        @click="save(form.status)"
      >
        {{ t('common.save') }}
      </UiButton>

      <UiButton
        v-if="form.status === 'DRAFT'"
        type="button"
        :loading="isChangingStatus"
        :disabled="isSaving || !canPublish"
        @click="save('PUBLISHED')"
      >
        {{ t('admin.articles.publish') }}
      </UiButton>

      <UiButton
        v-else
        type="button"
        variant="secondary"
        :loading="isChangingStatus"
        :disabled="isSaving"
        @click="save('DRAFT')"
      >
        {{ t('admin.articles.unpublish') }}
      </UiButton>

      <UiButton
        v-if="isEdit"
        type="button"
        variant="danger"
        :disabled="isSaving || isChangingStatus"
        @click="isDeleteOpen = true"
      >
        {{ t('common.delete') }}
      </UiButton>
    </div>

    <UiConfirmModal
      v-if="isEdit"
      v-model="isDeleteOpen"
      :title="t('admin.articles.deleteTitle')"
      :message="t('admin.articles.deleteMessage', { title: form.translations.ua.title || form.slug })"
      :confirm-text="t('common.delete')"
      :loading="isDeleting"
      @confirm="confirmDelete"
    />
  </div>
</template>

<style scoped>
.article-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

.article-form__banner {
  margin: 0;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
}

.article-form__banner--error {
  background: var(--color-error-bg-soft);
  border: var(--border-width) solid var(--color-error-border-soft);
  color: var(--color-error-text);
}

.article-form__section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.article-form__section-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  margin: 0;
}

.article-form__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-md);
}

@media (max-width: 767px) {
  .article-form__grid {
    grid-template-columns: 1fr;
  }
}

.article-form__slug-locked {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  margin: 0;
  font-size: var(--font-size-md);
}

.article-form__slug-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.article-form__hint {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.article-form__locale {
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  margin: 0;
}

.article-form__legend {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 0 var(--spacing-xs);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

.article-form__locale-fields {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.article-form__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}
</style>
