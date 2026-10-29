<script setup lang="ts">
import type { MyApplication } from '~~/types'
import { APPLICATION_STATUS_VARIANTS } from '~~/shared/constants/statusColors'
import { isPublicGroupStatus } from '~~/shared/constants/groupStatus'

const { t, locale } = useLocale()
const { startLoading, finishLoading } = usePageLoading()

const applications = ref<MyApplication[]>([])
const isLoading = ref(true)
const loadError = ref(false)
// Two refs rather than one: the id opens the confirmation modal, and clearing it on confirm
// closes the modal while the request is still in flight, so the button keeps its spinner.
const withdrawTargetId = ref<string | null>(null)
const withdrawingId = ref<string | null>(null)
const statusMessage = ref('')

const statusVariants = APPLICATION_STATUS_VARIANTS

/**
 * Whether the group page behind this application actually resolves. A CANCELLED group
 * answers 404 by design and DRAFT/PENDING_REVIEW/REJECTED were never public, so linking
 * unconditionally turned an old application into a dead link — most often right after a
 * rejection, when the organizer took the group down.
 */
function isGroupReachable(app: MyApplication) {
  return isPublicGroupStatus(app.group.status)
}

// Authentication is enforced by app/middleware/auth.global.ts before this page renders.
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
    const data = await $fetch<{ applications: MyApplication[] }>('/api/applications/my')
    applications.value = data.applications
  }
  catch {
    loadError.value = true
  }
  finally {
    isLoading.value = false
  }
}

async function confirmWithdraw() {
  const id = withdrawTargetId.value
  if (!id) return

  withdrawTargetId.value = null
  withdrawingId.value = id
  try {
    await $fetch(`/api/applications/${id}/withdraw`, { method: 'POST' })
    const app = applications.value.find(a => a.id === id)
    if (app) app.status = 'WITHDRAWN'
    statusMessage.value = t('applications.my.withdrawn')
  }
  catch {
    // Almost always the 409 the service throws for a non-PENDING application: the organizer
    // decided it between this page loading and the click. The local list is now wrong about
    // that row, so it is re-read rather than left showing a button that can only fail again.
    statusMessage.value = t('common.errors.actionFailed')
    await loadApplications()
  }
  finally {
    withdrawingId.value = null
  }
}

useHead({
  title: () => t('common.myApplications'),
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
  ],
})
</script>

<template>
  <div class="my-applications-page">
    <h1 class="my-applications-page__title">
      {{ t('common.myApplications') }}
    </h1>

    <div
      v-if="isLoading"
      class="my-applications-page__status"
    >
      {{ t('common.loading') }}
    </div>

    <div
      v-else-if="loadError"
      class="my-applications-page__error"
    >
      <p>{{ t('errors.failedToLoad') }}</p>
      <UiButton
        variant="secondary"
        @click="loadApplications"
      >
        {{ t('common.retry') }}
      </UiButton>
    </div>

    <UiEmptyState
      v-else-if="applications.length === 0"
      icon="📨"
      :title="t('applications.my.empty')"
    >
      <NuxtLink
        :to="`/${locale}/catalog`"
        class="my-applications-page__cta"
      >
        {{ t('common.browseGroups') }}
      </NuxtLink>
    </UiEmptyState>

    <div
      v-else
      class="my-applications-page__list"
    >
      <div
        v-for="app in applications"
        :key="app.id"
        class="my-application-card"
      >
        <div class="my-application-card__header">
          <NuxtLink
            v-if="isGroupReachable(app)"
            :to="`/${locale}/groups/${app.group.slug}`"
            class="my-application-card__group-link"
          >
            {{ app.group.title }}
          </NuxtLink>
          <span
            v-else
            class="my-application-card__group-title"
          >
            {{ app.group.title }}
          </span>
          <UiPill
            :label="t(`applications.my.statuses.${app.status}`)"
            :variant="statusVariants[app.status] ?? 'neutral'"
          />
        </div>

        <div class="my-application-card__meta">
          <span>{{ t('applications.my.submittedAt') }} {{ formatDate(app.createdAt, locale) }}</span>
          <span v-if="app.group.startsAt">
            {{ t('groups.startDate') }}: {{ formatDate(app.group.startsAt, locale) }}
          </span>
        </div>

        <!-- Cancelling a group does not rewrite the applications on it, so the pill above
             still reads "Approved" for an event that is not happening. Without this line the
             only thing telling the visitor their seat is gone is an email they may have
             deleted. -->
        <p
          v-if="app.group.status === 'CANCELLED'"
          class="my-application-card__cancelled"
        >
          {{ t('applications.my.groupCancelled') }}
        </p>

        <!-- Only PENDING is withdrawable: the service refuses any other status with a 409,
             so a button on a decided application would be a button that cannot work. -->
        <div
          v-if="app.status === 'PENDING'"
          class="my-application-card__actions"
        >
          <UiButton
            variant="secondary"
            size="sm"
            :loading="withdrawingId === app.id"
            @click="withdrawTargetId = app.id"
          >
            {{ t('applications.my.withdraw') }}
          </UiButton>
        </div>
      </div>

      <div
        role="status"
        aria-live="polite"
        class="sr-only"
      >
        {{ statusMessage }}
      </div>

      <UiConfirmModal
        :model-value="!!withdrawTargetId"
        :title="t('applications.my.withdraw')"
        :message="t('applications.my.withdrawConfirm')"
        :loading="!!withdrawingId"
        @update:model-value="value => { if (!value) withdrawTargetId = null }"
        @confirm="confirmWithdraw"
      />
    </div>
  </div>
</template>

<style scoped>
.my-applications-page {
  max-width: 48rem;
  margin: 0 auto;
  padding: var(--spacing-xl) var(--spacing-lg);
}

.my-applications-page__title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  margin: 0 0 var(--spacing-xl);
}

.my-applications-page__status {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--color-text-muted);
}

.my-applications-page__error {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--color-error-text);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
}

.my-applications-page__cta {
  display: inline-flex;
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-primary);
  color: var(--color-white);
  border-radius: var(--radius-md);
  font-weight: var(--font-weight-medium);
  text-decoration: none;
}

.my-applications-page__cta:hover {
  background: var(--color-primary-hover);
  color: var(--color-white);
  text-decoration: none;
}

.my-applications-page__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.my-application-card {
  background: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
}

.my-application-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-sm);
}

.my-application-card__group-link {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  text-decoration: none;
}

.my-application-card__group-link:hover {
  color: var(--color-primary);
  text-decoration: none;
}

/* Same weight as the link, minus the affordance: this group has no public page to go to. */
.my-application-card__group-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
}

.my-application-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs) var(--spacing-lg);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.my-application-card__cancelled {
  margin: var(--spacing-sm) 0 0;
  font-size: var(--font-size-sm);
  color: var(--color-error-text);
}

.my-application-card__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--spacing-md);
  padding-top: var(--spacing-md);
  border-top: var(--border-width) solid var(--color-border);
}
</style>
