<script setup lang="ts">
import type { AdminOrganizer, UserRecord, PendingGroup } from '~~/types'

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

const { t, locale } = useLocale()
const { user, isLoading: authLoading } = useUser()

const activeTab = ref<'organizers' | 'users' | 'groups' | 'profiles'>('organizers')
const organizers = ref<AdminOrganizer[]>([])
const users = ref<UserRecord[]>([])
const dataLoading = ref(false)

const pendingProfiles = ref<PendingProfile[]>([])
const profilesLoading = ref(false)
const profilesLoaded = ref(false)

const profileVerifyModalOpen = ref(false)
const profileRejectModalOpen = ref(false)
const profileActionId = ref<string | null>(null)
const profileRejectionReason = ref('')
const profileActionSubmitting = ref(false)

const adminTabs = computed(() => [
  { value: 'profiles', label: t('admin.tab.profiles'), count: pendingProfiles.value.length || undefined },
  { value: 'organizers', label: t('admin.tab.organizers') },
  { value: 'users', label: t('admin.tab.users') },
  { value: 'groups', label: t('admin.tab.groups'), count: pendingGroups.value.length || undefined },
])

function onOpenGroup() {
  setBackTo('admin')
}

const pendingGroups = ref<PendingGroup[]>([])
const publishedGroups = ref<PendingGroup[]>([])
const groupsLoading = ref(false)
const groupsLoaded = ref(false)

const rejectionModalOpen = ref(false)
const rejectionGroupId = ref<string | null>(null)
const rejectionReason = ref('')
const rejectionSubmitting = ref(false)

const isAdmin = computed(() => user.value?.role === 'ADMIN')
const isReady = computed(() => !authLoading.value && user.value !== null)

async function loadData() {
  dataLoading.value = true
  try {
    const [organizersData, usersData] = await Promise.all([
      $fetch<AdminOrganizer[]>('/api/admin/organizers'),
      $fetch<UserRecord[]>('/api/admin/users'),
    ])
    organizers.value = organizersData
    users.value = usersData
  }
  catch {
    // ignore
  }
  finally {
    dataLoading.value = false
  }
}

async function loadGroups() {
  if (groupsLoaded.value) return
  groupsLoading.value = true
  try {
    const [pending, published] = await Promise.all([
      $fetch<PendingGroup[]>('/api/admin/groups', { query: { status: 'PENDING_REVIEW' } }),
      $fetch<PendingGroup[]>('/api/admin/groups', { query: { status: 'PUBLISHED' } }),
    ])
    pendingGroups.value = pending
    publishedGroups.value = published
    groupsLoaded.value = true
  }
  catch {
    // ignore
  }
  finally {
    groupsLoading.value = false
  }
}

function updateOrganizer(id: string, updates: Partial<AdminOrganizer>) {
  const index = organizers.value.findIndex(t => t.id === id)
  if (index !== -1) {
    // Object.assign мутирует объект на месте — TS не теряет типы полей
    const target = organizers.value[index]
    if (target) Object.assign(target, updates)
  }
}

function removeGroup(id: string) {
  pendingGroups.value = pendingGroups.value.filter(g => g.id !== id)
  publishedGroups.value = publishedGroups.value.filter(g => g.id !== id)
}

function returnToRevision(group: PendingGroup) {
  rejectionGroupId.value = group.id
  rejectionReason.value = ''
  rejectionModalOpen.value = true
}

async function loadProfiles() {
  if (profilesLoaded.value) return
  profilesLoading.value = true
  try {
    const data = await $fetch<PendingProfile[]>('/api/admin/organizer-profiles/pending')
    pendingProfiles.value = data
    profilesLoaded.value = true
  }
  catch {
    // ignore
  }
  finally {
    profilesLoading.value = false
  }
}

function verifyProfile(profile: PendingProfile) {
  profileActionId.value = profile.id
  profileVerifyModalOpen.value = true
}

function rejectProfile(profile: PendingProfile) {
  profileActionId.value = profile.id
  profileRejectionReason.value = ''
  profileRejectModalOpen.value = true
}

async function confirmProfileVerify() {
  if (!profileActionId.value) return
  profileActionSubmitting.value = true
  try {
    await $fetch(`/api/admin/organizer-profiles/${profileActionId.value}`, {
      method: 'PATCH',
      body: { verificationStatus: 'VERIFIED' },
    })
    pendingProfiles.value = pendingProfiles.value.filter(p => p.id !== profileActionId.value)
    profileVerifyModalOpen.value = false
  }
  catch {
    // ignore
  }
  finally {
    profileActionSubmitting.value = false
  }
}

async function confirmProfileReject() {
  if (!profileActionId.value || !profileRejectionReason.value.trim()) return
  profileActionSubmitting.value = true
  try {
    await $fetch(`/api/admin/organizer-profiles/${profileActionId.value}`, {
      method: 'PATCH',
      body: { verificationStatus: 'REJECTED', rejectionReason: profileRejectionReason.value.trim() },
    })
    pendingProfiles.value = pendingProfiles.value.filter(p => p.id !== profileActionId.value)
    profileRejectModalOpen.value = false
  }
  catch {
    // ignore
  }
  finally {
    profileActionSubmitting.value = false
  }
}

async function approveGroup(group: PendingGroup) {
  try {
    await $fetch(`/api/admin/groups/${group.id}`, {
      method: 'PATCH',
      body: { status: 'PUBLISHED' },
    })
    removeGroup(group.id)
  }
  catch {
    // ignore
  }
}

function openRejectionModal(group: PendingGroup) {
  rejectionGroupId.value = group.id
  rejectionReason.value = ''
  rejectionModalOpen.value = true
}

async function confirmRejection() {
  if (!rejectionGroupId.value || !rejectionReason.value.trim()) return
  rejectionSubmitting.value = true
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
    // ignore
  }
  finally {
    rejectionSubmitting.value = false
  }
}

watch(activeTab, (tab) => {
  if (tab === 'groups') {
    loadGroups()
  }
  if (tab === 'profiles') {
    loadProfiles()
  }
})

// Единый watcher: редиректит не-админов + загружает данные админу
watch([isReady, isAdmin], ([ready, admin]) => {
  if (ready && !admin) {
    navigateTo(`/${locale.value}/`)
  }
  else if (ready && admin) {
    loadData()
    loadProfiles()
  }
}, { immediate: true })

useHead({
  title: () => t('admin.title'),
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
  ],
})
</script>

<template>
  <div class="admin-page">
    <div
      v-if="!isReady"
      class="admin-page__loader"
    >
      <div class="admin-page__spinner"></div>
    </div>

    <template v-else-if="isAdmin">
      <h1 class="admin-page__title">
        {{ t('admin.title') }}
      </h1>

      <UiTabs
        v-model="activeTab"
        :tabs="adminTabs"
      />

      <div
        v-if="dataLoading && activeTab !== 'groups'"
        class="admin-page__loader"
      >
        <div class="admin-page__spinner"></div>
      </div>

      <div
        v-else-if="groupsLoading"
        class="admin-page__loader"
      >
        <div class="admin-page__spinner"></div>
      </div>

      <template v-else>
        <!-- Профілі на верифікації -->
        <div
          v-if="activeTab === 'profiles'"
          class="admin-profiles"
        >
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
                  {{ t('admin.profiles.reject') }}
                </UiButton>
              </div>
            </li>
          </ul>
        </div>

        <OrganizersTable
          v-else-if="activeTab === 'organizers'"
          :organizers="organizers"
          @verify="updateOrganizer"
          @toggle-active="updateOrganizer"
        />
        <UsersTable
          v-else-if="activeTab === 'users'"
          :users="users"
        />

        <div
          v-else-if="activeTab === 'groups'"
          class="admin-groups"
        >
          <!-- На модерації -->
          <h2
            v-if="pendingGroups.length > 0"
            class="admin-groups__section-title"
          >
            {{ t('admin.groups.pendingSection') }} ({{ pendingGroups.length }})
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
                    <dd>{{ group.type }}</dd>
                  </div>
                  <div class="admin-groups__meta-row">
                    <dt>{{ t('admin.groups.formatLabel') }}</dt>
                    <dd>{{ group.format }}</dd>
                  </div>
                  <div class="admin-groups__meta-row">
                    <dt>{{ t('admin.groups.startDateLabel') }}</dt>
                    <dd>{{ formatDate(group.startsAt, locale) }}</dd>
                  </div>
                </dl>
              </div>

              <div class="admin-groups__actions">
                <UiButton
                  variant="primary"
                  size="sm"
                  @click="approveGroup(group)"
                >
                  {{ t('admin.groups.approve') }}
                </UiButton>
                <UiButton
                  variant="danger"
                  size="sm"
                  @click="openRejectionModal(group)"
                >
                  {{ t('admin.groups.reject') }}
                </UiButton>
              </div>
            </li>
          </ul>

          <!-- Опубліковані -->
          <h2
            v-if="publishedGroups.length > 0"
            class="admin-groups__section-title"
          >
            {{ t('admin.groups.publishedSection') }} ({{ publishedGroups.length }})
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
            v-if="pendingGroups.length === 0 && publishedGroups.length === 0"
            class="admin-groups__empty"
          >
            {{ t('admin.groups.empty') }}
          </div>
        </div>
      </template>
    </template>

    <UiModal
      v-model="rejectionModalOpen"
      :title="t('admin.groups.reject')"
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
            {{ t('common.actions.cancel') }}
          </UiButton>
          <UiButton
            variant="danger"
            :disabled="!rejectionReason.trim() || rejectionSubmitting"
            @click="confirmRejection"
          >
            {{ t('admin.groups.reject') }}
          </UiButton>
        </div>
      </div>
    </UiModal>

    <!-- Модалка верифікації профілю -->
    <UiModal
      v-model="profileVerifyModalOpen"
      :title="t('admin.profiles.verifyTitle')"
    >
      <p class="admin-profiles__modal-text">
        {{ t('admin.profiles.verifyConfirm') }}
      </p>
      <div class="admin-profiles__modal-actions">
        <UiButton
          variant="secondary"
          @click="profileVerifyModalOpen = false"
        >
          {{ t('common.actions.cancel') }}
        </UiButton>
        <UiButton
          variant="primary"
          :disabled="profileActionSubmitting"
          @click="confirmProfileVerify"
        >
          {{ t('admin.profiles.verify') }}
        </UiButton>
      </div>
    </UiModal>

    <!-- Модалка відхилення профілю -->
    <UiModal
      v-model="profileRejectModalOpen"
      :title="t('admin.profiles.reject')"
    >
      <div class="admin-profiles__modal-form">
        <UiTextarea
          v-model="profileRejectionReason"
          :label="t('admin.profiles.rejectionReason')"
          :placeholder="t('admin.profiles.rejectionPlaceholder')"
          :rows="4"
          required
        />
        <div class="admin-profiles__modal-actions">
          <UiButton
            variant="secondary"
            @click="profileRejectModalOpen = false"
          >
            {{ t('common.actions.cancel') }}
          </UiButton>
          <UiButton
            variant="danger"
            :disabled="!profileRejectionReason.trim() || profileActionSubmitting"
            @click="confirmProfileReject"
          >
            {{ t('admin.profiles.reject') }}
          </UiButton>
        </div>
      </div>
    </UiModal>
  </div>
</template>

<style scoped>
.admin-page {
  max-width: var(--container-width);
  margin: 0 auto;
  padding: var(--spacing-xl) var(--spacing-lg);
}

.admin-page__title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  margin: 0 0 var(--spacing-xl);
}

.admin-page__loader {
  display: flex;
  justify-content: center;
  padding: var(--spacing-2xl);
}

.admin-page__spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: var(--radius-full);
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
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
