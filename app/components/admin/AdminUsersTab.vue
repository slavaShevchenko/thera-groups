<script setup lang="ts">
import type { UserRecord } from '~~/types'

const { t, locale } = useLocale()

const ADMIN_PAGE_SIZE = 20

const users = ref<UserRecord[]>([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)

const totalPages = computed(() => Math.ceil(total.value / ADMIN_PAGE_SIZE))

const columns = computed(() => [
  { key: 'email', label: t('common.email') },
  { key: 'role', label: t('common.role') },
  { key: 'isActive', label: t('admin.table.state') },
  { key: 'createdAt', label: t('admin.table.createdAt') },
])

async function loadData() {
  loading.value = true
  try {
    const result = await $fetch<{ items: UserRecord[], total: number }>('/api/admin/users', {
      query: { page: String(page.value), limit: String(ADMIN_PAGE_SIZE) },
    })
    users.value = result.items
    total.value = result.total
  }
  catch {
    // Silent by design: user list load failure shows empty state
  }
  finally {
    loading.value = false
  }
}

function onPageChange(newPage: number) {
  page.value = newPage
  loadData()
}

function roleClass(role: string): string {
  switch (role) {
    case 'ADMIN': return 'admin-users__role--admin'
    case 'ORGANIZER': return 'admin-users__role--organizer'
    default: return 'admin-users__role--visitor'
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
      :rows="users"
      :total="total"
      :page="page"
      :total-pages="totalPages"
      :empty-message="t('admin.empty.users')"
      @update:page="onPageChange"
    >
      <template #cell-role="{ value }">
        <span
          class="admin-users__role"
          :class="roleClass(value as string)"
        >
          {{ t(`users.roles.${value}`) }}
        </span>
      </template>
      <template #cell-isActive="{ value }">
        <span :class="value ? 'admin-users__active' : 'admin-users__inactive'">
          {{ value ? t('admin.state.active') : t('admin.state.inactive') }}
        </span>
      </template>
      <template #cell-createdAt="{ value }">
        {{ formatDate(value as string, locale) }}
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

.admin-users__role {
  display: inline-block;
  padding: 2px var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}

.admin-users__role--admin {
  background: rgba(111, 163, 155, 0.15);
  color: var(--color-primary);
}

.admin-users__role--organizer {
  background: rgba(139, 185, 208, 0.15);
  color: var(--color-text);
}

.admin-users__role--visitor {
  background: var(--color-border);
  color: var(--color-text-muted);
}

.admin-users__active {
  color: var(--color-success);
  font-size: var(--font-size-xs);
}

.admin-users__inactive {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}
</style>
