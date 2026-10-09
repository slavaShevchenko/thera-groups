<script setup lang="ts">
import type { PendingGroup } from '~~/types'

import { INTL_LOCALES } from '~~/shared/constants/locales'

const ADMIN_PAGE_SIZE = 20

const { t, locale } = useLocale()

const pendingCount = defineModel<number>('pendingCount', { default: 0 })

const pendingGroups = ref<PendingGroup[]>([])
const publishedGroups = ref<PendingGroup[]>([])
const loading = ref(false)
const loaded = ref(false)
const loadError = ref(false)
const actionError = ref('')
const approvingGroupId = ref<string | null>(null)

const pendingPage = ref(1)
const pendingTotal = ref(0)
const publishedPage = ref(1)
const publishedTotal = ref(0)

const pendingTotalPages = computed(() => Math.ceil(pendingTotal.value / ADMIN_PAGE_SIZE))
const publishedTotalPages = computed(() => Math.ceil(publishedTotal.value / ADMIN_PAGE_SIZE))

const rejectionModalOpen = ref(false)
const rejectionGroupId = ref<string | null>(null)
const rejectionReason = ref('')
const rejectionSubmitting = ref(false)

function formatGroupDate(dateStr: string): string {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return '-'
  return date.toLocaleDateString(INTL_LOCALES[locale.value] ?? locale.value, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function onOpenGroup() {
  setBackTo('admin')
}

function removeGroup(id: string) {
  pendingGroups.value = pendingGroups.value.filter(g => g.id !== id)
  publishedGroups.value = publishedGroups.value.filter(g => g.id !== id)
  pendingCount.value = Math.max(0, pendingCount.value - 1)
}

async function loadGroups() {
  if (loaded.value) return
  loading.value = true
  loadError.value = false
  try {
    const [pendingResult, publishedResult] = await Promise.all([
      $fetch<{ items: PendingGroup[], total: number }>('/api/admin/groups', {
        query: { status: 'PENDING_REVIEW', page: String(pendingPage.value), limit: String(ADMIN_PAGE_SIZE) },
      }),
      $fetch<{ items: PendingGroup[], total: number }>('/api/admin/groups', {
        query: { status: 'PUBLISHED', page: String(publishedPage.value), limit: String(ADMIN_PAGE_SIZE) },
      }),
    ])
    pendingGroups.value = pendingResult.items
    pendingTotal.value = pendingResult.total
    publishedGroups.value = publishedResult.items
    publishedTotal.value = publishedResult.total
    pendingCount.value = pendingResult.total
    loaded.value = true
  }
  catch {
    loadError.value = true
  }
  finally {
    loading.value = false
  }
}

async function goToPendingPage(newPage: number) {
  pendingPage.value = newPage
  loading.value = true
  try {
    const result = await $fetch<{ items: PendingGroup[], total: number }>('/api/admin/groups', {
      query: { status: 'PENDING_REVIEW', page: String(newPage), limit: String(ADMIN_PAGE_SIZE) },
    })
    pendingGroups.value = result.items
    pendingTotal.value = result.total
  }
  catch {
    // Silent by design: group admin action failure, state unchanged
  }
  finally {
    loading.value = false
  }
}

async function goToPublishedPage(newPage: number) {
  publishedPage.value = newPage
  loading.value = true
  try {
    const result = await $fetch<{ items: PendingGroup[], total: number }>('/api/admin/groups', {
      query: { status: 'PUBLISHED', page: String(newPage), limit: String(ADMIN_PAGE_SIZE) },
    })
    publishedGroups.value = result.items
    publishedTotal.value = result.total
  }
  catch {
    // Silent by design: group admin action failure, state unchanged
  }
  finally {
    loading.value = false
  }
}

async function approveGroup(group: PendingGroup) {
  actionError.value = ''
  approvingGroupId.value = group.id
  try {
    await $fetch(`/api/admin/groups/${group.id}`, {
      method: 'PATCH',
      body: { status: 'PUBLISHED' },
    })
    removeGroup(group.id)
  }
  catch {
    actionError.value = t('common.errors.actionFailed')
  }
  finally {
    approvingGroupId.value = null
  }
}

function openRejectionModal(group: PendingGroup) {
  rejectionGroupId.value = group.id
  rejectionReason.value = ''
  rejectionModalOpen.value = true
}

function returnToRevision(group: PendingGroup) {
  rejectionGroupId.value = group.id
  rejectionReason.value = ''
  rejectionModalOpen.value = true
}

async function confirmRejection() {
  if (!rejectionGroupId.value || !rejectionReason.value.trim()) return
  rejectionSubmitting.value = true
  actionError.value = ''
  try {
    await $fetch(`/api/admin/groups/${rejectionGroupId.value}`, {
      method: 'PATCH',
      body: { status: 'REJECTED', rejectionReason: rejectionReason.value.trim() },
    })
    removeGroup(rejectionGroupId.value)
    rejectionModalOpen.value = false
    rejectionGroupId.value = null
    rejectionReason.value = ''
  }
  catch {
    actionError.value = t('common.errors.actionFailed')
  }
  finally {
    rejectionSubmitting.value = false
  }
}

// The tab is mounted fresh every time it is selected (the parent renders it with v-if),
// so this is what fills it on a hard load of /admin as well as on a tab switch.
onMounted(loadGroups)
</script>

<template>
  <div class="admin-groups">
    <div
      v-if="loading"
      class="admin-tab-loader"
    >
      <div class="admin-tab-loader__spinner"></div>
    </div>

    <div
      v-else-if="loadError"
      class="admin-groups__error"
    >
      <p>{{ t('errors.failedToLoad') }}</p>
      <UiButton
        variant="secondary"
        size="sm"
        @click="loaded = false; loadGroups()"
      >
        {{ t('common.retry') }}
      </UiButton>
    </div>

    <template v-else>
      <div
        v-if="actionError"
        class="admin-groups__action-error"
        role="status"
      >
        {{ actionError }}
      </div>
      <h2
        v-if="pendingGroups.length > 0"
        class="admin-groups__section-title"
      >
        {{ t('common.underReview') }} ({{ pendingGroups.length }})
      </h2>

      <ul
        v-if="pendingGroups.length > 0"
        class="admin-groups__list"
      >
        <li
          v-for="group in pendingGroups"
          :key="group.id"
          class="admin-groups__item"
        >
          <div class="admin-groups__info">
            <a
              :href="`/${locale}/groups/${group.slug}`"
              class="admin-groups__group-title"
              target="_blank"
              rel="noopener"
              @click="onOpenGroup"
            >
              {{ group.title }}
            </a>

            <dl class="admin-groups__meta">
              <div class="admin-groups__meta-row">
                <dt>{{ t('admin.groups.organizerLabel') }}</dt>
                <dd>
                  <a
                    :href="`/${locale}/organizers/${group.organizer.slug}`"
                    class="admin-groups__organizer-link"
                    target="_blank"
                    rel="noopener"
                  >
                    {{ group.organizer.name }}
                  </a>
                </dd>
              </div>
              <div class="admin-groups__meta-row">
                <dt>{{ t('admin.groups.typeLabel') }}</dt>
                <dd>{{ group.type ? t(`groupTypes.${group.type}`) : '-' }}</dd>
              </div>
              <div class="admin-groups__meta-row">
                <dt>{{ t('common.format') }}</dt>
                <dd>{{ group.format ? t(`common.formats.${group.format.toLowerCase()}`) : '-' }}</dd>
              </div>
              <div class="admin-groups__meta-row">
                <dt>{{ t('common.startDate') }}</dt>
                <dd>{{ group.startsAt ? formatGroupDate(group.startsAt) : '-' }}</dd>
              </div>
            </dl>
          </div>

          <div class="admin-groups__actions">
            <UiButton
              variant="primary"
              size="sm"
              :loading="approvingGroupId === group.id"
              @click="approveGroup(group)"
            >
              {{ t('common.publish') }}
            </UiButton>
            <UiButton
              variant="danger"
              size="sm"
              @click="openRejectionModal(group)"
            >
              {{ t('common.reject') }}
            </UiButton>
          </div>
        </li>
      </ul>

      <div
        v-if="pendingTotalPages > 1"
        class="admin-pagination"
      >
        <UiButton
          variant="secondary"
          size="sm"
          :disabled="pendingPage <= 1"
          :aria-label="t('pagination.previous')"
          @click="goToPendingPage(pendingPage - 1)"
        >
          <span aria-hidden="true">←</span>
        </UiButton>
        <span class="admin-pagination__info">
          {{ pendingPage }} / {{ pendingTotalPages }}
        </span>
        <UiButton
          variant="secondary"
          size="sm"
          :disabled="pendingPage >= pendingTotalPages"
          :aria-label="t('pagination.next')"
          @click="goToPendingPage(pendingPage + 1)"
        >
          <span aria-hidden="true">→</span>
        </UiButton>
      </div>

      <h2
        v-if="publishedGroups.length > 0"
        class="admin-groups__section-title"
      >
        {{ t('admin.groups.publishedSection') }} ({{ publishedTotal }})
      </h2>

      <ul
        v-if="publishedGroups.length > 0"
        class="admin-groups__list"
      >
        <li
          v-for="group in publishedGroups"
          :key="group.id"
          class="admin-groups__item"
        >
          <div class="admin-groups__info">
            <a
              :href="`/${locale}/groups/${group.slug}`"
              class="admin-groups__group-title"
              target="_blank"
              rel="noopener"
              @click="onOpenGroup"
            >
              {{ group.title }}
            </a>
            <dl class="admin-groups__meta">
              <div class="admin-groups__meta-row">
                <dt>{{ t('admin.groups.organizerLabel') }}</dt>
                <dd>
                  <a
                    :href="`/${locale}/organizers/${group.organizer.slug}`"
                    class="admin-groups__organizer-link"
                    target="_blank"
                    rel="noopener"
                  >
                    {{ group.organizer.name }}
                  </a>
                </dd>
              </div>
            </dl>
          </div>
          <div class="admin-groups__actions">
            <UiButton
              variant="danger"
              size="sm"
              @click="returnToRevision(group)"
            >
              {{ t('admin.groups.returnToRevision') }}
            </UiButton>
          </div>
        </li>
      </ul>

      <div
        v-if="publishedTotalPages > 1"
        class="admin-pagination"
      >
        <UiButton
          variant="secondary"
          size="sm"
          :disabled="publishedPage <= 1"
          :aria-label="t('pagination.previous')"
          @click="goToPublishedPage(publishedPage - 1)"
        >
          <span aria-hidden="true">←</span>
        </UiButton>
        <span class="admin-pagination__info">
          {{ publishedPage }} / {{ publishedTotalPages }}
        </span>
        <UiButton
          variant="secondary"
          size="sm"
          :disabled="publishedPage >= publishedTotalPages"
          :aria-label="t('pagination.next')"
          @click="goToPublishedPage(publishedPage + 1)"
        >
          <span aria-hidden="true">→</span>
        </UiButton>
      </div>

      <UiEmptyState
        v-if="pendingGroups.length === 0 && publishedGroups.length === 0"
        :title="t('emptyStates.adminGroups.title')"
      />
    </template>

    <UiModal
      v-model="rejectionModalOpen"
      :title="t('common.reject')"
    >
      <div class="admin-groups__rejection-form">
        <UiTextarea
          v-model="rejectionReason"
          :label="t('admin.groups.rejectionReason')"
          :placeholder="t('admin.groups.rejectionPlaceholder')"
          :rows="4"
          required
        />
        <div class="admin-groups__rejection-actions">
          <UiButton
            variant="secondary"
            @click="rejectionModalOpen = false"
          >
            {{ t('common.cancel') }}
          </UiButton>
          <UiButton
            variant="danger"
            :disabled="!rejectionReason.trim() || rejectionSubmitting"
            @click="confirmRejection"
          >
            {{ t('common.reject') }}
          </UiButton>
        </div>
      </div>
    </UiModal>
  </div>
</template>

<style scoped>
.admin-tab-loader {
  display: flex;
  justify-content: center;
  padding: var(--spacing-2xl);
}

.admin-tab-loader__spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: var(--radius-full);
  animation: spin 0.8s linear infinite;
}

.admin-groups__section-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  margin: var(--spacing-xl) 0 var(--spacing-md);
  padding-bottom: var(--spacing-sm);
  border-bottom: var(--border-width) solid var(--color-border);
}

.admin-groups__empty {
  text-align: center;
  color: var(--color-text-muted);
  padding: var(--spacing-2xl);
  font-size: var(--font-size-md);
}

.admin-groups__error {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--color-error-text);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
}

.admin-groups__action-error {
  background: var(--color-error-bg-soft);
  color: var(--color-error-text);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  margin-bottom: var(--spacing-md);
}

.admin-groups__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.admin-groups__item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-lg);
  padding: var(--spacing-lg);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
}

.admin-groups__info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  flex: 1;
  min-width: 0;
}

.admin-groups__group-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  text-decoration: none;
  display: inline-block;
}

.admin-groups__group-title:hover {
  color: var(--color-primary);
  text-decoration: underline;
}

.admin-groups__meta {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm) var(--spacing-lg);
}

.admin-groups__meta-row {
  display: flex;
  gap: var(--spacing-xs);
  font-size: var(--font-size-sm);
}

.admin-groups__meta-row dt {
  color: var(--color-text-muted);
  font-weight: var(--font-weight-medium);
}

.admin-groups__meta-row dd {
  margin: 0;
  color: var(--color-text);
}

.admin-groups__organizer-link {
  color: var(--color-primary);
  text-decoration: none;
}

.admin-groups__organizer-link:hover {
  text-decoration: underline;
}

.admin-groups__actions {
  display: flex;
  gap: var(--spacing-sm);
  flex-shrink: 0;
}

.admin-groups__rejection-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.admin-groups__rejection-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
}

.admin-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-md);
}

.admin-pagination__info {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}
</style>
