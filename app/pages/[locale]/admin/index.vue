<script setup lang="ts">
import type { AdminTab } from '~/components/admin/types'

const { t } = useLocale()

type AdminTabName = 'profiles' | 'organizers' | 'users' | 'groups' | 'applications'

const activeTab = ref<AdminTabName>('profiles')

const profilesCount = ref(0)
const groupsPendingCount = ref(0)
const applicationsPendingCount = ref(0)

const profilesTab = ref<AdminTab | null>(null)
const organizersTab = ref<AdminTab | null>(null)
const usersTab = ref<AdminTab | null>(null)
const groupsTab = ref<AdminTab | null>(null)
const applicationsTab = ref<AdminTab | null>(null)

const tabs: Record<AdminTabName, Ref<AdminTab | null>> = {
  profiles: profilesTab,
  organizers: organizersTab,
  users: usersTab,
  groups: groupsTab,
  applications: applicationsTab,
}

const adminTabs = computed(() => [
  { value: 'profiles', label: t('admin.tab.profiles'), count: profilesCount.value || undefined },
  { value: 'organizers', label: t('common.organizers') },
  { value: 'users', label: t('admin.tab.users') },
  { value: 'groups', label: t('admin.tab.groups'), count: groupsPendingCount.value || undefined },
  { value: 'applications', label: t('admin.tab.applications'), count: applicationsPendingCount.value || undefined },
])

// Access to /admin is enforced by app/middleware/auth.global.ts, which turns away
// anonymous visitors and redirects anyone whose role is not ADMIN.
watch(activeTab, (tab) => {
  nextTick(() => {
    tabs[tab]?.value?.load()
  })
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
    <h1 class="admin-page__title">
      {{ t('common.adminPanel') }}
    </h1>

    <UiTabs
      v-model="activeTab"
      :tabs="adminTabs"
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
</style>
