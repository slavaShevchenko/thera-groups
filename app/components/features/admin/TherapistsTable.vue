<script setup lang="ts">
interface Therapist {
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
  therapists: Therapist[]
}>()

const emit = defineEmits<{
  'verify': [id: string, updates: { verificationStatus: string }]
  'toggle-active': [id: string, updates: { isActive: boolean }]
}>()

const { t } = useLocale()

const loadingVerify = ref<string | null>(null)
const loadingToggle = ref<string | null>(null)

async function handleVerify(therapist: Therapist) {
  loadingVerify.value = therapist.id
  try {
    await $fetch(`/api/admin/therapists/${therapist.id}/verify`, { method: 'POST' })
    emit('verify', therapist.id, { verificationStatus: 'VERIFIED' })
  }
  catch {
    // ignore
  }
  finally {
    loadingVerify.value = null
  }
}

async function handleToggleActive(therapist: Therapist) {
  loadingToggle.value = therapist.id
  try {
    const response = await $fetch<{ isActive: boolean }>(`/api/admin/therapists/${therapist.id}/toggle-active`, { method: 'POST' })
    emit('toggle-active', therapist.id, { isActive: response.isActive })
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
    case 'VERIFIED': return 'therapists-table__status--verified'
    case 'PENDING': return 'therapists-table__status--pending'
    case 'REJECTED': return 'therapists-table__status--rejected'
    default: return 'therapists-table__status--unverified'
  }
}
</script>

<template>
  <div class="therapists-table">
    <div
      v-if="therapists.length === 0"
      class="therapists-table__empty"
    >
      {{ t('admin.empty.therapists') }}
    </div>

    <table
      v-else
      class="therapists-table__table"
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
          v-for="therapist in therapists"
          :key="therapist.id"
        >
          <td>{{ therapist.firstName }} {{ therapist.lastName }}</td>
          <td>{{ therapist.email }}</td>
          <td>{{ therapist.groupsCount }}</td>
          <td>
            <span
              class="therapists-table__status"
              :class="statusClass(therapist.verificationStatus)"
            >
              {{ t(`admin.status.${therapist.verificationStatus}`) }}
            </span>
          </td>
          <td>
            <span
              class="therapists-table__state"
              :class="therapist.isActive ? 'therapists-table__state--active' : 'therapists-table__state--inactive'"
            >
              {{ therapist.isActive ? t('admin.state.active') : t('admin.state.inactive') }}
            </span>
          </td>
          <td class="therapists-table__actions">
            <button
              v-if="therapist.verificationStatus === 'PENDING'"
              type="button"
              class="therapists-table__btn therapists-table__btn--verify"
              :disabled="loadingVerify === therapist.id"
              @click="handleVerify(therapist)"
            >
              {{ loadingVerify === therapist.id ? '...' : t('admin.action.verify') }}
            </button>
            <button
              type="button"
              class="therapists-table__btn"
              :class="therapist.isActive ? 'therapists-table__btn--deactivate' : 'therapists-table__btn--activate'"
              :disabled="loadingToggle === therapist.id"
              @click="handleToggleActive(therapist)"
            >
              {{ loadingToggle === therapist.id ? '...' : (therapist.isActive ? t('admin.action.deactivate') : t('admin.action.activate')) }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.therapists-table__table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}

.therapists-table__table th,
.therapists-table__table td {
  padding: var(--spacing-sm) var(--spacing-md);
  text-align: left;
  border-bottom: var(--border-width) solid var(--color-border);
}

.therapists-table__table th {
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  background: var(--color-background);
}

.therapists-table__empty {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--color-text-muted);
}

.therapists-table__status {
  display: inline-block;
  padding: 2px var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}

.therapists-table__status--verified {
  background: rgba(92, 184, 92, 0.15);
  color: #2d7a2d;
}

.therapists-table__status--pending {
  background: rgba(240, 173, 78, 0.15);
  color: #8a6d3b;
}

.therapists-table__status--rejected {
  background: rgba(217, 83, 79, 0.15);
  color: #a94442;
}

.therapists-table__status--unverified {
  background: var(--color-border);
  color: var(--color-text-muted);
}

.therapists-table__state {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}

.therapists-table__state--active {
  color: var(--color-success);
}

.therapists-table__state--inactive {
  color: var(--color-text-muted);
}

.therapists-table__actions {
  display: flex;
  gap: var(--spacing-xs);
}

.therapists-table__btn {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  font-size: var(--font-size-xs);
  font-family: var(--font-family-base);
  cursor: pointer;
  transition: all var(--transition-base);
}

.therapists-table__btn:hover:not(:disabled) {
  border-color: var(--color-primary);
}

.therapists-table__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.therapists-table__btn--verify {
  color: var(--color-success);
  border-color: var(--color-success);
}

.therapists-table__btn--deactivate {
  color: var(--color-error);
}

.therapists-table__btn--activate {
  color: var(--color-success);
}
</style>
