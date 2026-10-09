<script setup lang="ts">
import type { MyApplication } from '~~/types'
import { APPLICATION_STATUS_VARIANTS } from '~~/shared/constants/statusColors'

const { t, locale } = useLocale()
const { startLoading, finishLoading } = usePageLoading()

const applications = ref<MyApplication[]>([])
const isLoading = ref(true)
const loadError = ref(false)

const statusVariants = APPLICATION_STATUS_VARIANTS

// Authentication is enforced by app/middleware/auth.global.ts before this page renders.
onMounted(async () => {
  startLoading()
  try {
    await loadApplications()
  }
  finally {
    finishLoading()
  }
})

async function loadApplications() {
  isLoading.value = true
  loadError.value = false
  try {
    const data = await $fetch<{ applications: MyApplication[] }>('/api/applications/my')
    applications.value = data.applications
  }
  catch {
    loadError.value = true
  }
  finally {
    isLoading.value = false
  }
}

useHead({
  title: () => t('common.myApplications'),
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
  ],
})
</script>

<template>
  <div class="my-applications-page">
    <h1 class="my-applications-page__title">
      {{ t('common.myApplications') }}
    </h1>

    <div
      v-if="isLoading"
      class="my-applications-page__status"
    >
      {{ t('common.loading') }}
    </div>

    <div
      v-else-if="loadError"
      class="my-applications-page__error"
    >
      <p>{{ t('errors.failedToLoad') }}</p>
      <UiButton
        variant="secondary"
        @click="loadApplications"
      >
        {{ t('common.retry') }}
      </UiButton>
    </div>

    <UiEmptyState
      v-else-if="applications.length === 0"
      icon="📨"
      :title="t('applications.my.empty')"
    >
      <NuxtLink
        :to="`/${locale}/catalog`"
        class="my-applications-page__cta"
      >
        {{ t('common.browseGroups') }}
      </NuxtLink>
    </UiEmptyState>

    <div
      v-else
      class="my-applications-page__list"
    >
      <div
        v-for="app in applications"
        :key="app.id"
        class="my-application-card"
      >
        <div class="my-application-card__header">
          <NuxtLink
            :to="`/${locale}/groups/${app.group.slug}`"
            class="my-application-card__group-link"
          >
            {{ app.group.title }}
          </NuxtLink>
          <UiPill
            :label="t(`applications.my.statuses.${app.status}`)"
            :variant="statusVariants[app.status] ?? 'neutral'"
          />
        </div>

        <div class="my-application-card__meta">
          <span>{{ t('applications.my.submittedAt') }} {{ formatDate(app.createdAt, locale) }}</span>
          <span v-if="app.group.startsAt">
            {{ t('groups.startDate') }}: {{ formatDate(app.group.startsAt, locale) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.my-applications-page {
  max-width: 48rem;
  margin: 0 auto;
  padding: var(--spacing-xl) var(--spacing-lg);
}

.my-applications-page__title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  margin: 0 0 var(--spacing-xl);
}

.my-applications-page__status {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--color-text-muted);
}

.my-applications-page__error {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--color-error-text);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
}

.my-applications-page__cta {
  display: inline-flex;
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-primary);
  color: var(--color-white);
  border-radius: var(--radius-md);
  font-weight: var(--font-weight-medium);
  text-decoration: none;
}

.my-applications-page__cta:hover {
  background: var(--color-primary-hover);
  color: var(--color-white);
  text-decoration: none;
}

.my-applications-page__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.my-application-card {
  background: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
}

.my-application-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-sm);
}

.my-application-card__group-link {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  text-decoration: none;
}

.my-application-card__group-link:hover {
  color: var(--color-primary);
  text-decoration: none;
}

.my-application-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs) var(--spacing-lg);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}
</style>
