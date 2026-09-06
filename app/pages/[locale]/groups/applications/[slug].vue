<script setup lang="ts">
import type { Application } from '~~/types'

const { t, locale } = useLocale()
const { user, isLoading: isUserLoading } = useUser()
const { startLoading, finishLoading, forceHide } = usePageLoading()
const route = useRoute()

const slug = route.params.slug as string

const applications = ref<Application[]>([])
const isLoading = ref(true)
const activeFilter = ref('all')
const expandedIds = ref<Set<string>>(new Set())
const updatingId = ref<string | null>(null)

const filters = computed(() => [
  { value: 'all', label: t('groups.applications.filter.all') },
  { value: 'PENDING', label: t('groups.applications.filter.PENDING'), count: pendingCount.value || undefined },
  { value: 'APPROVED', label: t('groups.applications.filter.APPROVED') },
  { value: 'REJECTED', label: t('groups.applications.filter.REJECTED') },
])

const filteredApplications = computed(() => {
  if (activeFilter.value === 'all') return applications.value
  return applications.value.filter(a => a.status === activeFilter.value)
})

const pendingCount = computed(() =>
  applications.value.filter(a => a.status === 'PENDING').length,
)

const statusColors: Record<string, { background: string, color: string }> = {
  PENDING: { background: '#FEF3C7', color: '#92400E' },
  APPROVED: { background: '#D1FAE5', color: '#065F46' },
  REJECTED: { background: '#FEE2E2', color: '#991B1B' },
}

watch(isUserLoading, async (loading) => {
  if (loading) return

  if (!user.value || user.value.role !== 'ORGANIZER') {
    forceHide()
    navigateTo(`/${locale.value}/`)
    return
  }

  startLoading()
  try {
    await loadApplications()
  }
  finally {
    finishLoading()
  }
}, { immediate: true })

async function loadApplications() {
  isLoading.value = true
  try {
    const data = await $fetch<{ applications: Application[] }>(`/api/groups/${slug}/applications`)
    applications.value = data.applications
  }
  catch {
    applications.value = []
  }
  finally {
    isLoading.value = false
  }
}

function toggleExpand(id: string) {
  if (expandedIds.value.has(id)) {
    expandedIds.value.delete(id)
  }
  else {
    expandedIds.value.add(id)
  }
}

async function updateStatus(id: string, status: 'APPROVED' | 'REJECTED') {
  updatingId.value = id
  try {
    await $fetch(`/api/groups/${slug}/applications/${id}`, {
      method: 'PATCH',
      body: { status },
    })
    const app = applications.value.find(a => a.id === id)
    if (app) app.status = status
  }
  catch {
    // Status update failed
  }
  finally {
    updatingId.value = null
  }
}

useHead({
  title: () => t('groups.applications.title'),
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
  ],
})
</script>

<template>
  <div class="applications-page">
    <div class="applications-page__header">
      <NuxtLink
        :to="`/${locale}/groups/my`"
        class="applications-page__back"
      >
        ← {{ t('groups.my.title') }}
      </NuxtLink>
      <h1 class="applications-page__title">
        {{ t('groups.applications.title') }}
      </h1>
      <span
        v-if="pendingCount > 0"
        class="applications-page__pending-badge"
      >
        {{ t('groups.applications.pendingCount', { count: pendingCount }) }}
      </span>
    </div>

    <div
      v-if="isLoading || isUserLoading"
      class="applications-page__status"
    >
      {{ t('common.loading') }}
    </div>

    <template v-else>
      <UiTabs
        v-model="activeFilter"
        :tabs="filters"
      />

      <div
        v-if="filteredApplications.length === 0"
        class="applications-page__empty"
      >
        {{ t('groups.applications.empty') }}
      </div>

      <div
        v-else
        class="applications-page__list"
      >
        <div
          v-for="app in filteredApplications"
          :key="app.id"
          class="application-row"
        >
          <div
            class="application-row__main"
            :class="{ 'application-row__main--expandable': app.answers.length > 0 }"
            @click="app.answers.length > 0 && toggleExpand(app.id)"
          >
            <div class="application-row__info">
              <span class="application-row__name">{{ app.name }}</span>
              <a
                :href="`mailto:${app.email}`"
                class="application-row__email"
                @click.stop
              >{{ app.email }}</a>
              <a
                v-if="app.phone"
                :href="`tel:${app.phone}`"
                class="application-row__phone"
                @click.stop
              >{{ app.phone }}</a>
              <span class="application-row__date">
                {{ formatDate(app.createdAt, locale) }}
              </span>
            </div>

            <div class="application-row__right">
              <UiPill
                :label="t(`applications.my.statuses.${app.status}`)"
                :background="statusColors[app.status]?.background ?? 'var(--color-border)'"
                :color="statusColors[app.status]?.color ?? 'var(--color-text-muted)'"
              />

              <div
                v-if="app.status === 'PENDING'"
                class="application-row__actions"
              >
                <UiButton
                  variant="secondary"
                  size="sm"
                  class="application-row__action-btn application-row__action-btn--approve"
                  :disabled="updatingId === app.id"
                  @click.stop="updateStatus(app.id, 'APPROVED')"
                >
                  {{ t('groups.applications.approve') }}
                </UiButton>
                <UiButton
                  variant="danger"
                  size="sm"
                  class="application-row__action-btn application-row__action-btn--reject"
                  :disabled="updatingId === app.id"
                  @click.stop="updateStatus(app.id, 'REJECTED')"
                >
                  {{ t('groups.applications.reject') }}
                </UiButton>
              </div>

              <div
                v-if="app.answers.length > 0"
                class="application-row__chevron"
              >
                <UiIcon
                  name="chevron-down"
                  :size="20"
                  class="application-row__chevron-icon"
                  :class="{ 'application-row__chevron-icon--expanded': expandedIds.has(app.id) }"
                />
              </div>
            </div>
          </div>

          <div
            v-if="expandedIds.has(app.id) && app.answers.length > 0"
            class="application-row__answers"
          >
            <div
              v-for="ans in app.answers"
              :key="ans.questionId"
              class="application-row__answer"
            >
              <dt class="application-row__answer-question">
                {{ ans.question }}
              </dt>
              <dd class="application-row__answer-value">
                {{ ans.value }}
              </dd>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.applications-page {
  max-width: var(--container-width);
  margin: 0 auto;
  padding: var(--spacing-xl) var(--spacing-lg);
}

.applications-page__header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
  flex-wrap: wrap;
}

.applications-page__back {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  text-decoration: none;
}

.applications-page__back:hover {
  color: var(--color-primary);
  text-decoration: none;
}

.applications-page__title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  margin: 0;
  flex: 1;
}

.applications-page__pending-badge {
  padding: var(--spacing-xs) var(--spacing-md);
  background: #FEF3C7;
  color: #92400E;
  border-radius: var(--radius-full);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.applications-page__status {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--color-text-muted);
}

.applications-page__empty {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--color-text-muted);
  font-size: var(--font-size-lg);
}

.applications-page__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.application-row {
  background: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.application-row__main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md) var(--spacing-lg);
  gap: var(--spacing-md);
  transition: background var(--transition-base);
}

.application-row__main--expandable {
  cursor: pointer;
}

.application-row__main--expandable:hover {
  background: var(--color-background);
}

.application-row__info {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
}

.application-row__name {
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.application-row__email {
  font-size: var(--font-size-sm);
  color: var(--color-primary);
}

.application-row__phone {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.application-row__date {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.application-row__right {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-shrink: 0;
}

.application-row__actions {
  display: flex;
  gap: var(--spacing-xs);
}

.application-row__action-btn {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  font-family: var(--font-family-base);
  cursor: pointer;
  transition: all var(--transition-base);
}

.application-row__action-btn--approve {
  color: #065F46;
  border-color: #A7F3D0;
}

.application-row__action-btn--approve:hover:not(:disabled) {
  background: #D1FAE5;
}

.application-row__action-btn--reject {
  color: #991B1B;
  border-color: #FECACA;
}

.application-row__action-btn--reject:hover:not(:disabled) {
  background: #FEE2E2;
}

.application-row__action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.application-row__chevron {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  color: var(--color-text-muted);
  border-radius: var(--radius-full);
  transition: background var(--transition-base), color var(--transition-base);
}

.application-row__main--expandable:hover .application-row__chevron {
  color: var(--color-primary);
}

.application-row__chevron-icon {
  transition: transform var(--transition-base);
}

.application-row__chevron-icon--expanded {
  transform: rotate(180deg);
}

.application-row__answers {
  padding: var(--spacing-md) var(--spacing-lg);
  border-top: var(--border-width) solid var(--color-border);
  background: var(--color-background);
}

.application-row__answer {
  margin-bottom: var(--spacing-sm);
}

.application-row__answer:last-child {
  margin-bottom: 0;
}

.application-row__answer-question {
  font-size: var(--font-size-md);
  color: var(--color-text-muted);
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--spacing-md);
}

.application-row__answer-value {
  font-size: var(--font-size-sm);
  color: var(--color-text);
  margin: 0;
}

@media (max-width: 640px) {
  .application-row__main {
    flex-direction: column;
    align-items: flex-start;
  }

  .application-row__right {
    width: 100%;
    justify-content: space-between;
  }

  .application-row__info {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-xs);
  }
}
</style>
