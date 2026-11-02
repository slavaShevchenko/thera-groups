<script setup lang="ts">
import type { Application } from '~~/types'
import { APPLICATION_STATUS_VARIANTS } from '~~/shared/constants/statusColors'

const { t, locale } = useLocale()
const { startLoading, finishLoading } = usePageLoading()
const route = useRoute()

const slug = computed(() => route.params.slug as string)

/** What the endpoint returns about the group these applications belong to. */
interface GroupSummary {
  slug: string
  title: string
  status: string
  capacity: number | null
  approvedCount: number
}

interface ApplicationsResponse {
  applications: Application[]
  group: GroupSummary
  statusCounts: Record<string, number>
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const PAGE_SIZE = 20

const applications = ref<Application[]>([])
const group = ref<GroupSummary | null>(null)
/**
 * Tallied server-side over the whole group. Counting the loaded page instead made the
 * PENDING badge report "3" for a queue that held 53.
 */
const statusCounts = ref<Record<string, number>>({})
const page = ref(1)
const totalPages = ref(1)
const isLoading = ref(true)
const loadError = ref(false)
const activeFilter = ref('all')
const expandedIds = ref<Set<string>>(new Set())
const updatingId = ref<string | null>(null)
const statusMessage = ref('')

/** Decisions that need no input: approving, and reverting a rejection back to PENDING. */
const confirmModal = ref({
  open: false,
  title: '',
  message: '',
  applicationId: '',
  status: '' as 'APPROVED' | 'PENDING',
})

/** Rejecting collects a reason, so it gets its own modal instead of the plain confirm. */
const rejectModal = ref({
  open: false,
  applicationId: '',
  applicantName: '',
  reason: '',
})

const pendingCount = computed(() => statusCounts.value.PENDING ?? 0)

const filters = computed(() => [
  { value: 'all', label: t('groups.applications.filter.all') },
  { value: 'PENDING', label: t('groups.applications.filter.PENDING'), count: pendingCount.value || undefined },
  { value: 'APPROVED', label: t('groups.applications.filter.APPROVED') },
  { value: 'REJECTED', label: t('groups.applications.filter.REJECTED') },
])

/**
 * The endpoint already filters by status; this second pass is what makes a row leave the
 * view the moment its status is changed, which is what the queue did before the filter
 * moved server-side.
 */
const filteredApplications = computed(() => {
  if (activeFilter.value === 'all') return applications.value
  return applications.value.filter(a => a.status === activeFilter.value)
})

/**
 * Seats left, or `null` for an unlimited group. Approving past zero was only discoverable
 * by hitting the endpoint's 409, so the button is disabled and the reason shown here.
 */
const remainingSeats = computed(() => {
  if (!group.value || group.value.capacity === null) return null
  return Math.max(0, group.value.capacity - group.value.approvedCount)
})

const isAtCapacity = computed(() => remainingSeats.value === 0)

const statusVariants = APPLICATION_STATUS_VARIANTS

// Authentication is enforced by app/middleware/auth.global.ts. Access to this group's
// applications is enforced by the endpoint itself, which answers 403 for anyone but the
// owner, a co-organizer or an admin.
onMounted(async () => {
  startLoading()
  try {
    await loadApplications()
  }
  finally {
    finishLoading()
  }
})

async function loadApplications() {
  isLoading.value = true
  loadError.value = false
  try {
    const query: Record<string, string | number> = { page: page.value, limit: PAGE_SIZE }
    if (activeFilter.value !== 'all') query.status = activeFilter.value

    const data = await $fetch<ApplicationsResponse>(
      `/api/groups/${slug.value}/applications`,
      { query },
    )
    applications.value = data.applications
    group.value = data.group
    statusCounts.value = data.statusCounts
    totalPages.value = data.totalPages
  }
  catch (error) {
    // Retry cannot change a 403/404, so it must not render as a load failure with a
    // Retry button — and above all not as an empty application list.
    if (isPermanentFetchFailure(error)) {
      showError({ statusCode: fetchErrorStatus(error), fatal: true })
      return
    }
    loadError.value = true
  }
  finally {
    isLoading.value = false
  }
}

/** A new filter or page is a new list, so nothing from the previous one stays expanded. */
function resetList(nextPage: number) {
  page.value = nextPage
  expandedIds.value = new Set()
  return loadApplications()
}

// Bounded by the *current* filter's page count. The filter switch below deliberately is
// not: `totalPages` is 0 for a filter that matched nothing, and clamping against it would
// make switching back to "all" a no-op.
function goToPage(nextPage: number) {
  if (nextPage < 1 || nextPage > totalPages.value) return
  void resetList(nextPage)
}

watch(activeFilter, () => {
  void resetList(1)
})

function toggleExpand(id: string) {
  if (expandedIds.value.has(id)) {
    expandedIds.value.delete(id)
  }
  else {
    expandedIds.value.add(id)
  }
}

function requestApprove(id: string) {
  const app = applications.value.find(a => a.id === id)
  if (!app) return

  confirmModal.value = {
    open: true,
    title: t('groups.applications.confirmApproveTitle'),
    message: t('groups.applications.confirmApproveMessage', { name: app.name }),
    applicationId: id,
    status: 'APPROVED',
  }
}

function requestRevert(id: string) {
  const app = applications.value.find(a => a.id === id)
  if (!app) return

  confirmModal.value = {
    open: true,
    title: t('groups.applications.confirmRevertTitle'),
    message: t('groups.applications.confirmRevertMessage', { name: app.name }),
    applicationId: id,
    status: 'PENDING',
  }
}

function requestReject(id: string) {
  const app = applications.value.find(a => a.id === id)
  if (!app) return

  rejectModal.value = {
    open: true,
    applicationId: id,
    applicantName: app.name,
    reason: '',
  }
}

/**
 * Writes one decision and returns whether it landed, so a caller holding user input can
 * keep its modal open on failure instead of discarding what was typed.
 */
async function applyStatus(
  applicationId: string,
  status: 'APPROVED' | 'REJECTED' | 'PENDING',
  rejectionReason?: string,
) {
  updatingId.value = applicationId
  try {
    const data = await $fetch<{ application: Application, group: GroupSummary | null }>(
      `/api/groups/${slug.value}/applications/${applicationId}`,
      {
        method: 'PATCH',
        body: { status, ...(rejectionReason ? { rejectionReason } : {}) },
      },
    )
    const app = applications.value.find(a => a.id === applicationId)
    if (app) {
      const previousStatus = app.status
      app.status = data.application.status
      // Read back rather than echoed from the input: the server clears the reason on every
      // non-rejection, so a revert has to wipe it from the row too.
      app.rejectionReason = data.application.rejectionReason

      // The badge tallies the whole group, not this page, so it has to move with the row:
      // approving the last PENDING application otherwise left the tab still claiming one.
      if (previousStatus !== app.status) {
        statusCounts.value = {
          ...statusCounts.value,
          [previousStatus]: Math.max(0, (statusCounts.value[previousStatus] ?? 0) - 1),
          [app.status]: (statusCounts.value[app.status] ?? 0) + 1,
        }
      }
    }
    // Taken from the response, not counted here: the server also moves the group between
    // PUBLISHED and FULL as a side effect, and a locally computed tally would hide that.
    if (data.group) group.value = data.group
    statusMessage.value = status === 'APPROVED'
      ? t('groups.applications.statusApproved')
      : status === 'REJECTED'
        ? t('groups.applications.statusRejected')
        : t('groups.applications.statusReverted')
    return true
  }
  catch (error) {
    const code = (error as { data?: { code?: string } })?.data?.code
    statusMessage.value = code === 'GROUP_FULL'
      ? t('groups.applications.noSeats')
      : t('groups.applications.statusError')
    return false
  }
  finally {
    updatingId.value = null
  }
}

function doConfirmStatus() {
  const { applicationId, status } = confirmModal.value
  confirmModal.value.open = false
  void applyStatus(applicationId, status)
}

async function doReject() {
  const { applicationId, reason } = rejectModal.value
  const trimmed = reason.trim()
  // The button is disabled while this is empty; the guard is what makes `trimmed` non-empty
  // for the request below, since the server answers 400 without a reason.
  if (!trimmed) return

  if (await applyStatus(applicationId, 'REJECTED', trimmed)) {
    rejectModal.value.open = false
    rejectModal.value.reason = ''
  }
}

useHead({
  title: () => t('groups.applications.title'),
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
  ],
})
</script>

<template>
  <div class="applications-page">
    <div class="applications-page__header">
      <NuxtLink
        :to="`/${locale}/groups/my`"
        class="applications-page__back"
      >
        ← {{ t('common.myGroups') }}
      </NuxtLink>
      <h1 class="applications-page__title">
        {{ t('groups.applications.title') }}
      </h1>
      <span
        v-if="pendingCount > 0"
        class="applications-page__pending-badge"
      >
        {{ t('groups.applications.pendingCount', { count: pendingCount }) }}
      </span>
    </div>

    <section
      v-if="group"
      class="applications-page__group"
    >
      <NuxtLink
        :to="`/${locale}/groups/${group.slug}`"
        class="applications-page__group-title"
      >
        {{ group.title }}
      </NuxtLink>

      <dl class="applications-page__seats">
        <div class="applications-page__seat">
          <dt class="applications-page__seat-label">
            {{ t('groups.applications.capacity') }}
          </dt>
          <dd class="applications-page__seat-value">
            {{ group.capacity === null ? t('groups.applications.unlimited') : group.capacity }}
          </dd>
        </div>
        <div class="applications-page__seat">
          <dt class="applications-page__seat-label">
            {{ t('groups.applications.approved') }}
          </dt>
          <dd class="applications-page__seat-value">
            {{ group.approvedCount }}
          </dd>
        </div>
        <div class="applications-page__seat">
          <dt class="applications-page__seat-label">
            {{ t('groups.applications.remaining') }}
          </dt>
          <dd
            class="applications-page__seat-value"
            :class="{ 'applications-page__seat-value--none': isAtCapacity }"
          >
            {{ remainingSeats === null ? t('groups.applications.unlimited') : remainingSeats }}
          </dd>
        </div>
      </dl>

      <p
        v-if="isAtCapacity"
        class="applications-page__no-seats"
      >
        {{ t('groups.applications.noSeats') }}
      </p>
    </section>

    <div
      v-if="isLoading"
      class="applications-page__status"
    >
      {{ t('common.loading') }}
    </div>

    <div
      v-else-if="loadError"
      class="applications-page__error"
    >
      <p>{{ t('errors.failedToLoad') }}</p>
      <UiButton
        variant="secondary"
        @click="loadApplications"
      >
        {{ t('common.retry') }}
      </UiButton>
    </div>

    <template v-else>
      <UiTabs
        v-model="activeFilter"
        :tabs="filters"
      />

      <UiEmptyState
        v-if="filteredApplications.length === 0"
        :title="t('emptyStates.applications.title')"
      />

      <div
        v-else
        class="applications-page__list"
      >
        <div
          v-for="app in filteredApplications"
          :key="app.id"
          class="application-row"
        >
          <button
            v-if="app.answers.length > 0"
            type="button"
            class="application-row__main application-row__main--expandable"
            :aria-expanded="expandedIds.has(app.id)"
            :aria-controls="`answer-${app.id}`"
            @click="toggleExpand(app.id)"
          >
            <div class="application-row__info">
              <span class="application-row__name">{{ app.name }}</span>
              <a
                :href="`mailto:${app.email}`"
                class="application-row__email"
                @click.stop
              >{{ app.email }}</a>
              <a
                v-if="app.phone"
                :href="`tel:${app.phone}`"
                class="application-row__phone"
                @click.stop
              >{{ app.phone }}</a>
              <span class="application-row__date">
                {{ formatDate(app.createdAt, locale) }}
              </span>
            </div>

            <div class="application-row__right">
              <UiPill
                :label="t(`applications.my.statuses.${app.status}`)"
                :variant="statusVariants[app.status] ?? 'neutral'"
              />

              <div
                v-if="app.status === 'PENDING'"
                class="application-row__actions"
              >
                <UiButton
                  variant="secondary"
                  size="sm"
                  class="application-row__action-btn application-row__action-btn--approve"
                  :disabled="updatingId === app.id || isAtCapacity"
                  @click.stop="requestApprove(app.id)"
                >
                  {{ t('groups.applications.approve') }}
                </UiButton>
                <UiButton
                  variant="danger"
                  size="sm"
                  class="application-row__action-btn application-row__action-btn--reject"
                  :disabled="updatingId === app.id"
                  @click.stop="requestReject(app.id)"
                >
                  {{ t('common.reject') }}
                </UiButton>
              </div>

              <!-- Undo for a wrong rejection, offered on REJECTED only: the server refuses
                   to move any other status back to PENDING. -->
              <div
                v-else-if="app.status === 'REJECTED'"
                class="application-row__actions"
              >
                <UiButton
                  variant="secondary"
                  size="sm"
                  class="application-row__action-btn"
                  :disabled="updatingId === app.id"
                  @click.stop="requestRevert(app.id)"
                >
                  {{ t('groups.applications.revert') }}
                </UiButton>
              </div>

              <div
                class="application-row__chevron"
              >
                <UiIcon
                  name="chevron-down"
                  :size="20"
                  aria-hidden="true"
                  class="application-row__chevron-icon"
                  :class="{ 'application-row__chevron-icon--expanded': expandedIds.has(app.id) }"
                />
              </div>
            </div>
          </button>

          <div
            v-else
            class="application-row__main"
          >
            <div class="application-row__info">
              <span class="application-row__name">{{ app.name }}</span>
              <a
                :href="`mailto:${app.email}`"
                class="application-row__email"
              >{{ app.email }}</a>
              <a
                v-if="app.phone"
                :href="`tel:${app.phone}`"
                class="application-row__phone"
              >{{ app.phone }}</a>
              <span class="application-row__date">
                {{ formatDate(app.createdAt, locale) }}
              </span>
            </div>

            <div class="application-row__right">
              <UiPill
                :label="t(`applications.my.statuses.${app.status}`)"
                :variant="statusVariants[app.status] ?? 'neutral'"
              />

              <div
                v-if="app.status === 'PENDING'"
                class="application-row__actions"
              >
                <UiButton
                  variant="secondary"
                  size="sm"
                  class="application-row__action-btn application-row__action-btn--approve"
                  :disabled="updatingId === app.id || isAtCapacity"
                  @click.stop="requestApprove(app.id)"
                >
                  {{ t('groups.applications.approve') }}
                </UiButton>
                <UiButton
                  variant="danger"
                  size="sm"
                  class="application-row__action-btn application-row__action-btn--reject"
                  :disabled="updatingId === app.id"
                  @click.stop="requestReject(app.id)"
                >
                  {{ t('common.reject') }}
                </UiButton>
              </div>

              <!-- Undo for a wrong rejection, offered on REJECTED only: the server refuses
                   to move any other status back to PENDING. -->
              <div
                v-else-if="app.status === 'REJECTED'"
                class="application-row__actions"
              >
                <UiButton
                  variant="secondary"
                  size="sm"
                  class="application-row__action-btn"
                  :disabled="updatingId === app.id"
                  @click.stop="requestRevert(app.id)"
                >
                  {{ t('groups.applications.revert') }}
                </UiButton>
              </div>
            </div>
          </div>

          <!-- A sibling of the row header, not inside it: that header can be a <button>,
               which may not contain block content. Shown collapsed, because the reason
               must be readable for an application that has no answers to expand. -->
          <p
            v-if="app.status === 'REJECTED' && app.rejectionReason"
            class="application-row__reason"
          >
            <span class="application-row__reason-label">{{ t('common.rejectionReason') }}</span>
            {{ app.rejectionReason }}
          </p>

          <div
            v-if="expandedIds.has(app.id) && app.answers.length > 0"
            :id="`answer-${app.id}`"
            role="region"
            class="application-row__answers"
          >
            <div
              v-for="ans in app.answers"
              :key="ans.questionId"
              class="application-row__answer"
            >
              <dt class="application-row__answer-question">
                {{ ans.question }}
              </dt>
              <dd class="application-row__answer-value">
                {{ ans.value }}
              </dd>
            </div>
          </div>
        </div>
      </div>

      <nav
        v-if="totalPages > 1"
        class="applications-page__pagination"
        :aria-label="t('pagination.label')"
      >
        <UiButton
          variant="secondary"
          size="sm"
          :disabled="page <= 1"
          :aria-label="t('pagination.previous')"
          @click="goToPage(page - 1)"
        >
          <span aria-hidden="true">←</span>
        </UiButton>
        <span class="applications-page__page-info">
          {{ page }} / {{ totalPages }}
        </span>
        <UiButton
          variant="secondary"
          size="sm"
          :disabled="page >= totalPages"
          :aria-label="t('pagination.next')"
          @click="goToPage(page + 1)"
        >
          <span aria-hidden="true">→</span>
        </UiButton>
      </nav>

      <div
        role="status"
        aria-live="polite"
        class="sr-only"
      >
        {{ statusMessage }}
      </div>

      <UiConfirmModal
        v-model="confirmModal.open"
        :title="confirmModal.title"
        :message="confirmModal.message"
        @confirm="doConfirmStatus"
      />

      <!-- Rejecting is the one decision that needs input: the server answers 400 without a
           reason, so the submit button stays disabled until there is one. The modal closes
           only on success, and a failure leaves what the organizer typed in place. -->
      <UiModal
        v-model="rejectModal.open"
        :title="t('groups.applications.confirmRejectTitle')"
      >
        <div class="applications-page__reject-form">
          <p class="applications-page__reject-hint">
            {{ t('groups.applications.confirmRejectMessage', { name: rejectModal.applicantName }) }}
          </p>
          <UiTextarea
            v-model="rejectModal.reason"
            :label="t('common.rejectionReason')"
            :placeholder="t('groups.applications.rejectionPlaceholder')"
            :rows="4"
            required
          />
          <div class="applications-page__reject-actions">
            <UiButton
              variant="secondary"
              :disabled="!!updatingId"
              @click="rejectModal.open = false"
            >
              {{ t('common.cancel') }}
            </UiButton>
            <UiButton
              variant="danger"
              :disabled="!rejectModal.reason.trim()"
              :loading="updatingId === rejectModal.applicationId"
              @click="doReject"
            >
              {{ t('common.reject') }}
            </UiButton>
          </div>
        </div>
      </UiModal>
    </template>
  </div>
</template>

<style scoped>
.applications-page {
  max-width: var(--container-width);
  margin: 0 auto;
  padding: var(--spacing-xl) var(--spacing-lg);
}

.applications-page__header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
  flex-wrap: wrap;
}

.applications-page__back {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  text-decoration: none;
}

.applications-page__back:hover {
  color: var(--color-primary);
  text-decoration: none;
}

.applications-page__title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  margin: 0;
  flex: 1;
}

.applications-page__pending-badge {
  padding: var(--spacing-xs) var(--spacing-md);
  background: var(--color-status-warning-bg);
  color: var(--color-status-warning-text);
  border-radius: var(--radius-full);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.applications-page__group {
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
}

.applications-page__group-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  text-decoration: none;
}

.applications-page__group-title:hover {
  color: var(--color-primary);
  text-decoration: underline;
}

.applications-page__group-title:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

.applications-page__seats {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm) var(--spacing-2xl);
  margin: var(--spacing-sm) 0 0;
}

.applications-page__seat {
  display: flex;
  align-items: baseline;
  gap: var(--spacing-xs);
}

.applications-page__seat-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.applications-page__seat-value {
  margin: 0;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

.applications-page__seat-value--none {
  color: var(--color-status-error-text);
}

.applications-page__no-seats {
  margin: var(--spacing-sm) 0 0;
  font-size: var(--font-size-sm);
  color: var(--color-status-error-text);
}

.applications-page__status {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--color-text-muted);
}

.applications-page__error {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--color-error-text);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
}

.applications-page__empty {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--color-text-muted);
  font-size: var(--font-size-lg);
}

.applications-page__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.applications-page__pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-lg);
}

.applications-page__page-info {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.application-row {
  background: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.application-row__main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md) var(--spacing-lg);
  gap: var(--spacing-md);
  transition: background var(--transition-base);
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  font-family: var(--font-family-base);
  font-size: inherit;
  cursor: default;
}

button.application-row__main {
  cursor: pointer;
}

.application-row__main--expandable {
  cursor: pointer;
}

.application-row__main--expandable:hover {
  background: var(--color-background);
}

.application-row__info {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
}

.application-row__name {
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.application-row__email {
  font-size: var(--font-size-sm);
  color: var(--color-primary);
}

.application-row__phone {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.application-row__date {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.application-row__right {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-shrink: 0;
}

.application-row__actions {
  display: flex;
  gap: var(--spacing-xs);
}

.application-row__action-btn {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  font-family: var(--font-family-base);
  cursor: pointer;
  transition: border-color var(--transition-base), background-color var(--transition-base);
}

.application-row__action-btn--approve {
  color: var(--color-status-success-text);
  border-color: var(--color-status-success-border);
}

.application-row__action-btn--approve:hover:not(:disabled) {
  background: var(--color-status-success-bg);
}

.application-row__action-btn--reject {
  color: var(--color-status-error-text);
  border-color: var(--color-status-error-border);
}

.application-row__action-btn--reject:hover:not(:disabled) {
  background: var(--color-status-error-bg);
}

.application-row__action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.application-row__chevron {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  color: var(--color-text-muted);
  border-radius: var(--radius-full);
  transition: background var(--transition-base), color var(--transition-base);
}

.application-row__main--expandable:hover .application-row__chevron {
  color: var(--color-primary);
}

.application-row__chevron-icon {
  transition: transform var(--transition-base);
}

.application-row__chevron-icon--expanded {
  transform: rotate(180deg);
}

/* Same treatment as the answers panel below it: a detail belonging to the row above. */
.application-row__reason {
  margin: 0;
  padding: var(--spacing-md) var(--spacing-lg);
  border-top: var(--border-width) solid var(--color-border);
  background: var(--color-background);
  font-size: var(--font-size-sm);
  color: var(--color-text);
}

.application-row__reason-label {
  display: block;
  font-size: var(--font-size-md);
  color: var(--color-text-muted);
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--spacing-xs);
}

.application-row__answers {
  padding: var(--spacing-md) var(--spacing-lg);
  border-top: var(--border-width) solid var(--color-border);
  background: var(--color-background);
}

.application-row__answer {
  margin-bottom: var(--spacing-sm);
}

.application-row__answer:last-child {
  margin-bottom: 0;
}

.application-row__answer-question {
  font-size: var(--font-size-md);
  color: var(--color-text-muted);
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--spacing-md);
}

.application-row__answer-value {
  font-size: var(--font-size-sm);
  color: var(--color-text);
  margin: 0;
}

/* Matches the admin rejection dialog, so refusing a group and refusing an applicant ask
   for the reason the same way. */
.applications-page__reject-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.applications-page__reject-hint {
  margin: 0;
  font-size: var(--font-size-md);
  color: var(--color-text);
  line-height: var(--line-height-relaxed);
}

.applications-page__reject-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
}

@media (max-width: 640px) {
  .application-row__main {
    flex-direction: column;
    align-items: flex-start;
  }

  .application-row__right {
    width: 100%;
    justify-content: space-between;
  }

  .application-row__info {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-xs);
  }
}
</style>
