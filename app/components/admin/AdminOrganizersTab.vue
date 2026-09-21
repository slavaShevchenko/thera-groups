<script setup lang="ts">
import type { AdminOrganizer } from '~~/types'

const { t, locale } = useLocale()

const ADMIN_PAGE_SIZE = 20

const organizers = ref<AdminOrganizer[]>([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)

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
  try {
    const result = await $fetch<{ items: AdminOrganizer[], total: number }>('/api/admin/organizers', {
      query: { page: String(page.value), limit: String(ADMIN_PAGE_SIZE) },
    })
    organizers.value = result.items
    total.value = result.total
  }
  catch {
    // Silent by design: organizer list load failure shows empty state
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
  try {
    await $fetch(`/api/admin/organizers/${organizer.id}/verify`, { method: 'PATCH' })
    updateOrganizer(organizer.id, { verificationStatus: 'VERIFIED' })
  }
  catch {
    // Silent by design
  }
  finally {
    loadingVerify.value = null
  }
}

async function handleToggleActive(organizer: AdminOrganizer) {
  loadingToggle.value = organizer.id
  try {
    const response = await $fetch<{ isActive: boolean }>(`/api/admin/organizers/${organizer.id}/toggle-active`, { method: 'PATCH' })
    updateOrganizer(organizer.id, { isActive: response.isActive })
  }
  catch {
    // Silent by design
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

defineExpose({ load: loadData })
</script>

<template>
  <div class="admin-paginated-section">
    <div
      v-if="loading"
      class="admin-tab-loader"
    >
      <div class="admin-tab-loader__spinner"></div>
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
          v-if="row.verificationStatus === 'PENDING'"
          variant="secondary"
          size="sm"
          :disabled="loadingVerify === row.id"
          @click="handleVerify(row as AdminOrganizer)"
        >
          {{ loadingVerify === row.id ? '...' : t('admin.action.verify') }}
        </UiButton>
        <UiButton
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
</style>
