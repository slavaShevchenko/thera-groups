<script setup lang="ts">
import type { AdminOrganizer } from '~~/types'

const { t, locale } = useLocale()
const { can } = usePermissions()

const ADMIN_PAGE_SIZE = 20

const organizers = ref<AdminOrganizer[]>([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const loadError = ref(false)
const actionError = ref('')

const totalPages = computed(() => Math.ceil(total.value / ADMIN_PAGE_SIZE))

const columns = computed(() => [
  { key: 'name', label: t('common.name') },
  { key: 'email', label: t('common.email') },
  { key: 'groupsCount', label: t('admin.table.groups') },
  { key: 'verificationStatus', label: t('common.status') },
  { key: 'isActive', label: t('admin.table.state') },
])

const loadingVerify = ref<string | null>(null)
const loadingToggle = ref<string | null>(null)

async function loadData() {
  loading.value = true
  loadError.value = false
  try {
    const result = await $fetch<{ items: AdminOrganizer[], total: number }>('/api/admin/organizers', {
      query: { page: String(page.value), limit: String(ADMIN_PAGE_SIZE) },
    })
    organizers.value = result.items
    total.value = result.total
  }
  catch {
    loadError.value = true
  }
  finally {
    loading.value = false
  }
}

function onPageChange(newPage: number) {
  page.value = newPage
  loadData()
}

async function handleVerify(organizer: AdminOrganizer) {
  loadingVerify.value = organizer.id
  actionError.value = ''
  try {
    await $fetch(`/api/admin/organizer-profiles/${organizer.id}`, {
      method: 'PATCH',
      body: { verificationStatus: 'VERIFIED' },
    })
    updateOrganizer(organizer.id, { verificationStatus: 'VERIFIED' })
  }
  catch {
    actionError.value = t('common.errors.actionFailed')
  }
  finally {
    loadingVerify.value = null
  }
}

async function handleToggleActive(organizer: AdminOrganizer) {
  loadingToggle.value = organizer.id
  actionError.value = ''
  try {
    const response = await $fetch<{ isActive: boolean }>(`/api/admin/organizers/${organizer.id}/toggle-active`, { method: 'PATCH' })
    updateOrganizer(organizer.id, { isActive: response.isActive })
  }
  catch {
    actionError.value = t('common.errors.actionFailed')
  }
  finally {
    loadingToggle.value = null
  }
}

function updateOrganizer(id: string, updates: Partial<AdminOrganizer>) {
  const index = organizers.value.findIndex(o => o.id === id)
  if (index !== -1) {
    const target = organizers.value[index]
    if (target) Object.assign(target, updates)
  }
}

function statusClass(status: string): string {
  switch (status) {
    case 'VERIFIED': return 'admin-org__status--verified'
    case 'PENDING': return 'admin-org__status--pending'
    case 'REJECTED': return 'admin-org__status--rejected'
    default: return 'admin-org__status--unverified'
  }
}

// The tab is mounted fresh every time it is selected (the parent renders it with v-if),
// so this is what fills it on a hard load of /admin as well as on a tab switch.
onMounted(loadData)
</script>

<template>
  <div class="admin-paginated-section">
    <div
      v-if="loading"
      class="admin-tab-loader"
    >
      <div class="admin-tab-loader__spinner"></div>
    </div>

    <div
      v-else-if="loadError"
      class="admin-org__error"
    >
      <p>{{ t('errors.failedToLoad') }}</p>
      <UiButton
        variant="secondary"
        size="sm"
        @click="loadData"
      >
        {{ t('common.retry') }}
      </UiButton>
    </div>

    <div
      v-if="actionError"
      class="admin-org__action-error"
      role="status"
    >
      {{ actionError }}
    </div>

    <AdminPeopleTable
      v-else
      :columns="columns"
      :rows="organizers"
      :total="total"
      :page="page"
      :total-pages="totalPages"
      :empty-message="t('admin.empty.organizers')"
      @update:page="onPageChange"
    >
      <template #cell-name="{ row }">
        <a
          :href="`/${locale}/organizers/${row.slug}`"
          class="admin-org__name-link"
          target="_blank"
          rel="noopener"
        >
          {{ row.firstName }} {{ row.lastName }}
        </a>
      </template>
      <template #cell-verificationStatus="{ value }">
        <span
          class="admin-org__status"
          :class="statusClass(value as string)"
        >
          {{ t(`admin.status.${value}`) }}
        </span>
      </template>
      <template #cell-isActive="{ value }">
        <span :class="value ? 'admin-org__active' : 'admin-org__inactive'">
          {{ value ? t('admin.state.active') : t('admin.state.inactive') }}
        </span>
      </template>
      <template #actions="{ row }">
        <UiButton
          v-if="row.verificationStatus === 'PENDING' && can('admin.organizers.moderate')"
          variant="secondary"
          size="sm"
          :disabled="loadingVerify === row.id"
          @click="handleVerify(row as AdminOrganizer)"
        >
          {{ loadingVerify === row.id ? '...' : t('admin.action.verify') }}
        </UiButton>
        <UiButton
          v-if="can('admin.organizers.moderate')"
          variant="secondary"
          size="sm"
          :class="row.isActive ? 'admin-org__btn--deactivate' : 'admin-org__btn--activate'"
          :disabled="loadingToggle === row.id"
          @click="handleToggleActive(row as AdminOrganizer)"
        >
          {{ loadingToggle === row.id ? '...' : (row.isActive ? t('admin.action.deactivate') : t('admin.action.activate')) }}
        </UiButton>
      </template>
    </AdminPeopleTable>
  </div>
</template>

<style scoped>
.admin-paginated-section {
  display: flex;
  flex-direction: column;
}

.admin-tab-loader {
  display: flex;
  justify-content: center;
  padding: var(--spacing-2xl);
}

.admin-tab-loader__spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: var(--radius-full);
  animation: spin 0.8s linear infinite;
}

.admin-org__status { display: inline-block; padding: 2px var(--spacing-sm); border-radius: var(--radius-sm); font-size: var(--font-size-xs); font-weight: var(--font-weight-medium); }
.admin-org__status--verified { background: var(--color-success-bg-soft); color: var(--color-verified); }
.admin-org__status--pending { background: rgba(240, 173, 78, 0.15); color: var(--color-pending-verification); }
.admin-org__status--rejected { background: var(--color-error-bg-badge); color: var(--color-status-error-text); }
.admin-org__status--unverified { background: var(--color-border); color: var(--color-text-muted); }
.admin-org__active { color: var(--color-success); font-size: var(--font-size-xs); }
.admin-org__inactive { color: var(--color-text-muted); font-size: var(--font-size-xs); }
.admin-org__btn--deactivate { color: var(--color-error); }
.admin-org__btn--activate { color: var(--color-success); }

.admin-org__error {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--color-error-text);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
}

.admin-org__action-error {
  background: var(--color-error-bg-soft);
  color: var(--color-error-text);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  margin-bottom: var(--spacing-md);
}
</style>
