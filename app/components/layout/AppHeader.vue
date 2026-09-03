<script setup lang="ts">
const { t, locale, setLocale } = useLocale()
const { user, isAuthenticated, logout } = useUser()

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

const isOrganizer = computed(() => user.value?.role === 'ORGANIZER')

const isAdmin = computed(() => user.value?.role === 'ADMIN')

const isVisitor = computed(() => !isOrganizer.value && !isAdmin.value && isAuthenticated.value)

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
</script>

<template>
  <header class="app-header">
    <div class="app-header__container">
      <NuxtLink
        :to="`/${locale}`"
        class="app-header__logo"
      >
        <UiIcon
          name="sprout"
          class="app-header__logo-icon"
        />
        <span class="app-header__logo-text">
          <span class="app-header__logo-title">TheraGroups</span>
          <span class="app-header__logo-subtitle">{{ t('layout.header.logoSubtitle') }}</span>
        </span>
      </NuxtLink>

      <div class="app-header__spacer"></div>

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

    <UiDrawer
      v-model="isDrawerOpen"
      :title="t('drawer.menu')"
    >
      <nav class="drawer-nav">
        <p class="drawer-nav__section-title">
          {{ t('drawer.navigation') }}
        </p>
        <NuxtLink
          :to="`/${locale}`"
          class="drawer-nav__link"
          @click="closeDrawer"
        >
          <UiIcon
            name="home"
            :size="20"
          />
          {{ t('drawer.home') }}
        </NuxtLink>
        <NuxtLink
          :to="`/${locale}/groups`"
          class="drawer-nav__link"
          @click="closeDrawer"
        >
          <UiIcon
            name="calendar"
            :size="20"
          />
          {{ t('drawer.catalog') }}
        </NuxtLink>
        <NuxtLink
          :to="`/${locale}/organizers`"
          class="drawer-nav__link"
          @click="closeDrawer"
        >
          <UiIcon
            name="users"
            :size="20"
          />
          {{ t('drawer.organizers') }}
        </NuxtLink>
      </nav>

      <hr class="drawer-nav__divider" />

      <nav class="drawer-nav">
        <p class="drawer-nav__section-title">
          {{ t('drawer.account') }}
        </p>

        <template v-if="!isAuthenticated">
          <NuxtLink
            :to="`/${locale}/auth/login`"
            class="drawer-nav__link"
            @click="closeDrawer"
          >
            <UiIcon
              name="log-in"
              :size="20"
            />
            {{ t('drawer.login') }}
          </NuxtLink>
          <NuxtLink
            :to="`/${locale}/auth/register`"
            class="drawer-nav__link"
            @click="closeDrawer"
          >
            <UiIcon
              name="user-plus"
              :size="20"
            />
            {{ t('drawer.register') }}
          </NuxtLink>
        </template>

        <template v-else>
          <NuxtLink
            v-if="isOrganizer"
            :to="`/${locale}/groups/my`"
            class="drawer-nav__link"
            @click="closeDrawer"
          >
            <UiIcon
              name="list"
              :size="20"
            />
            {{ t('drawer.myGroups') }}
          </NuxtLink>
          <NuxtLink
            v-if="isOrganizer || isAdmin"
            :to="`/${locale}/groups/new`"
            class="drawer-nav__link"
            @click="closeDrawer"
          >
            <UiIcon
              name="plus"
              :size="20"
            />
            {{ t('drawer.createGroup') }}
          </NuxtLink>
          <NuxtLink
            v-if="isAdmin"
            :to="`/${locale}/admin`"
            class="drawer-nav__link"
            @click="closeDrawer"
          >
            <UiIcon
              name="shield"
              :size="20"
            />
            {{ t('drawer.admin') }}
          </NuxtLink>
          <NuxtLink
            v-if="isVisitor"
            :to="`/${locale}/applications/my`"
            class="drawer-nav__link"
            @click="closeDrawer"
          >
            <UiIcon
              name="file-text"
              :size="20"
            />
            {{ t('drawer.myApplications') }}
          </NuxtLink>
          <NuxtLink
            :to="`/${locale}/favorites`"
            class="drawer-nav__link"
            @click="closeDrawer"
          >
            <UiIcon
              name="heart"
              :size="20"
            />
            {{ t('drawer.favorites') }}
          </NuxtLink>
          <NuxtLink
            v-if="isOrganizer"
            :to="`/${locale}/profile/edit`"
            class="drawer-nav__link"
            @click="closeDrawer"
          >
            <UiIcon
              name="user"
              :size="20"
            />
            {{ t('drawer.profile') }}
          </NuxtLink>
          <button
            type="button"
            class="drawer-nav__link drawer-nav__link--logout"
            @click="handleLogout"
          >
            <UiIcon
              name="log-out"
              :size="20"
            />
            {{ t('drawer.logout') }}
          </button>
        </template>
      </nav>

      <span
        v-if="isPendingOrganizer"
        class="drawer-nav__pending"
      >
        {{ t('layout.header.profilePending') }}
      </span>
    </UiDrawer>
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

.app-header__logo {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  color: var(--color-text);
}

.app-header__logo:hover {
  color: var(--color-text);
  text-decoration: none;
}

.app-header__logo-icon {
  width: 2.5rem;
  height: 2.5rem;
  color: var(--color-primary);
  flex-shrink: 0;
}

.app-header__logo-text {
  display: flex;
  flex-direction: column;
}

.app-header__logo-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
}

.app-header__logo-subtitle {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.app-header__spacer {
  flex: 1;
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

/* Drawer content styles */
.drawer-nav {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.drawer-nav__section-title {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 var(--spacing-sm);
  padding: 0 var(--spacing-sm);
}

.drawer-nav__link {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  min-height: 2.75rem;
  border: none;
  background: transparent;
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-family: var(--font-family-base);
  font-weight: var(--font-weight-medium);
  text-decoration: none;
  text-align: left;
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: background var(--transition-base), color var(--transition-base);
  width: 100%;
}

.drawer-nav__link:hover {
  background: var(--color-background-accent);
  color: var(--color-primary);
  text-decoration: none;
}

.drawer-nav__link--logout:hover {
  color: var(--color-error);
}

.drawer-nav__divider {
  border: none;
  border-top: var(--border-width) solid var(--color-border);
  margin: var(--spacing-lg) 0;
}

.drawer-nav__pending {
  display: block;
  margin-top: var(--spacing-lg);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-warning-bg, rgba(251, 191, 36, 0.1));
  color: var(--color-warning);
  font-size: var(--font-size-sm);
  border-radius: var(--radius-md);
  text-align: center;
}

@media (max-width: 640px) {
  .app-header__logo-subtitle {
    display: none;
  }
}
</style>
