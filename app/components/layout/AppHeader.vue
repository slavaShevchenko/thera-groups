<script setup lang="ts">
import type { MenuSection } from '~~/types/drawer'

const { t, locale, setLocale } = useLocale()
const { user, isAuthenticated, logout } = useUser()
const { can } = usePermissions()

const isDrawerOpen = ref(false)
const unreadNotifications = ref(0)
let pollInterval: ReturnType<typeof setInterval> | null = null

async function fetchUnreadCount() {
  if (!isAuthenticated.value) return
  try {
    const notifications = await $fetch<{ read: boolean }[]>('/api/notifications/my')
    unreadNotifications.value = notifications.filter(n => !n.read).length
  }
  catch {
    unreadNotifications.value = 0
  }
}

watch(isAuthenticated, (authed) => {
  if (authed) {
    fetchUnreadCount()
    pollInterval = setInterval(fetchUnreadCount, 30000)
  }
  else {
    unreadNotifications.value = 0
    if (pollInterval) {
      clearInterval(pollInterval)
      pollInterval = null
    }
  }
}, { immediate: true })

onBeforeUnmount(() => {
  if (pollInterval) clearInterval(pollInterval)
})

const isPendingOrganizer = computed(() =>
  user.value?.role === 'ORGANIZER'
  && user.value?.organizerProfile?.verificationStatus === 'PENDING',
)

function toggleLang() {
  setLocale(locale.value === 'ua' ? 'en' : 'ua')
}

function toggleDrawer() {
  isDrawerOpen.value = !isDrawerOpen.value
}

function closeDrawer() {
  isDrawerOpen.value = false
}

async function handleLogout() {
  closeDrawer()
  await logout()
  await navigateTo(`/${locale.value}/`)
}

const menuSections = computed<MenuSection[]>(() => [
  {
    id: 'navigation',
    title: t('drawer.navigation'),
    items: [
      { icon: 'home', label: t('drawer.home'), to: `/${locale.value}`, onClick: closeDrawer },
      { icon: 'calendar', label: t('drawer.catalog'), to: `/${locale.value}/groups`, onClick: closeDrawer },
      { icon: 'users', label: t('drawer.organizers'), to: `/${locale.value}/organizers`, onClick: closeDrawer },
    ],
  },
  {
    id: 'account',
    title: t('drawer.account'),
    divider: true,
    items: !isAuthenticated.value
      ? [
          { icon: 'log-in', label: t('drawer.login'), to: `/${locale.value}/auth/login`, onClick: closeDrawer },
          { icon: 'user-plus', label: t('drawer.register'), to: `/${locale.value}/auth/register`, onClick: closeDrawer },
        ]
      : [
          { icon: 'list', label: t('drawer.myGroups'), to: `/${locale.value}/groups/my`, onClick: closeDrawer, condition: () => can('group.viewMyList') },
          { icon: 'plus', label: t('drawer.createGroup'), to: `/${locale.value}/groups/new`, onClick: closeDrawer, condition: () => can('group.create') },
          { icon: 'shield', label: t('drawer.admin'), to: `/${locale.value}/admin`, onClick: closeDrawer, condition: () => can('admin.panel') },
          { icon: 'file-text', label: t('drawer.myApplications'), to: `/${locale.value}/applications/my`, onClick: closeDrawer, condition: () => can('application.viewMyApplications') },
          { icon: 'heart', label: t('drawer.favorites'), to: `/${locale.value}/favorites`, onClick: closeDrawer },
          { icon: 'user', label: t('drawer.profile'), to: `/${locale.value}/profile`, onClick: closeDrawer, condition: () => can('user.profile.view') },
          { icon: 'log-out', label: t('drawer.logout'), onClick: handleLogout, danger: true },
        ],
  },
])
</script>

<template>
  <header class="app-header">
    <div class="app-header__container">
      <UiLogo />

      <div class="app-header__spacer">
        <NuxtLink
          :to="`/${locale}/groups`"
          class="app-header__spacer-link"
        >
          <UiIcon
            name="calendar"
            :size="20"
          />
          {{ t('drawer.catalog') }}
        </NuxtLink>
        <NuxtLink
          :to="`/${locale}/organizers`"
          class="app-header__spacer-link"
        >
          <UiIcon
            name="users"
            :size="20"
          />
          {{ t('drawer.organizers') }}
        </NuxtLink>
      </div>

      <div class="app-header__actions">
        <button
          class="app-header__lang"
          type="button"
          :aria-label="t('layout.header.switchLanguage')"
          @click="toggleLang"
        >
          <UiIcon
            name="globe"
            class="app-header__lang-icon"
          />
          <span class="app-header__lang-label">{{ locale.toUpperCase() }}</span>
        </button>

        <NuxtLink
          v-if="isAuthenticated"
          :to="`/${locale}/notifications`"
          class="app-header__bell"
          :aria-label="t('layout.header.notifications')"
        >
          <UiIcon
            name="bell"
            :size="20"
          />
          <span
            v-if="unreadNotifications > 0"
            class="app-header__bell-badge"
          >
            {{ unreadNotifications > 9 ? '9+' : unreadNotifications }}
          </span>
        </NuxtLink>

        <button
          class="app-header__burger"
          type="button"
          :aria-label="t('drawer.openMenu')"
          @click="toggleDrawer"
        >
          <UiIcon
            name="menu"
            :size="24"
          />
        </button>
      </div>
    </div>

    <AppDrawer
      v-model="isDrawerOpen"
      :menu-sections="menuSections"
      :is-pending-organizer="isPendingOrganizer"
    />
  </header>
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--color-surface);
  border-bottom: var(--border-width) solid var(--color-border);
}

.app-header__container {
  max-width: var(--container-width);
  margin: 0 auto;
  min-height: var(--header-height);
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  padding: var(--spacing-sm) var(--spacing-lg);
}

.app-header__spacer {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  justify-content: flex-end;
}

.app-header__spacer-link {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs);
  border: none;
  background: transparent;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: color var(--transition-base);
}
.app-header__spacer-link:hover {
  color: var(--color-primary);
  text-decoration: none;
}

.app-header__actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.app-header__lang {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs);
  border: none;
  background: transparent;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: color var(--transition-base);
}

.app-header__lang:hover {
  color: var(--color-primary);
}

.app-header__lang-icon {
  width: 1.25rem;
  height: 1.25rem;
}

.app-header__bell {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  color: var(--color-text-muted);
  text-decoration: none;
  border-radius: var(--radius-md);
  transition: background var(--transition-base), color var(--transition-base);
}

.app-header__bell:hover {
  background: var(--color-background-accent);
  color: var(--color-text);
  text-decoration: none;
}

.app-header__bell-badge {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  min-width: 1rem;
  height: 1rem;
  padding: 0 0.25rem;
  background: var(--color-error);
  color: #fff;
  font-size: 0.625rem;
  font-weight: var(--font-weight-bold);
  line-height: 1rem;
  text-align: center;
  border-radius: var(--radius-full);
}

.app-header__burger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: background var(--transition-base), color var(--transition-base);
}

.app-header__burger:hover {
  background: var(--color-background-accent);
  color: var(--color-text);
}

@media (max-width: 640px) {
  .app-header__logo-subtitle {
    display: none;
  }
}
</style>
