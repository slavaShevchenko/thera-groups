<script setup lang="ts">
interface PendingProfile {
  id: string
  slug: string
  firstName: string
  lastName: string
  email: string
  bio: string | null
  qualification: string | null
  avatarUrl: string | null
  city: string | null
  experienceYears: number | null
  specializations: string[]
  createdAt: string
}

const { t } = useLocale()

const pendingProfiles = ref<PendingProfile[]>([])
const profilesCount = defineModel<number>('profilesCount', { default: 0 })

const verifyModalOpen = ref(false)
const rejectModalOpen = ref(false)
const actionId = ref<string | null>(null)
const rejectionReason = ref('')
const actionSubmitting = ref(false)

async function loadProfiles() {
  try {
    const data = await $fetch<PendingProfile[]>('/api/admin/organizer-profiles/pending')
    pendingProfiles.value = data
    profilesCount.value = data.length
  }
  catch {
    // ignore
  }
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
  try {
    await $fetch(`/api/admin/organizer-profiles/${actionId.value}`, {
      method: 'PATCH',
      body: { verificationStatus: 'VERIFIED' },
    })
    pendingProfiles.value = pendingProfiles.value.filter(p => p.id !== actionId.value)
    profilesCount.value = pendingProfiles.value.length
    verifyModalOpen.value = false
  }
  catch {
    // ignore
  }
  finally {
    actionSubmitting.value = false
  }
}

async function confirmProfileReject() {
  if (!actionId.value || !rejectionReason.value.trim()) return
  actionSubmitting.value = true
  try {
    await $fetch(`/api/admin/organizer-profiles/${actionId.value}`, {
      method: 'PATCH',
      body: { verificationStatus: 'REJECTED', rejectionReason: rejectionReason.value.trim() },
    })
    pendingProfiles.value = pendingProfiles.value.filter(p => p.id !== actionId.value)
    profilesCount.value = pendingProfiles.value.length
    rejectModalOpen.value = false
  }
  catch {
    // ignore
  }
  finally {
    actionSubmitting.value = false
  }
}

defineExpose({ loadProfiles })
</script>

<template>
  <div class="admin-profiles">
    <h2
      v-if="pendingProfiles.length > 0"
      class="admin-profiles__title"
    >
      {{ t('admin.profiles.pendingTitle') }} ({{ pendingProfiles.length }})
    </h2>

    <div
      v-if="pendingProfiles.length === 0"
      class="admin-profiles__empty"
    >
      {{ t('admin.profiles.empty') }}
    </div>

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
        <div class="admin-profiles__actions">
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
