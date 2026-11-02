<script setup lang="ts">
import type { PendingProfile } from '~~/types'

const { t } = useLocale()
const { can } = usePermissions()

// Sent as `limit`, the name `paginationQuerySchema` declares.
const PAGE_SIZE = 20

const pendingProfiles = ref<PendingProfile[]>([])
const profilesCount = defineModel<number>('profilesCount', { default: 0 })
const total = ref(0)
const page = ref(1)
const loadError = ref(false)
const actionError = ref('')

const totalPages = computed(() => Math.ceil(total.value / PAGE_SIZE))

const verifyModalOpen = ref(false)
const rejectModalOpen = ref(false)
const actionId = ref<string | null>(null)
const rejectionReason = ref('')
const actionSubmitting = ref(false)

async function loadProfiles() {
  loadError.value = false
  try {
    const data = await $fetch<{
      items: PendingProfile[]
      total: number
      page: number
      totalPages: number
    }>('/api/admin/organizer-profiles/pending', {
      query: { page: page.value, limit: PAGE_SIZE },
    })
    pendingProfiles.value = data.items
    // The badge on the tab is the queue depth, so it counts every pending profile rather
    // than the ones this page happens to hold.
    total.value = data.total
    profilesCount.value = data.total
  }
  catch {
    loadError.value = true
  }
}

function goToPage(nextPage: number) {
  if (nextPage < 1 || nextPage > totalPages.value) return
  page.value = nextPage
  void loadProfiles()
}

/**
 * Drops a decided profile from the queue.
 *
 * Emptying the last row of a page past the first steps back a page: otherwise the admin is
 * left looking at an empty list with a live "previous" button and no hint that the queue
 * still has rows in it.
 */
function removeHandled(profileId: string) {
  pendingProfiles.value = pendingProfiles.value.filter(p => p.id !== profileId)
  total.value = Math.max(0, total.value - 1)
  profilesCount.value = total.value

  if (pendingProfiles.value.length === 0 && page.value > 1) {
    page.value -= 1
    return loadProfiles()
  }
  return Promise.resolve()
}

function verifyProfile(profile: PendingProfile) {
  actionId.value = profile.id
  verifyModalOpen.value = true
}

function rejectProfile(profile: PendingProfile) {
  actionId.value = profile.id
  rejectionReason.value = ''
  rejectModalOpen.value = true
}

async function confirmProfileVerify() {
  if (!actionId.value) return
  actionSubmitting.value = true
  actionError.value = ''
  try {
    await $fetch(`/api/admin/organizer-profiles/${actionId.value}`, {
      method: 'PATCH',
      body: { verificationStatus: 'VERIFIED' },
    })
    await removeHandled(actionId.value)
    verifyModalOpen.value = false
  }
  catch {
    actionError.value = t('common.errors.actionFailed')
  }
  finally {
    actionSubmitting.value = false
  }
}

async function confirmProfileReject() {
  if (!actionId.value || !rejectionReason.value.trim()) return
  actionSubmitting.value = true
  actionError.value = ''
  try {
    await $fetch(`/api/admin/organizer-profiles/${actionId.value}`, {
      method: 'PATCH',
      body: { verificationStatus: 'REJECTED', rejectionReason: rejectionReason.value.trim() },
    })
    await removeHandled(actionId.value)
    rejectModalOpen.value = false
  }
  catch {
    actionError.value = t('common.errors.actionFailed')
  }
  finally {
    actionSubmitting.value = false
  }
}

// The tab is mounted fresh every time it is selected (the parent renders it with v-if),
// so this is what fills it on a hard load of /admin as well as on a tab switch.
onMounted(loadProfiles)
</script>

<template>
  <div class="admin-profiles">
    <div
      v-if="loadError"
      class="admin-profiles__error"
    >
      <p>{{ t('errors.failedToLoad') }}</p>
      <UiButton
        variant="secondary"
        size="sm"
        @click="loadProfiles"
      >
        {{ t('common.retry') }}
      </UiButton>
    </div>

    <div
      v-if="actionError"
      class="admin-profiles__action-error"
      role="status"
    >
      {{ actionError }}
    </div>

    <h2
      v-if="!loadError && pendingProfiles.length > 0"
      class="admin-profiles__title"
    >
      {{ t('admin.profiles.pendingTitle') }} ({{ total }})
    </h2>

    <UiEmptyState
      v-if="!loadError && pendingProfiles.length === 0"
      :title="t('emptyStates.adminProfiles.title')"
    />

    <ul
      v-else
      class="admin-profiles__list"
    >
      <li
        v-for="profile in pendingProfiles"
        :key="profile.id"
        class="admin-profiles__item"
      >
        <div class="admin-profiles__info">
          <div class="admin-profiles__name">
            {{ profile.firstName }} {{ profile.lastName }}
          </div>
          <div class="admin-profiles__email">
            {{ profile.email }}
          </div>
          <div
            v-if="profile.qualification"
            class="admin-profiles__qualification"
          >
            {{ profile.qualification }}
          </div>
          <div
            v-if="profile.specializations.length > 0"
            class="admin-profiles__specs"
          >
            {{ profile.specializations.join(', ') }}
          </div>
        </div>
        <div
          v-if="can('admin.profiles.moderate')"
          class="admin-profiles__actions"
        >
          <UiButton
            variant="primary"
            size="sm"
            @click="verifyProfile(profile)"
          >
            {{ t('admin.profiles.verify') }}
          </UiButton>
          <UiButton
            variant="danger"
            size="sm"
            @click="rejectProfile(profile)"
          >
            {{ t('common.reject') }}
          </UiButton>
        </div>
      </li>
    </ul>

    <nav
      v-if="totalPages > 1"
      class="admin-profiles__pagination"
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
      <span class="admin-profiles__page-info">
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

    <UiModal
      v-model="verifyModalOpen"
      :title="t('admin.profiles.verifyTitle')"
    >
      <p class="admin-profiles__modal-text">
        {{ t('admin.profiles.verifyConfirm') }}
      </p>
      <div class="admin-profiles__modal-actions">
        <UiButton
          variant="secondary"
          @click="verifyModalOpen = false"
        >
          {{ t('common.cancel') }}
        </UiButton>
        <UiButton
          variant="primary"
          :disabled="actionSubmitting"
          @click="confirmProfileVerify"
        >
          {{ t('admin.profiles.verify') }}
        </UiButton>
      </div>
    </UiModal>

    <UiModal
      v-model="rejectModalOpen"
      :title="t('common.reject')"
    >
      <div class="admin-profiles__modal-form">
        <UiTextarea
          v-model="rejectionReason"
          :label="t('common.rejectionReason')"
          :placeholder="t('admin.profiles.rejectionPlaceholder')"
          :rows="4"
          required
        />
        <div class="admin-profiles__modal-actions">
          <UiButton
            variant="secondary"
            @click="rejectModalOpen = false"
          >
            {{ t('common.cancel') }}
          </UiButton>
          <UiButton
            variant="danger"
            :disabled="!rejectionReason.trim() || actionSubmitting"
            @click="confirmProfileReject"
          >
            {{ t('common.reject') }}
          </UiButton>
        </div>
      </div>
    </UiModal>
  </div>
</template>

<style scoped>
.admin-profiles__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  margin: 0 0 var(--spacing-md);
}

.admin-profiles__empty {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--color-text-muted);
}

.admin-profiles__error {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--color-error-text);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
}

.admin-profiles__action-error {
  background: var(--color-error-bg-soft);
  color: var(--color-error-text);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  margin-bottom: var(--spacing-md);
}

.admin-profiles__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.admin-profiles__item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
}

.admin-profiles__name {
  font-weight: var(--font-weight-semibold);
}

.admin-profiles__email {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.admin-profiles__qualification,
.admin-profiles__specs {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-top: var(--spacing-xs);
}

.admin-profiles__actions {
  display: flex;
  gap: var(--spacing-sm);
  flex-shrink: 0;
}

.admin-profiles__pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-lg);
}

.admin-profiles__page-info {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.admin-profiles__modal-text {
  margin: 0 0 var(--spacing-md);
}

.admin-profiles__modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-md);
}

.admin-profiles__modal-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}
</style>
