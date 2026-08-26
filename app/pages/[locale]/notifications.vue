<script setup lang="ts">
const { t, locale } = useLocale()
const { isAuthenticated, isLoading: isUserLoading } = useUser()
const { startLoading, finishLoading, forceHide } = usePageLoading()

interface Notification {
  id: string
  type: string
  entityType: string
  entityId: string
  title: string
  message: string
  read: boolean
  createdAt: string
}

const notifications = ref<Notification[]>([])
const isLoading = ref(true)

const unreadCount = computed(() => notifications.value.filter(n => !n.read).length)

watch(isUserLoading, async (loading) => {
  if (loading) return

  if (!isAuthenticated.value) {
    forceHide()
    navigateTo(`/${locale.value}/auth/login`)
    return
  }

  startLoading()
  try {
    await loadNotifications()
  }
  finally {
    finishLoading()
  }
}, { immediate: true })

async function loadNotifications() {
  isLoading.value = true
  try {
    notifications.value = await $fetch<Notification[]>('/api/notifications/my')
  }
  catch {
    notifications.value = []
  }
  finally {
    isLoading.value = false
  }
}

async function markAsRead(id: string) {
  try {
    await $fetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
    const n = notifications.value.find(n => n.id === id)
    if (n) n.read = true
  }
  catch {
    // Mark failed
  }
}

async function markAllRead() {
  try {
    await $fetch('/api/notifications/read-all', { method: 'PATCH' })
    notifications.value.forEach((n) => {
      n.read = true
    })
  }
  catch {
    // Mark all failed
  }
}

useHead({
  title: () => t('notifications.title'),
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
  ],
})
</script>

<template>
  <div class="notifications-page">
    <div class="notifications-page__header">
      <h1 class="notifications-page__title">
        {{ t('notifications.title') }}
      </h1>
      <UiButton
        v-if="unreadCount > 0"
        :label="t('notifications.markAllRead')"
        variant="secondary"
        size="sm"
        @click="markAllRead"
      />
    </div>

    <div
      v-if="isLoading || isUserLoading"
      class="notifications-page__status"
    >
      {{ t('common.loading') }}
    </div>

    <div
      v-else-if="notifications.length === 0"
      class="notifications-page__empty"
    >
      <div class="notifications-page__empty-icon">
        &#x1F514;
      </div>
      <p class="notifications-page__empty-text">
        {{ t('notifications.empty') }}
      </p>
    </div>

    <div
      v-else
      class="notifications-page__list"
    >
      <div
        v-for="n in notifications"
        :key="n.id"
        class="notification-item"
        :class="{ 'notification-item--unread': !n.read }"
        @click="!n.read && markAsRead(n.id)"
      >
        <div class="notification-item__content">
          <span class="notification-item__type">
            {{ t(`notifications.types.${n.type}`) }}
          </span>
          <h3 class="notification-item__title">
            {{ n.title }}
          </h3>
          <p class="notification-item__message">
            {{ n.message }}
          </p>
          <span class="notification-item__date">
            {{ formatDate(n.createdAt, locale) }}
          </span>
        </div>
        <div
          v-if="!n.read"
          class="notification-item__dot"
        ></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.notifications-page {
  max-width: 48rem;
  margin: 0 auto;
  padding: var(--spacing-xl) var(--spacing-lg);
}

.notifications-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-xl);
}

.notifications-page__title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  margin: 0;
}

.notifications-page__status {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--color-text-muted);
}

.notifications-page__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-2xl);
  text-align: center;
}

.notifications-page__empty-icon {
  font-size: 3rem;
  opacity: 0.4;
}

.notifications-page__empty-text {
  font-size: var(--font-size-lg);
  color: var(--color-text-muted);
  margin: 0;
}

.notifications-page__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.notification-item {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: default;
  transition: background var(--transition-base);
}

.notification-item--unread {
  cursor: pointer;
  background: var(--color-background-accent);
  border-color: var(--color-primary);
}

.notification-item--unread:hover {
  background: var(--color-background);
}

.notification-item__content {
  flex: 1;
  min-width: 0;
}

.notification-item__type {
  font-size: var(--font-size-xs);
  color: var(--color-primary);
  font-weight: var(--font-weight-medium);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.notification-item__title {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
  margin: var(--spacing-xs) 0 var(--spacing-xs);
}

.notification-item__message {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin: 0 0 var(--spacing-xs);
}

.notification-item__date {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.notification-item__dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  flex-shrink: 0;
  margin-top: var(--spacing-sm);
}
</style>
