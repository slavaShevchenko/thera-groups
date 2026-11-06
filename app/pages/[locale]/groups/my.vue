<script setup lang="ts">
import type { MyGroup } from '~~/types'
import { GROUP_STATUS_VARIANTS } from '~~/shared/constants/statusColors'
import { isPublicGroupStatus } from '~~/shared/constants/groupStatus'

const { t, locale } = useLocale()
const { can } = usePermissions()
const { startLoading, finishLoading, forceHide } = usePageLoading()

function onViewGroup() {
  setBackTo('my')
}

/**
 * Statuses whose group has a public page, so "View" and the applications link are real
 * destinations. `FULL` and `COMPLETED` used to be excluded here, which left an owner with
 * no way to open a group that had simply filled up.
 */
const isListed = (status: string) => isPublicGroupStatus(status)

const ownedGroups = ref<MyGroup[]>([])
const coOrganizedGroups = ref<MyGroup[]>([])
const isLoading = ref(true)
const loadError = ref(false)
const deletingSlug = ref<string | null>(null)
const deleteTargetSlug = ref<string | null>(null)

const statusVariants = GROUP_STATUS_VARIANTS

const canCreateGroup = computed(() => can('group.create'))

const sortedOwnedGroups = computed(() => {
  const drafts = ownedGroups.value
    .filter(g => g.status === 'DRAFT')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const rest = ownedGroups.value
    .filter(g => g.status !== 'DRAFT')
    .sort((a, b) => {
      if (!a.startsAt && !b.startsAt) return 0
      if (!a.startsAt) return 1
      if (!b.startsAt) return -1
      return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    })

  return [...drafts, ...rest]
})

function applicationsLabel(count: number): string {
  if (count === 0) return t('groups.my.applicationsZero')
  if (count === 1) return t('groups.my.applicationsOne', { count })

  const lastTwo = count % 100
  const lastOne = count % 10

  if (lastTwo >= 11 && lastTwo <= 19) return t('groups.my.applications', { count })
  if (lastOne === 1) return t('groups.my.applicationsOne', { count })
  if (lastOne >= 2 && lastOne <= 4) return t('groups.my.applicationsFew', { count })

  return t('groups.my.applications', { count })
}

// Authentication is enforced by app/middleware/auth.global.ts before this page renders;
// only the role scope is left to decide here.
const canViewList = can('group.viewMyList')

if (!canViewList) {
  forceHide()
  navigateTo(`/${locale.value}/`)
}

onMounted(async () => {
  if (!canViewList) return

  startLoading()
  try {
    await loadGroups()
  }
  finally {
    finishLoading()
  }
})

async function loadGroups() {
  isLoading.value = true
  loadError.value = false
  try {
    const data = await $fetch<{ owned: MyGroup[], coOrganized: MyGroup[] }>('/api/groups/my')
    ownedGroups.value = data.owned
    coOrganizedGroups.value = data.coOrganized
  }
  catch {
    loadError.value = true
  }
  finally {
    isLoading.value = false
  }
}

function requestDelete(slug: string) {
  deleteTargetSlug.value = slug
}

async function confirmDelete() {
  if (!deleteTargetSlug.value) return
  const slug = deleteTargetSlug.value
  deletingSlug.value = slug
  actionMessage.value = null
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await $fetch(`/api/groups/${slug}`, { method: 'DELETE' } as any)
    ownedGroups.value = ownedGroups.value.filter(g => g.slug !== slug)
  }
  catch (error) {
    // A group with pending or approved applications cannot be deleted — the cascade would
    // take them with it and tell nobody. The server says so with its own code, and the
    // owner needs the alternative rather than a silent no-op.
    const code = (error as { data?: { code?: string } })?.data?.code
    actionMessage.value = code === 'HAS_APPLICATIONS'
      ? t('groups.my.deleteBlocked')
      : t('groups.my.statusError')
  }
  finally {
    deletingSlug.value = null
    deleteTargetSlug.value = null
  }
}

type EndingStatus = 'COMPLETED' | 'CANCELLED'

const statusTargetSlug = ref<string | null>(null)
const statusTarget = ref<EndingStatus | null>(null)
const updatingStatusSlug = ref<string | null>(null)
const actionMessage = ref<string | null>(null)

const statusTargetGroup = computed(() =>
  ownedGroups.value.find(g => g.slug === statusTargetSlug.value) ?? null,
)

/**
 * Both transitions close the group to new applicants and email the approved ones, so they
 * sit behind a confirmation with the group's own name in it. Completing keeps the archive
 * page in the catalog; cancelling takes it down.
 */
function requestStatusChange(slug: string, status: EndingStatus) {
  statusTargetSlug.value = slug
  statusTarget.value = status
}

async function confirmStatusChange() {
  const slug = statusTargetSlug.value
  const status = statusTarget.value
  if (!slug || !status) return

  updatingStatusSlug.value = slug
  actionMessage.value = null
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await $fetch(`/api/groups/${slug}`, { method: 'PATCH', body: { status } } as any)
    const updated = ownedGroups.value.find(g => g.slug === slug)
    if (updated) updated.status = status
    actionMessage.value = t(status === 'COMPLETED' ? 'groups.my.statusCompleted' : 'groups.my.statusCancelled')
  }
  catch {
    actionMessage.value = t('groups.my.statusError')
  }
  finally {
    updatingStatusSlug.value = null
    statusTargetSlug.value = null
    statusTarget.value = null
  }
}

useHead({
  title: () => t('common.myGroups'),
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
  ],
})
</script>

<template>
  <div class="my-groups-page">
    <div class="my-groups-page__header">
      <h1 class="my-groups-page__title">
        {{ t('common.myGroups') }}
      </h1>
      <UiButton
        v-if="canCreateGroup"
        :to="`/${locale}/groups/new`"
        class="my-groups-page__create-btn"
      >
        + {{ t('common.createGroup') }}
      </UiButton>
    </div>

    <p
      v-if="actionMessage"
      class="my-groups-page__action-message"
      role="status"
    >
      {{ actionMessage }}
      <button
        type="button"
        class="my-groups-page__action-dismiss"
        :aria-label="t('common.close')"
        @click="actionMessage = null"
      >
        ✕
      </button>
    </p>

    <div
      v-if="isLoading"
      class="my-groups-page__status"
    >
      {{ t('common.loading') }}
    </div>

    <div
      v-else-if="loadError"
      class="my-groups-page__error"
    >
      <p>{{ t('errors.failedToLoad') }}</p>
      <UiButton
        variant="secondary"
        @click="loadGroups"
      >
        {{ t('common.retry') }}
      </UiButton>
    </div>

    <UiEmptyState
      v-else-if="sortedOwnedGroups.length === 0 && coOrganizedGroups.length === 0"
      icon="📋"
      :title="t('groups.my.empty')"
    >
      <UiButton
        v-if="canCreateGroup"
        :to="`/${locale}/groups/new`"
        variant="secondary"
      >
        {{ t('groups.my.emptyCta') }}
      </UiButton>
    </UiEmptyState>

    <div v-else>
      <div
        v-if="sortedOwnedGroups.length > 0"
        class="my-groups-page__grid"
      >
        <div
          v-for="group in sortedOwnedGroups"
          :key="group.id"
          class="my-group-card"
        >
          <UiPill
            :label="t(`groups.my.statuses.${group.status}`)"
            :variant="statusVariants[group.status] ?? 'neutral'"
          />
          <div class="my-group-card__header">
            <h3
              class="my-group-card__title"
              :class="{ 'my-group-card__title--unnamed': !group.title }"
            >
              {{ group.title || t('groups.my.unnamedDraft') }}
            </h3>
          </div>

          <div
            v-if="group.rejectionReason"
            class="my-group-card__rejection"
          >
            <span
              class="my-group-card__rejection-icon"
              aria-hidden="true"
            >✕</span>
            <div class="my-group-card__rejection-content">
              <strong>{{ t('common.rejectionReason') }}</strong>
              <p class="my-group-card__rejection-text">
                {{ group.rejectionReason }}
              </p>
            </div>
          </div>

          <div class="my-group-card__meta">
            <span
              v-if="group.startsAt"
              class="my-group-card__meta-item"
            >
              {{ formatDate(group.startsAt, locale) }}
            </span>
            <!--
              A plain span, not a NuxtLink: a DRAFT or PENDING_REVIEW group has no
              applications page to link to yet, and a NuxtLink without `to` renders an <a>
              with no href — it looks focusable and goes nowhere.
            -->
            <span
              v-if="group.status === 'DRAFT' || group.status === 'PENDING_REVIEW'"
              class="my-group-card__meta-item"
            >
              {{ applicationsLabel(group.applicationsCount) }}
            </span>
          </div>

          <div class="my-group-card__actions">
            <UiButton
              v-if="group.status === 'DRAFT' || group.status === 'PENDING_REVIEW' || group.status === 'REJECTED'"
              variant="secondary"
              size="sm"
              :to="`/${locale}/groups/edit/${group.slug}`"
            >
              {{ t('common.edit') }}
            </UiButton>

            <UiButton
              v-if="isListed(group.status) && group.applicationsCount > 0"
              variant="secondary"
              size="sm"
              :to="`/${locale}/groups/applications/${group.slug}`"
              class="my-group-card__btn--applications-has"
            >
              {{ applicationsLabel(group.applicationsCount) }}
            </UiButton>

            <div
              v-else-if="isListed(group.status)"
              class="my-group-card__no-applications"
            >
              {{ applicationsLabel(group.applicationsCount) }}
            </div>

            <UiButton
              v-if="isListed(group.status)"
              variant="secondary"
              size="sm"
              :to="`/${locale}/groups/${group.slug}`"
              @click="onViewGroup"
            >
              {{ t('groups.my.view') }}
            </UiButton>

            <UiButton
              v-if="group.status === 'PUBLISHED' || group.status === 'FULL'"
              variant="secondary"
              size="sm"
              :disabled="updatingStatusSlug === group.slug"
              @click="requestStatusChange(group.slug, 'COMPLETED')"
            >
              {{ t('groups.my.complete') }}
            </UiButton>

            <UiButton
              v-if="group.status === 'PUBLISHED' || group.status === 'FULL'"
              variant="danger"
              size="sm"
              :disabled="updatingStatusSlug === group.slug"
              @click="requestStatusChange(group.slug, 'CANCELLED')"
            >
              {{ t('groups.my.cancel') }}
            </UiButton>

            <UiButton
              v-if="group.status === 'DRAFT' || group.status === 'REJECTED'"
              variant="danger"
              size="sm"
              :disabled="deletingSlug === group.slug"
              @click="requestDelete(group.slug)"
            >
              {{ t('common.delete') }}
            </UiButton>
          </div>
        </div>
      </div>

      <div
        v-if="coOrganizedGroups.length > 0"
        class="my-groups-page__co-section"
      >
        <h2 class="my-groups-page__section-title">
          {{ t('groups.my.coOrganizedTitle') }}
        </h2>
        <div class="my-groups-page__grid">
          <div
            v-for="group in coOrganizedGroups"
            :key="group.id"
            class="my-group-card"
          >
            <div class="my-group-card__badges">
              <UiPill
                :label="t(`groups.my.statuses.${group.status}`)"
                :variant="statusVariants[group.status] ?? 'neutral'"
              />
              <UiPill
                :label="t('groups.my.coOrganizerBadge')"
                variant="primary"
              />
            </div>
            <div class="my-group-card__header">
              <h3
                class="my-group-card__title"
                :class="{ 'my-group-card__title--unnamed': !group.title }"
              >
                {{ group.title || t('groups.my.unnamedDraft') }}
              </h3>
            </div>

            <div class="my-group-card__meta">
              <span
                v-if="group.startsAt"
                class="my-group-card__meta-item"
              >
                {{ formatDate(group.startsAt, locale) }}
              </span>
              <span
                v-if="group.ownerName"
                class="my-group-card__meta-item"
              >
                {{ group.ownerName }}
              </span>
            </div>

            <div class="my-group-card__actions">
              <UiButton
                variant="secondary"
                size="sm"
                :to="`/${locale}/groups/edit/${group.slug}`"
              >
                {{ t('common.edit') }}
              </UiButton>
              <UiButton
                v-if="group.status === 'PUBLISHED'"
                variant="secondary"
                size="sm"
                :to="`/${locale}/groups/${group.slug}`"
                @click="onViewGroup"
              >
                {{ t('groups.my.view') }}
              </UiButton>
            </div>
          </div>
        </div>
      </div>
    </div>

    <UiConfirmModal
      :model-value="!!deleteTargetSlug"
      :title="t('groups.confirmDeleteTitle')"
      :message="t('groups.confirmDeleteMessage')"
      :loading="!!deletingSlug"
      @update:model-value="v => { if (!v) deleteTargetSlug = null }"
      @confirm="confirmDelete"
    />

    <UiConfirmModal
      :model-value="!!statusTargetSlug"
      :title="t(statusTarget === 'COMPLETED' ? 'groups.my.completeTitle' : 'groups.my.cancelTitle')"
      :message="t(
        statusTarget === 'COMPLETED' ? 'groups.my.completeMessage' : 'groups.my.cancelMessage',
        { title: statusTargetGroup?.title || t('groups.my.unnamedDraft') },
      )"
      :loading="!!updatingStatusSlug"
      @update:model-value="v => { if (!v) { statusTargetSlug = null; statusTarget = null } }"
      @confirm="confirmStatusChange"
    />
  </div>
</template>

<style scoped>
.my-groups-page {
  max-width: var(--container-width);
  margin: 0 auto;
  padding: var(--spacing-xl) var(--spacing-lg);
}

.my-groups-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-xl);
  gap: var(--spacing-md);
}

.my-groups-page__title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  margin: 0;
}

.my-groups-page__create-btn {
  white-space: nowrap;
}

.my-groups-page__action-message {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  margin: 0 0 var(--spacing-lg);
  padding: var(--spacing-sm) var(--spacing-md);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  font-size: var(--font-size-sm);
  color: var(--color-text);
}

.my-groups-page__action-dismiss {
  flex-shrink: 0;
  border: none;
  background: none;
  padding: 0 var(--spacing-xs);
  cursor: pointer;
  font-size: var(--font-size-sm);
  line-height: 1;
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
}

.my-groups-page__action-dismiss:hover {
  color: var(--color-text);
}

.my-groups-page__action-dismiss:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.my-groups-page__status {
  text-align: center;
  padding: var(--spacing-2xl);
  font-size: var(--font-size-lg);
  color: var(--color-text-muted);
}

.my-groups-page__error {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--color-error-text);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
}

.my-groups-page__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--spacing-lg);
}

.my-groups-page__co-section {
  margin-top: var(--spacing-2xl);
}

.my-groups-page__section-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  margin: 0 0 var(--spacing-lg);
}

.my-group-card__badges {
  display: flex;
  gap: var(--spacing-xs);
  flex-wrap: wrap;
}

.my-group-card {
  background: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.my-group-card .ui-pill {
  align-self: flex-start;
}

.my-group-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-sm);
}

.my-group-card__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  margin: 0;
  line-height: var(--line-height-tight);
  flex: 1;
  min-width: 0;
}

.my-group-card__title--unnamed {
  font-style: italic;
  color: var(--color-text-muted);
  font-weight: var(--font-weight-normal);
}

.my-group-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs) var(--spacing-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.my-group-card__meta-item::before {
  content: '·';
  margin-right: var(--spacing-xs);
}

.my-group-card__meta-item:first-child::before {
  content: '';
  margin: 0;
}

.my-group-card__actions {
  display: flex;
  gap: var(--spacing-sm);
  margin-top: auto;
  padding-top: var(--spacing-md);
  border-top: var(--border-width) solid var(--color-border);
}

.my-group-card__btn--applications-has {
  color: var(--color-warning);
  border-color: var(--color-warning);
  font-weight: var(--font-weight-semibold);
}

.my-group-card__no-applications {
  padding: var(--spacing-xs) var(--spacing-md);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  text-decoration: none;
}

@media (max-width: 1024px) {
  .my-groups-page__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.my-group-card__rejection {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm);
  background: var(--color-status-error-bg);
  border: var(--border-width) solid var(--color-status-error-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  color: var(--color-status-error-text);
}

.my-group-card__rejection-icon {
  flex-shrink: 0;
  font-size: var(--font-size-md);
  line-height: 1;
}

.my-group-card__rejection-content {
  flex: 1;
  min-width: 0;
}

.my-group-card__rejection-text {
  margin: var(--spacing-xs) 0 0;
  line-height: var(--line-height-normal);
}

@media (max-width: 640px) {
  .my-groups-page__grid {
    grid-template-columns: 1fr;
  }

  .my-groups-page__header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
