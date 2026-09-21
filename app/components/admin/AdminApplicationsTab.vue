<script setup lang="ts">
import type { AdminApplication, ApplicationStats } from '~~/types'
import { INTL_LOCALES } from '~~/shared/constants/locales'

const { t, locale } = useLocale()

const pendingCount = defineModel<number>('pendingCount', { default: 0 })

const applications = ref<AdminApplication[]>([])
const stats = ref<ApplicationStats>({ total: 0, today: 0, week: 0, pending: 0, approved: 0, rejected: 0, withdrawn: 0 })
const loading = ref(false)
const loaded = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const statusFilter = ref('ALL')
const groupFilter = ref('')
const detailOpen = ref(false)
const detail = ref<AdminApplication | null>(null)

const totalPages = computed(() => Math.ceil(total.value / pageSize.value))

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return t('admin.applications.justNow')
  if (diffMin < 60) return `${diffMin} ${t('admin.applications.minAgo')}`
  if (diffHr < 24) return `${diffHr} ${t('admin.applications.hrAgo')}`
  if (diffDay < 7) return `${diffDay} ${t('admin.applications.dayAgo')}`
  return date.toLocaleDateString(INTL_LOCALES[locale.value] ?? locale.value)
}

async function loadApplications() {
  loading.value = true
  try {
    const params: Record<string, string> = {
      page: String(page.value),
      pageSize: String(pageSize.value),
    }
    if (statusFilter.value !== 'ALL') {
      params.status = statusFilter.value
    }
    if (groupFilter.value) {
      params.groupId = groupFilter.value
    }

    const data = await $fetch<{
      applications: AdminApplication[]
      total: number
      stats: ApplicationStats
    }>('/api/admin/applications', { query: params })

    applications.value = data.applications
    total.value = data.total
    stats.value = data.stats
    pendingCount.value = data.stats.pending
    loaded.value = true
  }
  catch {
    // Silent by design: application action failure, state unchanged
  }
  finally {
    loading.value = false
  }
}

function openDetail(app: AdminApplication) {
  detail.value = app
  detailOpen.value = true
}

watch([statusFilter, groupFilter], () => {
  page.value = 1
  loadApplications()
})

defineExpose({ load: loadApplications })
</script>

<template>
  <div class="admin-applications">
    <div class="admin-applications__stats">
      <div class="admin-applications__stat">
        <span class="admin-applications__stat-value">{{ stats.total }}</span>
        <span class="admin-applications__stat-label">{{ t('admin.applications.total') }}</span>
      </div>
      <div class="admin-applications__stat">
        <span class="admin-applications__stat-value">{{ stats.today }}</span>
        <span class="admin-applications__stat-label">{{ t('admin.applications.today') }}</span>
      </div>
      <div class="admin-applications__stat">
        <span class="admin-applications__stat-value">{{ stats.week }}</span>
        <span class="admin-applications__stat-label">{{ t('admin.applications.week') }}</span>
      </div>
      <div class="admin-applications__stat admin-applications__stat--pending">
        <span class="admin-applications__stat-value">{{ stats.pending }}</span>
        <span class="admin-applications__stat-label">{{ t('admin.applications.pending') }}</span>
      </div>
      <div class="admin-applications__stat admin-applications__stat--approved">
        <span class="admin-applications__stat-value">{{ stats.approved }}</span>
        <span class="admin-applications__stat-label">{{ t('admin.applications.approved') }}</span>
      </div>
      <div class="admin-applications__stat admin-applications__stat--rejected">
        <span class="admin-applications__stat-value">{{ stats.rejected }}</span>
        <span class="admin-applications__stat-label">{{ t('admin.applications.rejected') }}</span>
      </div>
    </div>

    <div class="admin-applications__filters">
      <select
        v-model="statusFilter"
        class="admin-applications__filter-select"
        :aria-label="t('admin.applications.allStatuses')"
      >
        <option value="ALL">
          {{ t('admin.applications.allStatuses') }}
        </option>
        <option value="PENDING">
          {{ t('admin.applications.pending') }}
        </option>
        <option value="APPROVED">
          {{ t('admin.applications.approved') }}
        </option>
        <option value="REJECTED">
          {{ t('admin.applications.rejected') }}
        </option>
        <option value="WITHDRAWN">
          {{ t('admin.applications.withdrawn') }}
        </option>
      </select>
      <input
        v-model="groupFilter"
        type="text"
        :placeholder="t('admin.applications.filterByGroup')"
        :aria-label="t('admin.applications.filterByGroup')"
        class="admin-applications__filter-input"
      />
    </div>

    <div
      v-if="loading"
      class="admin-applications__loading"
    >
      {{ t('common.loading') }}
    </div>

    <div
      v-else-if="applications.length === 0"
      class="admin-applications__empty"
    >
      {{ t('admin.applications.empty') }}
    </div>

    <table
      v-else
      class="admin-applications__table"
    >
      <thead>
        <tr>
          <th>{{ t('common.date') }}</th>
          <th>{{ t('admin.applications.group') }}</th>
          <th>{{ t('admin.applications.applicant') }}</th>
          <th>{{ t('common.status') }}</th>
          <th>{{ t('admin.applications.preview') }}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="app in applications"
          :key="app.id"
        >
          <td class="admin-applications__date">
            {{ formatDate(app.createdAt) }}
          </td>
          <td>
            <NuxtLink
              :to="`/${locale}/groups/${app.group.slug}`"
              class="admin-applications__group-link"
            >
              {{ app.group.title }}
            </NuxtLink>
          </td>
          <td>
            <div class="admin-applications__applicant-name">
              {{ app.name }}
            </div>
            <div class="admin-applications__applicant-email">
              {{ app.email }}
            </div>
          </td>
          <td>
            <span
              class="admin-applications__badge"
              :class="`admin-applications__badge--${app.status.toLowerCase()}`"
            >
              {{ t(`applications.my.statuses.${app.status}`) }}
            </span>
          </td>
          <td class="admin-applications__preview">
            {{ (app.message || '').slice(0, 50) }}{{ (app.message || '').length > 50 ? '…' : '' }}
          </td>
          <td>
            <UiButton
              variant="secondary"
              size="sm"
              @click="openDetail(app)"
            >
              {{ t('admin.applications.details') }}
            </UiButton>
          </td>
        </tr>
      </tbody>
    </table>

    <div
      v-if="totalPages > 1"
      class="admin-applications__pagination"
    >
      <UiButton
        variant="secondary"
        size="sm"
        :disabled="page <= 1"
        :aria-label="t('pagination.previous')"
        @click="page--; loadApplications()"
      >
        <span aria-hidden="true">←</span>
      </UiButton>
      <span class="admin-applications__page-info">
        {{ page }} / {{ totalPages }}
      </span>
      <UiButton
        variant="secondary"
        size="sm"
        :disabled="page >= totalPages"
        :aria-label="t('pagination.next')"
        @click="page++; loadApplications()"
      >
        <span aria-hidden="true">→</span>
      </UiButton>
    </div>

    <UiModal
      v-model="detailOpen"
      :title="t('admin.applications.detailsTitle')"
    >
      <div
        v-if="detail"
        class="admin-app-detail"
      >
        <dl class="admin-app-detail__info">
          <div class="admin-app-detail__row">
            <dt>{{ t('admin.applications.applicant') }}</dt>
            <dd>{{ detail.name }}</dd>
          </div>
          <div class="admin-app-detail__row">
            <dt>{{ t('common.email') }}</dt>
            <dd>{{ detail.email }}</dd>
          </div>
          <div
            v-if="detail.phone"
            class="admin-app-detail__row"
          >
            <dt>{{ t('common.phone') }}</dt>
            <dd>{{ detail.phone }}</dd>
          </div>
          <div class="admin-app-detail__row">
            <dt>{{ t('admin.applications.group') }}</dt>
            <dd>
              <NuxtLink
                :to="`/${locale}/groups/${detail.group.slug}`"
                class="admin-applications__group-link"
              >
                {{ detail.group.title }}
              </NuxtLink>
            </dd>
          </div>
          <div class="admin-app-detail__row">
            <dt>{{ t('common.status') }}</dt>
            <dd>
              <span
                class="admin-applications__badge"
                :class="`admin-applications__badge--${detail.status.toLowerCase()}`"
              >
                {{ t(`applications.my.statuses.${detail.status}`) }}
              </span>
            </dd>
          </div>
          <div class="admin-app-detail__row">
            <dt>{{ t('common.date') }}</dt>
            <dd>{{ new Date(detail.createdAt).toLocaleString(INTL_LOCALES[locale] ?? locale) }}</dd>
          </div>
        </dl>

        <div
          v-if="detail.message"
          class="admin-app-detail__section"
        >
          <h3>{{ t('admin.applications.message') }}</h3>
          <p class="admin-app-detail__message">
            {{ detail.message }}
          </p>
        </div>

        <div
          v-if="detail.answers.length > 0"
          class="admin-app-detail__section"
        >
          <h3>{{ t('admin.applications.answers') }}</h3>
          <dl class="admin-app-detail__answers">
            <div
              v-for="(ans, i) in detail.answers"
              :key="i"
              class="admin-app-detail__answer"
            >
              <dt>{{ ans.question }}</dt>
              <dd>{{ ans.value }}</dd>
            </div>
          </dl>
        </div>
      </div>
    </UiModal>
  </div>
</template>

<style scoped>
.admin-applications__stats {
  display: flex;
  gap: var(--spacing-md);
  flex-wrap: wrap;
  margin-bottom: var(--spacing-lg);
}

.admin-applications__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  min-width: 80px;
}

.admin-applications__stat-value {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
}

.admin-applications__stat-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.admin-applications__stat--pending .admin-applications__stat-value { color: var(--color-pending-verification); }
.admin-applications__stat--approved .admin-applications__stat-value { color: var(--color-verified); }
.admin-applications__stat--rejected .admin-applications__stat-value { color: var(--color-status-error-text); }

.admin-applications__filters {
  display: flex;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-lg);
}

.admin-applications__filter-select,
.admin-applications__filter-input {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
}

.admin-applications__table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}

.admin-applications__table th {
  text-align: left;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-bottom: 2px solid var(--color-border);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-muted);
}

.admin-applications__table td {
  padding: var(--spacing-sm);
  border-bottom: var(--border-width) solid var(--color-border);
  vertical-align: middle;
}

.admin-applications__date {
  white-space: nowrap;
  color: var(--color-text-muted);
}

.admin-applications__group-link {
  color: var(--color-primary);
  text-decoration: none;
}

.admin-applications__group-link:hover {
  text-decoration: underline;
}

.admin-applications__applicant-name {
  margin-bottom: var(--spacing-xs);
  font-weight: var(--font-weight-medium);
}

.admin-applications__applicant-email {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.admin-applications__badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}

.admin-applications__badge--pending { background: var(--color-status-warning-bg); color: var(--color-status-warning-text); }
.admin-applications__badge--approved { background: var(--color-status-success-bg); color: var(--color-status-success-text); }
.admin-applications__badge--rejected { background: var(--color-status-error-bg); color: var(--color-status-error-text); }
.admin-applications__badge--withdrawn { background: var(--color-status-pending-bg); color: var(--color-status-pending-text); }

.admin-applications__preview {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-text-muted);
}

.admin-applications__pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-lg);
}

.admin-applications__page-info {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.admin-applications__loading,
.admin-applications__empty {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--color-text-muted);
}

.admin-app-detail__info {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--spacing-xs) var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.admin-app-detail__row dt {
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
}

.admin-app-detail__section {
  margin-top: var(--spacing-md);
}

.admin-app-detail__section h4 {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  margin: 0 0 var(--spacing-xs);
}

.admin-app-detail__message {
  background: var(--color-background);
  padding: var(--spacing-sm);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  margin: 0;
}

.admin-app-detail__answers {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.admin-app-detail__answer dt {
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-sm);
}

.admin-app-detail__answer dd {
  margin: 0 0 var(--spacing-xs);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}
</style>
