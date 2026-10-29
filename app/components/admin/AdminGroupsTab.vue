<script setup lang="ts">
import type { PendingGroup } from '~~/types'

import { INTL_LOCALES } from '~~/shared/constants/locales'
import { GROUP_STATUS_VARIANTS } from '~~/shared/constants/statusColors'

const ADMIN_PAGE_SIZE = 20

/**
 * The statuses the second section can show, grouped the way an admin acts on them rather
 * than one enum value at a time.
 *
 * `FULL` belongs with `PUBLISHED` because both are live groups an admin may still end, and
 * the section used to query `PUBLISHED` alone — so a group that filled up, and every group
 * anybody had ever completed or cancelled, were reachable through no admin screen at all.
 */
const STATUS_VIEWS = {
  active: { statuses: ['PUBLISHED', 'FULL'], labelKey: 'admin.groups.viewActive' },
  completed: { statuses: ['COMPLETED'], labelKey: 'admin.groups.viewCompleted' },
  cancelled: { statuses: ['CANCELLED'], labelKey: 'admin.groups.viewCancelled' },
} as const

type StatusView = keyof typeof STATUS_VIEWS

/** Statuses an admin can still end. `COMPLETED` is terminal and `CANCELLED` already is. */
function isEndable(status: string): boolean {
  return status === 'PUBLISHED' || status === 'FULL'
}

const { t, locale } = useLocale()

const pendingCount = defineModel<number>('pendingCount', { default: 0 })

const pendingGroups = ref<PendingGroup[]>([])
const viewGroups = ref<PendingGroup[]>([])
const loading = ref(false)
const loaded = ref(false)
const loadError = ref(false)
const actionError = ref('')
const approvingGroupId = ref<string | null>(null)

const pendingPage = ref(1)
const pendingTotal = ref(0)
const viewPage = ref(1)
const viewTotal = ref(0)

const statusView = ref<StatusView>('active')

const pendingTotalPages = computed(() => Math.ceil(pendingTotal.value / ADMIN_PAGE_SIZE))
const viewTotalPages = computed(() => Math.ceil(viewTotal.value / ADMIN_PAGE_SIZE))

const statusViewOptions = computed(() =>
  (Object.keys(STATUS_VIEWS) as StatusView[]).map(view => ({
    value: view,
    label: t(STATUS_VIEWS[view].labelKey),
  })),
)

const viewTitle = computed(() => t(STATUS_VIEWS[statusView.value].labelKey))

const statusVariants = GROUP_STATUS_VARIANTS

const rejectionModalOpen = ref(false)
const rejectionGroupId = ref<string | null>(null)
const rejectionReason = ref('')
const rejectionSubmitting = ref(false)

type EndingStatus = 'COMPLETED' | 'CANCELLED'

const endingTargetId = ref<string | null>(null)
const endingStatus = ref<EndingStatus>('CANCELLED')
const endingId = ref<string | null>(null)

const endingTargetGroup = computed(() =>
  viewGroups.value.find(g => g.id === endingTargetId.value) ?? null,
)

/** One modal, two transitions: the wording is what tells them apart before the confirm. */
const endingTitle = computed(() =>
  t(endingStatus.value === 'COMPLETED' ? 'admin.groups.completeTitle' : 'admin.groups.cancelTitle'),
)

const endingMessage = computed(() =>
  t(endingStatus.value === 'COMPLETED' ? 'admin.groups.completeMessage' : 'admin.groups.cancelMessage', {
    title: endingTargetGroup.value?.title ?? '',
  }),
)

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
  viewGroups.value = viewGroups.value.filter(g => g.id !== id)
  pendingCount.value = Math.max(0, pendingCount.value - 1)
}

type ViewResult = { items: PendingGroup[], total: number }

/** One page of whichever status view the second section is showing. */
function fetchView(page: number) {
  return $fetch<ViewResult>('/api/admin/groups', {
    query: {
      status: STATUS_VIEWS[statusView.value].statuses.join(','),
      page: String(page),
      limit: String(ADMIN_PAGE_SIZE),
    },
  })
}

async function loadGroups() {
  if (loaded.value) return
  loading.value = true
  loadError.value = false
  try {
    const [pendingResult, viewResult] = await Promise.all([
      $fetch<ViewResult>('/api/admin/groups', {
        query: { status: 'PENDING_REVIEW', page: String(pendingPage.value), limit: String(ADMIN_PAGE_SIZE) },
      }),
      fetchView(viewPage.value),
    ])
    pendingGroups.value = pendingResult.items
    pendingTotal.value = pendingResult.total
    viewGroups.value = viewResult.items
    viewTotal.value = viewResult.total
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

/**
 * Reloads the second section, for either reason it can change: the page moved, or the status
 * view did. A failure reports through `actionError` and leaves the rows on screen instead of
 * blanking a list the admin was reading.
 */
async function reloadView(page: number) {
  viewPage.value = page
  loading.value = true
  try {
    const result = await fetchView(page)
    viewGroups.value = result.items
    viewTotal.value = result.total
  }
  catch {
    actionError.value = t('common.errors.actionFailed')
  }
  finally {
    loading.value = false
  }
}

/**
 * Switching the status view is a reload rather than a filter of the rows already on screen:
 * each view is its own paged query, so the page resets to the first.
 */
function onStatusViewChange(value: string) {
  if (!(value in STATUS_VIEWS)) return

  statusView.value = value as StatusView
  reloadView(1)
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

/**
 * Ending a group is the admin's version of the owner's own action, and both transitions run
 * the same server fan-out: the owner and every approved applicant are told. Neither is a
 * delete, so the applications stay on the row for the record. Completing keeps the page in
 * the catalog as an archive; cancelling takes it down.
 */
function requestEnding(group: PendingGroup, status: EndingStatus) {
  endingStatus.value = status
  endingTargetId.value = group.id
}

async function confirmEnding() {
  const id = endingTargetId.value
  if (!id) return

  const status = endingStatus.value
  endingId.value = id
  actionError.value = ''
  try {
    await $fetch(`/api/admin/groups/${id}`, {
      method: 'PATCH',
      body: { status },
    })
    // Both transitions move the group out of the active view, which is the only view that
    // offers them, so the row leaves the list on screen.
    viewGroups.value = viewGroups.value.filter(g => g.id !== id)
    viewTotal.value = Math.max(0, viewTotal.value - 1)
  }
  catch {
    actionError.value = t('common.errors.actionFailed')
  }
  finally {
    endingId.value = null
    endingTargetId.value = null
  }
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

      <!-- Rendered whether or not the view has rows: the select is how an admin reaches the
           other views, so hiding it together with an empty list would hide the way back. -->
      <div class="admin-groups__view-controls">
        <h2 class="admin-groups__section-title">
          {{ viewTitle }} ({{ viewTotal }})
        </h2>
        <UiSelect
          class="admin-groups__view-select"
          :model-value="statusView"
          :options="statusViewOptions"
          :label="t('admin.groups.statusFilter')"
          @update:model-value="onStatusViewChange"
        />
      </div>

      <ul
        v-if="viewGroups.length > 0"
        class="admin-groups__list"
      >
        <li
          v-for="group in viewGroups"
          :key="group.id"
          class="admin-groups__item"
        >
          <div class="admin-groups__info">
            <div class="admin-groups__heading">
              <a
                :href="`/${locale}/groups/${group.slug}`"
                class="admin-groups__group-title"
                target="_blank"
                rel="noopener"
                @click="onOpenGroup"
              >
                {{ group.title }}
              </a>
              <!-- The section mixes statuses now, so a row has to say which one it is — and
                   "Enrollment closed" next to Cancel is the difference an admin needs. -->
              <UiPill
                :label="t(`groups.my.statuses.${group.status}`)"
                :variant="statusVariants[group.status] ?? 'neutral'"
              />
            </div>
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
                <dt>{{ t('common.startDate') }}</dt>
                <dd>{{ group.startsAt ? formatGroupDate(group.startsAt) : '-' }}</dd>
              </div>
            </dl>
          </div>
          <div
            v-if="isEndable(group.status)"
            class="admin-groups__actions"
          >
            <!-- Only from PUBLISHED: `moderateGroup` refuses to reject a FULL group, so a
                 button on one would be a button that cannot work. -->
            <UiButton
              v-if="group.status === 'PUBLISHED'"
              variant="danger"
              size="sm"
              @click="returnToRevision(group)"
            >
              {{ t('admin.groups.returnToRevision') }}
            </UiButton>
            <UiButton
              variant="secondary"
              size="sm"
              :disabled="endingId === group.id"
              @click="requestEnding(group, 'COMPLETED')"
            >
              {{ t('admin.groups.complete') }}
            </UiButton>
            <UiButton
              variant="secondary"
              size="sm"
              :disabled="endingId === group.id"
              @click="requestEnding(group, 'CANCELLED')"
            >
              {{ t('admin.groups.cancel') }}
            </UiButton>
          </div>
        </li>
      </ul>

      <p
        v-else-if="pendingGroups.length > 0"
        class="admin-groups__empty"
      >
        {{ t('admin.groups.viewEmpty') }}
      </p>

      <div
        v-if="viewTotalPages > 1"
        class="admin-pagination"
      >
        <UiButton
          variant="secondary"
          size="sm"
          :disabled="viewPage <= 1"
          :aria-label="t('pagination.previous')"
          @click="reloadView(viewPage - 1)"
        >
          <span aria-hidden="true">←</span>
        </UiButton>
        <span class="admin-pagination__info">
          {{ viewPage }} / {{ viewTotalPages }}
        </span>
        <UiButton
          variant="secondary"
          size="sm"
          :disabled="viewPage >= viewTotalPages"
          :aria-label="t('pagination.next')"
          @click="reloadView(viewPage + 1)"
        >
          <span aria-hidden="true">→</span>
        </UiButton>
      </div>

      <UiEmptyState
        v-if="pendingGroups.length === 0 && viewGroups.length === 0"
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

    <UiConfirmModal
      :model-value="!!endingTargetId"
      :title="endingTitle"
      :message="endingMessage"
      :loading="!!endingId"
      @update:model-value="v => { if (!v) endingTargetId = null }"
      @confirm="confirmEnding"
    />
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

.admin-groups__view-controls {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--spacing-md);
  flex-wrap: wrap;
}

.admin-groups__view-select {
  width: 14rem;
  max-width: 100%;
}

.admin-groups__heading {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
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
