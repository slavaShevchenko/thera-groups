<script setup lang="ts">
const { t, locale } = useLocale()
const { user, isLoading: isUserLoading } = useUser()

interface MyGroup {
  id: string
  slug: string
  title: string
  status: string
  format: string
  type: string
  startsAt: string
  category: string
  applicationsCount: number
  createdAt: string
}

const groups = ref<MyGroup[]>([])
const isLoading = ref(true)
const deletingSlug = ref<string | null>(null)

const statusColors: Record<string, { background: string, color: string }> = {
  DRAFT: { background: 'var(--color-border)', color: 'var(--color-text-muted)' },
  PENDING_REVIEW: { background: '#FEF3C7', color: '#92400E' },
  PUBLISHED: { background: '#D1FAE5', color: '#065F46' },
  FULL: { background: 'var(--color-border)', color: 'var(--color-text-muted)' },
  COMPLETED: { background: 'var(--color-border)', color: 'var(--color-text-muted)' },
}

const sortedGroups = computed(() => {
  const drafts = groups.value
    .filter(g => g.status === 'DRAFT')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const rest = groups.value
    .filter(g => g.status !== 'DRAFT')
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())

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

watch(isUserLoading, (loading) => {
  if (loading) return

  if (!user.value || user.value.role !== 'ORGANIZER') {
    navigateTo(`/${locale.value}/`)
    return
  }

  loadGroups()
}, { immediate: true })

async function loadGroups() {
  isLoading.value = true
  try {
    groups.value = await $fetch<MyGroup[]>('/api/groups/my')
  }
  catch {
    groups.value = []
  }
  finally {
    isLoading.value = false
  }
}

async function deleteGroup(slug: string) {
  if (!confirm(t('groups.my.confirmDelete'))) return

  deletingSlug.value = slug
  try {
    await $fetch(`/api/groups/${slug}`, { method: 'DELETE' })
    groups.value = groups.value.filter(g => g.slug !== slug)
  }
  catch {
    // Delete error — group stays in the list
  }
  finally {
    deletingSlug.value = null
  }
}

useHead({ title: () => t('groups.my.title') })
</script>

<template>
  <div class="my-groups-page">
    <div class="my-groups-page__header">
      <h1 class="my-groups-page__title">
        {{ t('groups.my.title') }}
      </h1>
      <NuxtLink
        :to="`/${locale}/groups/new`"
        class="my-groups-page__create-btn"
      >
        + {{ t('groups.my.create') }}
      </NuxtLink>
    </div>

    <div
      v-if="isLoading || isUserLoading"
      class="my-groups-page__status"
    >
      {{ t('common.loading') }}
    </div>

    <div
      v-else-if="sortedGroups.length === 0"
      class="my-groups-page__empty"
    >
      <div class="my-groups-page__empty-icon">
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

    <div
      v-else
      class="my-groups-page__grid"
    >
      <div
        v-for="group in sortedGroups"
        :key="group.id"
        class="my-group-card"
      >
        <div class="my-group-card__header">
          <h2
            class="my-group-card__title"
            :class="{ 'my-group-card__title--unnamed': !group.title }"
          >
            {{ group.title || t('groups.my.unnamedDraft') }}
          </h2>
          <UiPill
            :label="t(`groups.my.statuses.${group.status}`)"
            :background="statusColors[group.status]?.background ?? 'var(--color-border)'"
            :color="statusColors[group.status]?.color ?? 'var(--color-text-muted)'"
          />
        </div>

        <div class="my-group-card__meta">
          <span
            v-if="group.startsAt"
            class="my-group-card__meta-item"
          >
            {{ formatDate(group.startsAt, locale) }}
          </span>
          <span class="my-group-card__meta-item">
            {{ group.category }}
          </span>
          <span class="my-group-card__meta-item">
            {{ applicationsLabel(group.applicationsCount) }}
          </span>
        </div>

        <div class="my-group-card__actions">
          <NuxtLink
            :to="`/${locale}/groups/edit/${group.slug}`"
            class="my-group-card__btn"
          >
            {{ t('groups.my.edit') }}
          </NuxtLink>

          <NuxtLink
            v-if="group.status === 'PUBLISHED'"
            :to="`/${locale}/groups/${group.slug}`"
            class="my-group-card__btn"
          >
            {{ t('groups.my.view') }}
          </NuxtLink>

          <button
            v-if="group.status === 'DRAFT'"
            type="button"
            class="my-group-card__btn my-group-card__btn--danger"
            :disabled="deletingSlug === group.slug"
            @click="deleteGroup(group.slug)"
          >
            {{ t('groups.my.delete') }}
          </button>
        </div>
      </div>
    </div>
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
  color: #fff;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  text-decoration: none;
  transition: background var(--transition-base);
  white-space: nowrap;
}

.my-groups-page__create-btn:hover {
  background: var(--color-primary-hover);
  color: #fff;
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

.my-group-card {
  background: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
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
