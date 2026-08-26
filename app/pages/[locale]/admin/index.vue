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

const { t, locale } = useLocale()
const { user, isLoading: authLoading } = useUser()

const activeTab = ref<'organizers' | 'users'>('organizers')
const organizers = ref<Organizer[]>([])
const users = ref<UserRecord[]>([])
const dataLoading = ref(false)

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

function updateOrganizer(id: string, updates: Partial<Organizer>) {
  const index = organizers.value.findIndex(t => t.id === id)
  if (index !== -1) {
    // Object.assign мутирует объект на месте — TS не теряет типы полей
    Object.assign(organizers.value[index], updates)
  }
}

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
      </div>

      <div
        v-if="dataLoading"
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
          v-else
          :users="users"
        />
      </template>
    </template>
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
</style>
