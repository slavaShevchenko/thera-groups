<script setup lang="ts">
import type { AdminArticleListItem, Locale } from '~~/types'

/**
 * The admin article list.
 *
 * A page of its own rather than a sixth tab in `/admin`: the editor is a full-page bilingual
 * markdown form, so a tab would be a list whose only action is to leave the tab anyway. The
 * drawer links here, and this links to `/admin/articles/new`.
 */
const { t, locale } = useLocale()
const { startLoading, finishLoading } = usePageLoading()

const ADMIN_PAGE_SIZE = 20

interface AdminArticlesResponse {
  articles: AdminArticleListItem[]
  total: number
  page: number
  totalPages: number
}

const articles = ref<AdminArticleListItem[]>([])
const page = ref(1)
const total = ref(0)
const totalPages = ref(1)
const loading = ref(false)
const loadError = ref(false)
const actionError = ref('')
const statusFilter = ref<'' | 'DRAFT' | 'PUBLISHED'>('')

const columns = computed(() => [
  { key: 'title', label: t('admin.articles.title') },
  { key: 'status', label: t('common.status') },
  { key: 'locales', label: t('admin.articles.locales') },
  { key: 'publishedDate', label: t('admin.articles.publishedAt') },
  { key: 'authorName', label: t('admin.articles.authorShort') },
])

async function loadData() {
  loading.value = true
  loadError.value = false
  actionError.value = ''
  try {
    const result = await $fetch<AdminArticlesResponse>('/api/admin/articles', {
      query: {
        page: String(page.value),
        limit: String(ADMIN_PAGE_SIZE),
        ...(statusFilter.value ? { status: statusFilter.value } : {}),
      },
    })
    articles.value = result.articles
    total.value = result.total
    totalPages.value = result.totalPages
  }
  catch {
    loadError.value = true
  }
  finally {
    loading.value = false
  }
}

function onPageChange(newPage: number) {
  page.value = newPage
  loadData()
}

function onFilterChange(value: string) {
  statusFilter.value = value as '' | 'DRAFT' | 'PUBLISHED'
  page.value = 1
  loadData()
}

const deleteTarget = ref<AdminArticleListItem | null>(null)
const isDeleting = ref(false)

async function confirmDelete() {
  const target = deleteTarget.value
  if (!target || isDeleting.value) return

  isDeleting.value = true
  try {
    await $fetch(`/api/admin/articles/${target.slug}`, { method: 'DELETE' })
    deleteTarget.value = null
    // The page can now be past the end — deleting the only row of the last page leaves it
    // empty with a "next" that goes nowhere. Step back and reload rather than show that.
    if (articles.value.length === 1 && page.value > 1) page.value -= 1
    await loadData()
  }
  catch {
    actionError.value = t('common.errors.actionFailed')
    deleteTarget.value = null
  }
  finally {
    isDeleting.value = false
  }
}

/** A locale badge per language, so "why can this not be published" is readable at a glance. */
const ALL_LOCALES: Locale[] = ['ua', 'en']

function statusPillVariant(status: string): 'success' | 'neutral' {
  return status === 'PUBLISHED' ? 'success' : 'neutral'
}

onMounted(() => {
  startLoading()
  loadData().finally(finishLoading)
})

useHead({
  title: () => t('admin.articles.heading'),
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
  ],
})
</script>

<template>
  <div class="admin-articles">
    <div class="admin-articles__header">
      <h1 class="admin-articles__title">
        {{ t('admin.articles.heading') }}
      </h1>
      <UiButton :to="`/${locale}/admin/articles/new`">
        {{ t('admin.articles.new') }}
      </UiButton>
    </div>

    <div
      v-if="actionError"
      class="admin-articles__action-error"
      role="status"
    >
      {{ actionError }}
    </div>

    <div class="admin-articles__filters">
      <UiSelect
        :model-value="statusFilter"
        :options="[
          { value: '', label: t('admin.articles.filterAll') },
          { value: 'DRAFT', label: t('admin.articles.status.DRAFT') },
          { value: 'PUBLISHED', label: t('admin.articles.status.PUBLISHED') },
        ]"
        :label="t('admin.articles.statusFilter')"
        @update:model-value="onFilterChange"
      />
    </div>

    <div
      v-if="loading && articles.length === 0"
      class="admin-articles__loader"
    >
      {{ t('common.loading') }}
    </div>

    <div
      v-else-if="loadError"
      class="admin-articles__error"
    >
      <p>{{ t('errors.failedToLoad') }}</p>
      <UiButton
        variant="secondary"
        size="sm"
        @click="loadData"
      >
        {{ t('common.retry') }}
      </UiButton>
    </div>

    <AdminPeopleTable
      v-else
      :columns="columns"
      :rows="articles"
      :total="total"
      :page="page"
      :total-pages="totalPages"
      :empty-message="t('emptyStates.adminArticles.title')"
      @update:page="onPageChange"
    >
      <template #cell-title="{ row }">
        <NuxtLink
          class="admin-articles__title-link"
          :to="`/${locale}/admin/articles/${row.slug}`"
        >
          {{ row.title }}
        </NuxtLink>
      </template>

      <template #cell-status="{ value }">
        <UiPill
          :label="t(`admin.articles.status.${value}`)"
          :variant="statusPillVariant(value as string)"
        />
      </template>

      <template #cell-locales="{ row }">
        <span class="admin-articles__locales">
          <UiPill
            v-for="loc in ALL_LOCALES"
            :key="loc"
            :label="loc.toUpperCase()"
            :variant="(row.locales as Locale[]).includes(loc) ? 'info' : 'neutral'"
          />
        </span>
      </template>

      <template #cell-publishedDate="{ value }">
        {{ value ? formatSiteDay(value as string, locale) : '—' }}
      </template>

      <template #cell-authorName="{ value }">
        {{ value || '—' }}
      </template>

      <template #actions="{ row }">
        <div class="admin-articles__actions">
          <UiButton
            v-if="row.status === 'PUBLISHED'"
            variant="ghost"
            size="sm"
            :to="`/${locale}/articles/${row.slug}`"
          >
            {{ t('admin.articles.view') }}
          </UiButton>
          <UiButton
            variant="secondary"
            size="sm"
            :to="`/${locale}/admin/articles/${row.slug}`"
          >
            {{ t('common.edit') }}
          </UiButton>
          <UiButton
            variant="danger"
            size="sm"
            @click="deleteTarget = row as AdminArticleListItem"
          >
            {{ t('common.delete') }}
          </UiButton>
        </div>
      </template>
    </AdminPeopleTable>

    <UiConfirmModal
      :model-value="!!deleteTarget"
      :title="t('admin.articles.deleteTitle')"
      :message="t('admin.articles.deleteMessage', { title: deleteTarget?.title ?? '' })"
      :confirm-text="t('common.delete')"
      :loading="isDeleting"
      @update:model-value="deleteTarget = null"
      @confirm="confirmDelete"
    />
  </div>
</template>

<style scoped>
.admin-articles {
  max-width: var(--container-width);
  margin: 0 auto;
  padding: var(--spacing-xl) var(--spacing-lg);
}

.admin-articles__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.admin-articles__title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  margin: 0;
}

.admin-articles__filters {
  max-width: 240px;
  margin-bottom: var(--spacing-md);
}

.admin-articles__loader {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--color-text-muted);
}

.admin-articles__error {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--color-error-text);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
}

.admin-articles__action-error {
  background: var(--color-error-bg-soft);
  color: var(--color-error-text);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  margin-bottom: var(--spacing-md);
}

.admin-articles__title-link {
  color: var(--color-primary-text);
  font-weight: var(--font-weight-medium);
}

.admin-articles__locales {
  display: inline-flex;
  gap: var(--spacing-xs);
}

.admin-articles__actions {
  display: flex;
  gap: var(--spacing-xs);
  flex-wrap: wrap;
}
</style>
