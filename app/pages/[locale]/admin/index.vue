<script setup lang="ts">
const { t, locale } = useLocale()
const { user, isLoading: authLoading } = useUser()
const { can } = usePermissions()

type AdminTab = 'profiles' | 'organizers' | 'users' | 'groups' | 'applications'

const activeTab = ref<AdminTab>('profiles')

const profilesCount = ref(0)
const groupsPendingCount = ref(0)
const applicationsPendingCount = ref(0)

const profilesTab = ref<{ loadProfiles: () => Promise<void> } | null>(null)
const organizersTab = ref<{ loadData: () => Promise<void> } | null>(null)
const usersTab = ref<{ loadData: () => Promise<void> } | null>(null)
const groupsTab = ref<{ loadGroups: () => Promise<void> } | null>(null)
const applicationsTab = ref<{ loadApplications: () => Promise<void> } | null>(null)

const adminTabs = computed(() => [
  { value: 'profiles', label: t('admin.tab.profiles'), count: profilesCount.value || undefined },
  { value: 'organizers', label: t('common.organizers') },
  { value: 'users', label: t('admin.tab.users') },
  { value: 'groups', label: t('admin.tab.groups'), count: groupsPendingCount.value || undefined },
  { value: 'applications', label: t('admin.tab.applications'), count: applicationsPendingCount.value || undefined },
])

const isAdmin = computed(() => can('admin.panel'))
const isReady = computed(() => !authLoading.value && user.value !== null)

function onTabChange(tab: string) {
  activeTab.value = tab as AdminTab
}

watch(activeTab, (tab) => {
  nextTick(() => {
    if (tab === 'profiles') profilesTab.value?.loadProfiles()
    if (tab === 'organizers') organizersTab.value?.loadData()
    if (tab === 'users') usersTab.value?.loadData()
    if (tab === 'groups') groupsTab.value?.loadGroups()
    if (tab === 'applications') applicationsTab.value?.loadApplications()
  })
}, { immediate: true })

watch([isReady, isAdmin], ([ready, admin]) => {
  if (ready && !admin) {
    navigateTo(`/${locale.value}/`)
  }
}, { immediate: true })

useHead({
  title: () => t('common.adminPanel'),
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
        {{ t('common.adminPanel') }}
      </h1>

      <UiTabs
        v-model="activeTab"
        :tabs="adminTabs"
        @update:model-value="onTabChange"
      />

      <AdminProfilesTab
        v-if="activeTab === 'profiles'"
        ref="profilesTab"
        v-model:profiles-count="profilesCount"
      />
      <AdminOrganizersTab
        v-else-if="activeTab === 'organizers'"
        ref="organizersTab"
      />
      <AdminUsersTab
        v-else-if="activeTab === 'users'"
        ref="usersTab"
      />
      <AdminGroupsTab
        v-else-if="activeTab === 'groups'"
        ref="groupsTab"
        v-model:pending-count="groupsPendingCount"
      />
      <AdminApplicationsTab
        v-else-if="activeTab === 'applications'"
        ref="applicationsTab"
        v-model:pending-count="applicationsPendingCount"
      />
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
