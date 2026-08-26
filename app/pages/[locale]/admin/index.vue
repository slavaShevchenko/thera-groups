<script setup lang="ts">
interface Organizer {
  id: string
  firstName: string
  lastName: string
  email: string
  isActive: boolean
  verificationStatus: string
  groupsCount: number
  createdAt: string
}

interface UserRecord {
  id: string
  email: string
  role: string
  isActive: boolean
  createdAt: string
}

interface PendingGroup {
  id: string
  slug: string
  title: string
  status: string
  type: string
  format: string
  startsAt: string
  category: string
  organizer: {
    id: string
    name: string
    slug: string
    avatarUrl: string | null
  }
  createdAt: string
  updatedAt: string
}

const { t, locale } = useLocale()
const { user, isLoading: authLoading } = useUser()

const activeTab = ref<'organizers' | 'users' | 'groups'>('organizers')
const organizers = ref<Organizer[]>([])
const users = ref<UserRecord[]>([])
const dataLoading = ref(false)

const pendingGroups = ref<PendingGroup[]>([])
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
      $fetch<Organizer[]>('/api/admin/organizers'),
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
    const data = await $fetch<PendingGroup[]>('/api/admin/groups', {
      query: { status: 'PENDING_REVIEW' },
    })
    pendingGroups.value = data
    groupsLoaded.value = true
  }
  catch {
    // ignore
  }
  finally {
    groupsLoading.value = false
  }
}

function updateOrganizer(id: string, updates: Partial<Organizer>) {
  const index = organizers.value.findIndex(t => t.id === id)
  if (index !== -1) {
    // Object.assign мутирует объект на месте — TS не теряет типы полей
    Object.assign(organizers.value[index], updates)
  }
}

function removeGroup(id: string) {
  pendingGroups.value = pendingGroups.value.filter(g => g.id !== id)
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
      body: { status: 'DRAFT', rejectionReason: rejectionReason.value.trim() },
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
})

// Единый watcher: редиректит не-админов + загружает данные админу
watch([isReady, isAdmin], ([ready, admin]) => {
  if (ready && !admin) {
    navigateTo(`/${locale.value}/`)
  }
  else if (ready && admin) {
    loadData()
  }
}, { immediate: true })

useHead({ title: () => t('admin.title') })
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

      <div
        class="admin-page__tabs"
        role="tablist"
        :aria-label="t('admin.title')"
      >
        <UiButton
          variant="ghost"
          class="admin-page__tab"
          :class="{ 'admin-page__tab--active': activeTab === 'organizers' }"
          role="tab"
          :aria-selected="activeTab === 'organizers'"
          @click="activeTab = 'organizers'"
        >
          {{ t('admin.tab.organizers') }}
        </UiButton>
        <UiButton
          variant="ghost"
          class="admin-page__tab"
          :class="{ 'admin-page__tab--active': activeTab === 'users' }"
          role="tab"
          :aria-selected="activeTab === 'users'"
          @click="activeTab = 'users'"
        >
          {{ t('admin.tab.users') }}
        </UiButton>
        <UiButton
          variant="ghost"
          class="admin-page__tab"
          :class="{ 'admin-page__tab--active': activeTab === 'groups' }"
          role="tab"
          :aria-selected="activeTab === 'groups'"
          @click="activeTab = 'groups'"
        >
          {{ t('admin.tab.groups') }}
        </UiButton>
      </div>

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
        <OrganizersTable
          v-if="activeTab === 'organizers'"
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
          <h2 class="admin-groups__title">
            {{ t('admin.groups.title') }}
          </h2>

          <div
            v-if="pendingGroups.length === 0"
            class="admin-groups__empty"
          >
            {{ t('admin.groups.empty') }}
          </div>

          <ul
            v-else
            class="admin-groups__list"
          >
            <li
              v-for="group in pendingGroups"
              :key="group.id"
              class="admin-groups__item"
            >
              <div class="admin-groups__info">
                <span class="admin-groups__group-title">
                  {{ group.title }}
                </span>

                <dl class="admin-groups__meta">
                  <div class="admin-groups__meta-row">
                    <dt>{{ t('admin.groups.organizerLabel') }}</dt>
                    <dd>
                      <NuxtLink
                        :to="`/${locale}/organizers/${group.organizer.slug}`"
                        class="admin-groups__organizer-link"
                      >
                        {{ group.organizer.name }}
                      </NuxtLink>
                    </dd>
                  </div>
                  <div class="admin-groups__meta-row">
                    <dt>{{ t('admin.groups.categoryLabel') }}</dt>
                    <dd>{{ group.category }}</dd>
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

.admin-page__tabs {
  display: flex;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-xl);
  border-bottom: var(--border-width) solid var(--color-border);
}

.admin-page__tab {
  padding: var(--spacing-sm) var(--spacing-lg);
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
  font-family: var(--font-family-base);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: all var(--transition-base);
}

.admin-page__tab:hover {
  color: var(--color-text);
}

.admin-page__tab--active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
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

.admin-groups__title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  margin: 0 0 var(--spacing-lg);
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
</style>
