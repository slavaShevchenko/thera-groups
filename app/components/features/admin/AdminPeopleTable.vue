<script setup lang="ts" generic="T extends Record<string, unknown>">
defineProps<{
  columns: { key: string, label: string }[]
  rows: T[]
  total: number
  page: number
  totalPages: number
  emptyMessage?: string
}>()

const emit = defineEmits<{
  'update:page': [page: number]
}>()

const { t } = useLocale()
</script>

<template>
  <div class="admin-people-table">
    <div
      v-if="rows.length === 0"
      class="admin-people-table__empty"
    >
      {{ emptyMessage || t('admin.empty.users') }}
    </div>

    <div
      v-else
      class="admin-people-table__wrapper"
    >
      <table class="admin-people-table__table">
        <thead>
          <tr>
            <th
              v-for="col in columns"
              :key="col.key"
            >
              {{ col.label }}
            </th>
            <th
              v-if="$slots.actions"
              class="admin-people-table__actions-header"
            >
              {{ t('admin.table.actions') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, index) in rows"
            :key="index"
          >
            <td
              v-for="col in columns"
              :key="col.key"
            >
              <slot
                :name="`cell-${col.key}`"
                :row="row"
                :value="row[col.key]"
              >
                {{ row[col.key] }}
              </slot>
            </td>
            <td
              v-if="$slots.actions"
              class="admin-people-table__actions"
            >
              <slot
                name="actions"
                :row="row"
              ></slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div
      v-if="totalPages > 1"
      class="admin-people-table__pagination"
    >
      <UiButton
        variant="secondary"
        size="sm"
        :disabled="page <= 1"
        :aria-label="t('pagination.previous')"
        @click="emit('update:page', page - 1)"
      >
        <span aria-hidden="true">←</span>
      </UiButton>
      <span class="admin-people-table__page-info">
        {{ page }} / {{ totalPages }}
      </span>
      <UiButton
        variant="secondary"
        size="sm"
        :disabled="page >= totalPages"
        :aria-label="t('pagination.next')"
        @click="emit('update:page', page + 1)"
      >
        <span aria-hidden="true">→</span>
      </UiButton>
    </div>
  </div>
</template>

<style scoped>
.admin-people-table__wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.admin-people-table__table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
  min-width: 500px;
}

.admin-people-table__table th,
.admin-people-table__table td {
  padding: var(--spacing-sm) var(--spacing-md);
  text-align: left;
  border-bottom: var(--border-width) solid var(--color-border);
  white-space: nowrap;
}

.admin-people-table__table th {
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  background: var(--color-background);
}

.admin-people-table__actions-header {
  text-align: right;
}

.admin-people-table__actions {
  display: flex;
  gap: var(--spacing-xs);
  justify-content: flex-end;
}

.admin-people-table__empty {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--color-text-muted);
}

.admin-people-table__pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-md);
}

.admin-people-table__page-info {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}
</style>
