<script setup lang="ts">
import type { Notification } from '~~/types'
import { notificationRoute } from '~~/shared/utils/notificationRoutes'

const { t, locale } = useLocale()
const { user } = useUser()
const { startLoading, finishLoading } = usePageLoading()

const notifications = ref<Notification[]>([])
const isLoading = ref(true)
const loadError = ref(false)

const unreadCount = computed(() => notifications.value.filter(n => !n.read).length)

// Authentication is enforced by app/middleware/auth.global.ts before this page renders.
onMounted(async () => {
  startLoading()
  try {
    await loadNotifications()
  }
  finally {
    finishLoading()
  }
})

async function loadNotifications() {
  isLoading.value = true
  loadError.value = false
  try {
    notifications.value = await $fetch<Notification[]>('/api/notifications/my')
  }
  catch {
    loadError.value = true
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
    // Silent by design: mark-as-read failure is non-critical
  }
}

function navigateForNotification(n: Notification) {
  return notificationRoute(n, locale.value, user.value?.role)
}

// A notification is operable when activating it does something: it still has to be
// marked read, or it links somewhere. Binding this to `!n.read` alone left read
// notifications clickable with a mouse but unreachable by keyboard.
function isOperable(n: Notification): boolean {
  return !n.read || navigateForNotification(n) !== null
}

async function onNotificationClick(n: Notification) {
  if (!n.read) {
    await markAsRead(n.id)
  }
  const url = navigateForNotification(n)
  if (url) {
    navigateTo(url)
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
    // Silent by design: mark-all-read failure is non-critical
  }
}

useHead({
  title: () => t('common.notifications'),
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
  ],
})
</script>

<template>
  <div class="notifications-page">
    <div class="notifications-page__header">
      <h1 class="notifications-page__title">
        {{ t('common.notifications') }}
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
      v-if="isLoading"
      class="notifications-page__status"
    >
      {{ t('common.loading') }}
    </div>

    <div
      v-else-if="loadError"
      class="notifications-page__error"
    >
      <p>{{ t('errors.failedToLoad') }}</p>
      <UiButton
        variant="secondary"
        @click="loadNotifications"
      >
        {{ t('common.retry') }}
      </UiButton>
    </div>

    <UiEmptyState
      v-else-if="notifications.length === 0"
      icon="🔔"
      :title="t('emptyStates.notifications.title')"
    >
      <NuxtLink
        :to="`/${locale}/catalog`"
        class="notifications-page__cta"
      >
        {{ t('emptyStates.notifications.cta') }}
      </NuxtLink>
    </UiEmptyState>

    <div
      v-else
      class="notifications-page__list"
    >
      <div
        v-for="n in notifications"
        :key="n.id"
        class="notification-item"
        :class="{ 'notification-item--unread': !n.read }"
        :role="isOperable(n) ? 'button' : undefined"
        :tabindex="isOperable(n) ? 0 : undefined"
        @click="onNotificationClick(n)"
        @keydown.enter.prevent="onNotificationClick(n)"
        @keydown.space.prevent="onNotificationClick(n)"
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

.notifications-page__error {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--color-error-text);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
}

.notifications-page__cta {
  display: inline-flex;
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-primary);
  color: var(--color-white);
  border-radius: var(--radius-md);
  font-weight: var(--font-weight-medium);
  text-decoration: none;
}

.notifications-page__cta:hover {
  background: var(--color-primary-hover);
  color: var(--color-white);
  text-decoration: none;
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

.notification-item[role="button"] {
  cursor: pointer;
}

.notification-item[role="button"]:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
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
