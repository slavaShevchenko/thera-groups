<script setup lang="ts">
interface UserRecord {
  id: string
  email: string
  role: string
  isActive: boolean
  createdAt: string
}

defineProps<{
  users: UserRecord[]
}>()

const { t } = useLocale()

function roleClass(role: string): string {
  switch (role) {
    case 'ADMIN': return 'users-table__role--admin'
    case 'ORGANIZER': return 'users-table__role--organizer'
    default: return 'users-table__role--visitor'
  }
}
</script>

<template>
  <div class="users-table">
    <div
      v-if="users.length === 0"
      class="users-table__empty"
    >
      {{ t('admin.empty.users') }}
    </div>

    <table
      v-else
      class="users-table__table"
    >
      <thead>
        <tr>
          <th>{{ t('admin.table.email') }}</th>
          <th>{{ t('admin.table.role') }}</th>
          <th>{{ t('admin.table.state') }}</th>
          <th>{{ t('admin.table.createdAt') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="user in users"
          :key="user.id"
        >
          <td>{{ user.email }}</td>
          <td>
            <span
              class="users-table__role"
              :class="roleClass(user.role)"
            >
              {{ user.role }}
            </span>
          </td>
          <td>
            <span :class="user.isActive ? 'users-table__active' : 'users-table__inactive'">
              {{ user.isActive ? t('admin.state.active') : t('admin.state.inactive') }}
            </span>
          </td>
          <td>{{ formatDate(user.createdAt, 'ua') }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.users-table__table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}

.users-table__table th,
.users-table__table td {
  padding: var(--spacing-sm) var(--spacing-md);
  text-align: left;
  border-bottom: var(--border-width) solid var(--color-border);
}

.users-table__table th {
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  background: var(--color-background);
}

.users-table__empty {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--color-text-muted);
}

.users-table__role {
  display: inline-block;
  padding: 2px var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}

.users-table__role--admin {
  background: rgba(111, 163, 155, 0.15);
  color: var(--color-primary);
}

.users-table__role--organizer {
  background: rgba(139, 185, 208, 0.15);
  color: #4a7c8f;
}

.users-table__role--visitor {
  background: var(--color-border);
  color: var(--color-text-muted);
}

.users-table__active {
  color: var(--color-success);
  font-size: var(--font-size-xs);
}

.users-table__inactive {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}
</style>
