<script setup lang="ts">
const { t, locale } = useLocale()
const { isAuthenticated, isLoading: isUserLoading } = useUser()

interface MyApplication {
  id: string
  groupId: string
  name: string
  email: string
  status: string
  createdAt: string
  group: {
    title: string
    slug: string
    startsAt: string
  }
  answersCount: number
}

const applications = ref<MyApplication[]>([])
const isLoading = ref(true)

const statusColors: Record<string, { background: string, color: string }> = {
  PENDING: { background: '#FEF3C7', color: '#92400E' },
  APPROVED: { background: '#D1FAE5', color: '#065F46' },
  REJECTED: { background: '#FEE2E2', color: '#991B1B' },
}

watch(isUserLoading, (loading) => {
  if (loading) return

  if (!isAuthenticated.value) {
    navigateTo(`/${locale.value}/`)
    return
  }

  loadApplications()
}, { immediate: true })

async function loadApplications() {
  isLoading.value = true
  try {
    const data = await $fetch<{ applications: MyApplication[] }>('/api/applications/my')
    applications.value = data.applications
  }
  catch {
    applications.value = []
  }
  finally {
    isLoading.value = false
  }
}

useHead({ title: () => t('applications.my.title') })
</script>

<template>
  <div class="my-applications-page">
    <h1 class="my-applications-page__title">
      {{ t('applications.my.title') }}
    </h1>

    <div
      v-if="isLoading || isUserLoading"
      class="my-applications-page__status"
    >
      {{ t('common.loading') }}
    </div>

    <div
      v-else-if="applications.length === 0"
      class="my-applications-page__empty"
    >
      <div class="my-applications-page__empty-icon">
        &#x1F4E8;
      </div>
      <p class="my-applications-page__empty-text">
        {{ t('applications.my.empty') }}
      </p>
      <NuxtLink
        :to="`/${locale}/groups`"
        class="my-applications-page__cta"
      >
        {{ t('applications.my.emptyCta') }}
      </NuxtLink>
    </div>

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
            :background="statusColors[app.status]?.background ?? 'var(--color-border)'"
            :color="statusColors[app.status]?.color ?? 'var(--color-text-muted)'"
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

.my-applications-page__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-2xl);
  text-align: center;
}

.my-applications-page__empty-icon {
  font-size: 3rem;
  opacity: 0.5;
}

.my-applications-page__empty-text {
  font-size: var(--font-size-lg);
  color: var(--color-text-muted);
  margin: 0;
}

.my-applications-page__cta {
  display: inline-flex;
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-primary);
  color: #fff;
  border-radius: var(--radius-md);
  font-weight: var(--font-weight-medium);
  text-decoration: none;
}

.my-applications-page__cta:hover {
  background: var(--color-primary-hover);
  color: #fff;
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
