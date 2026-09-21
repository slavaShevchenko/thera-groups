<script setup lang="ts">
import type { MyGroup } from '~~/types'
import { GROUP_STATUS_COLORS } from '~~/shared/constants/statusColors'

const { t, locale } = useLocale()
const { user, isLoading: isUserLoading } = useUser()
const { startLoading, finishLoading, forceHide } = usePageLoading()

function onViewGroup() {
  setBackTo('my')
}

const ownedGroups = ref<MyGroup[]>([])
const coOrganizedGroups = ref<MyGroup[]>([])
const isLoading = ref(true)
const deletingSlug = ref<string | null>(null)
const deleteTargetSlug = ref<string | null>(null)

const statusColors: Record<string, { background: string, color: string }> = {
  DRAFT: { background: 'var(--color-border)', color: 'var(--color-text-muted)' },
  ...GROUP_STATUS_COLORS,
  FULL: { background: 'var(--color-border)', color: 'var(--color-text-muted)' },
  COMPLETED: { background: 'var(--color-border)', color: 'var(--color-text-muted)' },
}

const sortedOwnedGroups = computed(() => {
  const drafts = ownedGroups.value
    .filter(g => g.status === 'DRAFT')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const rest = ownedGroups.value
    .filter(g => g.status !== 'DRAFT')
    .sort((a, b) => {
      if (!a.startsAt && !b.startsAt) return 0
      if (!a.startsAt) return 1
      if (!b.startsAt) return -1
      return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    })

  return [...drafts, ...rest]
})

function applicationsLabel(count: number): string {
  if (count === 0) return t('groups.my.applicationsZero')
  if (count === 1) return t('groups.my.applicationsOne', { count })

  const lastTwo = count % 100
  const lastOne = count % 10

  if (lastTwo >= 11 && lastTwo <= 19) return t('groups.my.applications', { count })
  if (lastOne === 1) return t('groups.my.applicationsOne', { count })
  if (lastOne >= 2 && lastOne <= 4) return t('groups.my.applicationsFew', { count })

  return t('groups.my.applications', { count })
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
    await loadGroups()
  }
  finally {
    finishLoading()
  }
}, { immediate: true })

async function loadGroups() {
  isLoading.value = true
  try {
    const data = await $fetch<{ owned: MyGroup[], coOrganized: MyGroup[] }>('/api/groups/my')
    ownedGroups.value = data.owned
    coOrganizedGroups.value = data.coOrganized
  }
  catch {
    // Silent by design: my groups load failure shows empty state
    ownedGroups.value = []
    coOrganizedGroups.value = []
  }
  finally {
    isLoading.value = false
  }
}

function requestDelete(slug: string) {
  deleteTargetSlug.value = slug
}

async function confirmDelete() {
  if (!deleteTargetSlug.value) return
  deletingSlug.value = deleteTargetSlug.value
  try {
    await $fetch(`/api/groups/${deleteTargetSlug.value}`, { method: 'DELETE' })
    ownedGroups.value = ownedGroups.value.filter(g => g.slug !== deleteTargetSlug.value)
  }
  catch {
    // Silent by design: delete failure, group stays in the list
  }
  finally {
    deletingSlug.value = null
    deleteTargetSlug.value = null
  }
}

useHead({
  title: () => t('common.myGroups'),
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
  ],
})
</script>

<template>
  <div class="my-groups-page">
    <div class="my-groups-page__header">
      <h1 class="my-groups-page__title">
        {{ t('common.myGroups') }}
      </h1>
      <NuxtLink
        :to="`/${locale}/groups/new`"
        class="my-groups-page__create-btn"
      >
        + {{ t('common.createGroup') }}
      </NuxtLink>
    </div>

    <div
      v-if="isLoading || isUserLoading"
      class="my-groups-page__status"
    >
      {{ t('common.loading') }}
    </div>

    <div
      v-else-if="sortedOwnedGroups.length === 0 && coOrganizedGroups.length === 0"
      class="my-groups-page__empty"
    >
      <div
        class="my-groups-page__empty-icon"
        aria-hidden="true"
      >
        &#x1F4CB;
      </div>
      <p class="my-groups-page__empty-text">
        {{ t('groups.my.empty') }}
      </p>
      <NuxtLink
        :to="`/${locale}/groups/new`"
        class="my-groups-page__create-btn"
      >
        {{ t('groups.my.emptyCta') }}
      </NuxtLink>
    </div>

    <div v-else>
      <div
        v-if="sortedOwnedGroups.length > 0"
        class="my-groups-page__grid"
      >
        <div
          v-for="group in sortedOwnedGroups"
          :key="group.id"
          class="my-group-card"
        >
          <UiPill
            :label="t(`groups.my.statuses.${group.status}`)"
            :background="statusColors[group.status]?.background ?? 'var(--color-border)'"
            :color="statusColors[group.status]?.color ?? 'var(--color-text-muted)'"
          />
          <div class="my-group-card__header">
            <h3
              class="my-group-card__title"
              :class="{ 'my-group-card__title--unnamed': !group.title }"
            >
              {{ group.title || t('groups.my.unnamedDraft') }}
            </h3>
          </div>

          <div
            v-if="group.rejectionReason"
            class="my-group-card__rejection"
          >
            <span
              class="my-group-card__rejection-icon"
              aria-hidden="true"
            >✕</span>
            <div class="my-group-card__rejection-content">
              <strong>{{ t('common.rejectionReason') }}</strong>
              <p class="my-group-card__rejection-text">
                {{ group.rejectionReason }}
              </p>
            </div>
          </div>

          <div class="my-group-card__meta">
            <span
              v-if="group.startsAt"
              class="my-group-card__meta-item"
            >
              {{ formatDate(group.startsAt, locale) }}
            </span>
            <NuxtLink
              v-if="group.status === 'DRAFT'"
              class="my-group-card__meta-item"
            >
              {{ applicationsLabel(group.applicationsCount) }}
            </NuxtLink>
            <NuxtLink
              v-else-if="group.status === 'PENDING_REVIEW'"
              class="my-group-card__meta-item"
            >
              {{ applicationsLabel(group.applicationsCount) }}
            </NuxtLink>
          </div>

          <div class="my-group-card__actions">
            <NuxtLink
              v-if="group.status === 'DRAFT' || group.status === 'PENDING_REVIEW' || group.status === 'REJECTED'"
              :to="`/${locale}/groups/edit/${group.slug}`"
              class="my-group-card__btn"
            >
              {{ t('common.edit') }}
            </NuxtLink>

            <NuxtLink
              v-if="group.status === 'PUBLISHED' && group.applicationsCount > 0"
              :to="`/${locale}/groups/applications/${group.slug}`"
              class="my-group-card__btn my-group-card__btn--applications my-group-card__btn--applications-has"
            >
              {{ applicationsLabel(group.applicationsCount) }}
            </NuxtLink>

            <div
              v-else-if="group.status === 'PUBLISHED'"
              class="my-group-card__no-applications"
            >
              {{ applicationsLabel(group.applicationsCount) }}
            </div>

            <NuxtLink
              v-if="group.status === 'PUBLISHED'"
              :to="`/${locale}/groups/${group.slug}`"
              class="my-group-card__btn"
              @click="onViewGroup"
            >
              {{ t('groups.my.view') }}
            </NuxtLink>

            <UiButton
              v-if="group.status === 'DRAFT' || group.status === 'REJECTED'"
              variant="danger"
              class="my-group-card__btn my-group-card__btn--danger"
              :disabled="deletingSlug === group.slug"
              @click="requestDelete(group.slug)"
            >
              {{ t('common.delete') }}
            </UiButton>
          </div>
        </div>
      </div>

      <div
        v-if="coOrganizedGroups.length > 0"
        class="my-groups-page__co-section"
      >
        <h2 class="my-groups-page__section-title">
          {{ t('groups.my.coOrganizedTitle') }}
        </h2>
        <div class="my-groups-page__grid">
          <div
            v-for="group in coOrganizedGroups"
            :key="group.id"
            class="my-group-card"
          >
            <div class="my-group-card__badges">
              <UiPill
                :label="t(`groups.my.statuses.${group.status}`)"
                :background="statusColors[group.status]?.background ?? 'var(--color-border)'"
                :color="statusColors[group.status]?.color ?? 'var(--color-text-muted)'"
              />
              <UiPill
                :label="t('groups.my.coOrganizerBadge')"
                background="var(--color-primary)"
                color="var(--color-surface)"
              />
            </div>
            <div class="my-group-card__header">
              <h3
                class="my-group-card__title"
                :class="{ 'my-group-card__title--unnamed': !group.title }"
              >
                {{ group.title || t('groups.my.unnamedDraft') }}
              </h3>
            </div>

            <div class="my-group-card__meta">
              <span
                v-if="group.startsAt"
                class="my-group-card__meta-item"
              >
                {{ formatDate(group.startsAt, locale) }}
              </span>
              <span
                v-if="group.ownerName"
                class="my-group-card__meta-item"
              >
                {{ group.ownerName }}
              </span>
            </div>

            <div class="my-group-card__actions">
              <NuxtLink
                :to="`/${locale}/groups/edit/${group.slug}`"
                class="my-group-card__btn"
              >
                {{ t('common.edit') }}
              </NuxtLink>
              <NuxtLink
                v-if="group.status === 'PUBLISHED'"
                :to="`/${locale}/groups/${group.slug}`"
                class="my-group-card__btn"
                @click="onViewGroup"
              >
                {{ t('groups.my.view') }}
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </div>

    <UiConfirmModal
      :model-value="!!deleteTargetSlug"
      :title="t('groups.confirmDeleteTitle')"
      :message="t('groups.confirmDeleteMessage')"
      :loading="!!deletingSlug"
      @update:model-value="v => { if (!v) deleteTargetSlug = null }"
      @confirm="confirmDelete"
    />
  </div>
</template>

<style scoped>
.my-groups-page {
  max-width: var(--container-width);
  margin: 0 auto;
  padding: var(--spacing-xl) var(--spacing-lg);
}

.my-groups-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-xl);
  gap: var(--spacing-md);
}

.my-groups-page__title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  margin: 0;
}

.my-groups-page__create-btn {
  display: inline-flex;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-primary);
  color: var(--color-white);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  text-decoration: none;
  transition: background var(--transition-base);
  white-space: nowrap;
}

.my-groups-page__create-btn:hover {
  background: var(--color-primary-hover);
  color: var(--color-white);
  text-decoration: none;
}

.my-groups-page__status {
  text-align: center;
  padding: var(--spacing-2xl);
  font-size: var(--font-size-lg);
  color: var(--color-text-muted);
}

.my-groups-page__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-2xl) var(--spacing-lg);
  text-align: center;
}

.my-groups-page__empty-icon {
  font-size: 3rem;
  opacity: 0.5;
}

.my-groups-page__empty-text {
  font-size: var(--font-size-lg);
  color: var(--color-text-muted);
  margin: 0;
}

.my-groups-page__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-lg);
}

.my-groups-page__co-section {
  margin-top: var(--spacing-2xl);
}

.my-groups-page__section-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  margin: 0 0 var(--spacing-lg);
}

.my-group-card__badges {
  display: flex;
  gap: var(--spacing-xs);
  flex-wrap: wrap;
}

.my-group-card {
  background: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.my-group-card .ui-pill {
  align-self: flex-start;
}

.my-group-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-sm);
}

.my-group-card__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  margin: 0;
  line-height: var(--line-height-tight);
  flex: 1;
  min-width: 0;
}

.my-group-card__title--unnamed {
  font-style: italic;
  color: var(--color-text-muted);
  font-weight: var(--font-weight-normal);
}

.my-group-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs) var(--spacing-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.my-group-card__meta-item::before {
  content: '·';
  margin-right: var(--spacing-xs);
}

.my-group-card__meta-item:first-child::before {
  content: '';
  margin: 0;
}

.my-group-card__actions {
  display: flex;
  gap: var(--spacing-sm);
  margin-top: auto;
  padding-top: var(--spacing-md);
  border-top: var(--border-width) solid var(--color-border);
}

.my-group-card__btn {
  padding: var(--spacing-xs) var(--spacing-md);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-background);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  text-decoration: none;
  transition: border-color var(--transition-base), color var(--transition-base);
}

.my-group-card__btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  text-decoration: none;
}

.my-group-card__btn--applications {
  border-color: transparent;
  background: transparent;
}

.my-group-card__btn--applications-has {
  color: var(--color-warning);
  border-color: var(--color-warning);
  font-weight: var(--font-weight-semibold);
}

.my-group-card__no-applications {
  padding: var(--spacing-xs) var(--spacing-md);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  text-decoration: none;
}

.my-group-card__btn--danger {
  color: var(--color-error);
  border-color: transparent;
}

.my-group-card__btn--danger:hover {
  border-color: var(--color-error);
  color: var(--color-error);
}

.my-group-card__btn--danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 1024px) {
  .my-groups-page__grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.my-group-card__rejection {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm);
  background: var(--color-status-error-bg);
  border: var(--border-width) solid var(--color-status-error-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  color: var(--color-status-error-text);
}

.my-group-card__rejection-icon {
  flex-shrink: 0;
  font-size: var(--font-size-md);
  line-height: 1;
}

.my-group-card__rejection-content {
  flex: 1;
  min-width: 0;
}

.my-group-card__rejection-text {
  margin: var(--spacing-xs) 0 0;
  line-height: var(--line-height-normal);
}

@media (max-width: 640px) {
  .my-groups-page__grid {
    grid-template-columns: 1fr;
  }

  .my-groups-page__header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
