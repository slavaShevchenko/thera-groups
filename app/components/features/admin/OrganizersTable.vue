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

defineProps<{
  organizers: Organizer[]
}>()

const emit = defineEmits<{
  'verify': [id: string, updates: { verificationStatus: string }]
  'toggle-active': [id: string, updates: { isActive: boolean }]
}>()

const { t } = useLocale()

const loadingVerify = ref<string | null>(null)
const loadingToggle = ref<string | null>(null)

async function handleVerify(organizer: Organizer) {
  loadingVerify.value = organizer.id
  try {
    await $fetch(`/api/admin/organizers/${organizer.id}/verify`, { method: 'POST' })
    emit('verify', organizer.id, { verificationStatus: 'VERIFIED' })
  }
  catch {
    // ignore
  }
  finally {
    loadingVerify.value = null
  }
}

async function handleToggleActive(organizer: Organizer) {
  loadingToggle.value = organizer.id
  try {
    const response = await $fetch<{ isActive: boolean }>(`/api/admin/organizers/${organizer.id}/toggle-active`, { method: 'POST' })
    emit('toggle-active', organizer.id, { isActive: response.isActive })
  }
  catch {
    // ignore
  }
  finally {
    loadingToggle.value = null
  }
}

function statusClass(status: string): string {
  switch (status) {
    case 'VERIFIED': return 'organizers-table__status--verified'
    case 'PENDING': return 'organizers-table__status--pending'
    case 'REJECTED': return 'organizers-table__status--rejected'
    default: return 'organizers-table__status--unverified'
  }
}
</script>

<template>
  <div class="organizers-table">
    <div
      v-if="organizers.length === 0"
      class="organizers-table__empty"
    >
      {{ t('admin.empty.organizers') }}
    </div>

    <table
      v-else
      class="organizers-table__table"
    >
      <thead>
        <tr>
          <th>{{ t('admin.table.name') }}</th>
          <th>{{ t('admin.table.email') }}</th>
          <th>{{ t('admin.table.groups') }}</th>
          <th>{{ t('admin.table.status') }}</th>
          <th>{{ t('admin.table.state') }}</th>
          <th>{{ t('admin.table.actions') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="organizer in organizers"
          :key="organizer.id"
        >
          <td>{{ organizer.firstName }} {{ organizer.lastName }}</td>
          <td>{{ organizer.email }}</td>
          <td>{{ organizer.groupsCount }}</td>
          <td>
            <span
              class="organizers-table__status"
              :class="statusClass(organizer.verificationStatus)"
            >
              {{ t(`admin.status.${organizer.verificationStatus}`) }}
            </span>
          </td>
          <td>
            <span
              class="organizers-table__state"
              :class="organizer.isActive ? 'organizers-table__state--active' : 'organizers-table__state--inactive'"
            >
              {{ organizer.isActive ? t('admin.state.active') : t('admin.state.inactive') }}
            </span>
          </td>
          <td class="organizers-table__actions">
            <UiButton
              v-if="organizer.verificationStatus === 'PENDING'"
              variant="secondary"
              size="sm"
              class="organizers-table__btn organizers-table__btn--verify"
              :disabled="loadingVerify === organizer.id"
              @click="handleVerify(organizer)"
            >
              {{ loadingVerify === organizer.id ? '...' : t('admin.action.verify') }}
            </UiButton>
            <UiButton
              variant="secondary"
              size="sm"
              class="organizers-table__btn"
              :class="organizer.isActive ? 'organizers-table__btn--deactivate' : 'organizers-table__btn--activate'"
              :disabled="loadingToggle === organizer.id"
              @click="handleToggleActive(organizer)"
            >
              {{ loadingToggle === organizer.id ? '...' : (organizer.isActive ? t('admin.action.deactivate') : t('admin.action.activate')) }}
            </UiButton>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.organizers-table__table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}

.organizers-table__table th,
.organizers-table__table td {
  padding: var(--spacing-sm) var(--spacing-md);
  text-align: left;
  border-bottom: var(--border-width) solid var(--color-border);
}

.organizers-table__table th {
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  background: var(--color-background);
}

.organizers-table__empty {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--color-text-muted);
}

.organizers-table__status {
  display: inline-block;
  padding: 2px var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}

.organizers-table__status--verified {
  background: rgba(92, 184, 92, 0.15);
  color: #2d7a2d;
}

.organizers-table__status--pending {
  background: rgba(240, 173, 78, 0.15);
  color: #8a6d3b;
}

.organizers-table__status--rejected {
  background: rgba(217, 83, 79, 0.15);
  color: #a94442;
}

.organizers-table__status--unverified {
  background: var(--color-border);
  color: var(--color-text-muted);
}

.organizers-table__state {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}

.organizers-table__state--active {
  color: var(--color-success);
}

.organizers-table__state--inactive {
  color: var(--color-text-muted);
}

.organizers-table__actions {
  display: flex;
  gap: var(--spacing-xs);
}

.organizers-table__btn {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  font-size: var(--font-size-xs);
  font-family: var(--font-family-base);
  cursor: pointer;
  transition: all var(--transition-base);
}

.organizers-table__btn:hover:not(:disabled) {
  border-color: var(--color-primary);
}

.organizers-table__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.organizers-table__btn--verify {
  color: var(--color-success);
  border-color: var(--color-success);
}

.organizers-table__btn--deactivate {
  color: var(--color-error);
}

.organizers-table__btn--activate {
  color: var(--color-success);
}
</style>
