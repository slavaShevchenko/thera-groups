<script setup lang="ts">
import type { UserRecord } from '~~/types'

const ADMIN_PAGE_SIZE = 20

const users = ref<UserRecord[]>([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)

const totalPages = computed(() => Math.ceil(total.value / ADMIN_PAGE_SIZE))

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

async function goToPage(newPage: number) {
  page.value = newPage
  await loadData()
}

defineExpose({ loadData, loading })
</script>

<template>
  <div class="admin-paginated-section">
    <div
      v-if="loading"
      class="admin-tab-loader"
    >
      <div class="admin-tab-loader__spinner"></div>
    </div>
    <template v-else>
      <UsersTable :users="users" />
      <div
        v-if="totalPages > 1"
        class="admin-pagination"
      >
        <UiButton
          variant="secondary"
          size="sm"
          :disabled="page <= 1"
          :aria-label="t('pagination.previous')"
          @click="goToPage(page - 1)"
        >
          <span aria-hidden="true">←</span>
        </UiButton>
        <span class="admin-pagination__info">
          {{ page }} / {{ totalPages }}
        </span>
        <UiButton
          variant="secondary"
          size="sm"
          :disabled="page >= totalPages"
          :aria-label="t('pagination.next')"
          @click="goToPage(page + 1)"
        >
          <span aria-hidden="true">→</span>
        </UiButton>
      </div>
    </template>
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

@keyframes spin {
  to { transform: rotate(360deg); }
}

.admin-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-md);
}

.admin-pagination__info {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}
</style>
