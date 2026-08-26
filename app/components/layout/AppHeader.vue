<script setup lang="ts">
const { t, locale, setLocale } = useLocale()
const { user, isAuthenticated, logout } = useUser()

const dropdownOpen = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)

const navItems = computed(() => [
  { key: 'layout.header.nav.findGroup', to: `/${locale.value}/groups` },
  { key: 'layout.header.nav.organizers', to: `/${locale.value}/organizers` },
  { key: 'layout.header.nav.about', to: '#' },
  { key: 'layout.header.nav.blog', to: '#' },
  { key: 'layout.header.nav.howItWorks', to: '#' },
])

const isPendingOrganizer = computed(() =>
  user.value?.role === 'ORGANIZER'
  && user.value?.organizerProfile?.verificationStatus === 'PENDING',
)

const isOrganizer = computed(() => user.value?.role === 'ORGANIZER')

const isAdmin = computed(() => user.value?.role === 'ADMIN')

const userLabel = computed(() => user.value?.email ?? '')

function toggleDropdown() {
  dropdownOpen.value = !dropdownOpen.value
}

function closeDropdown() {
  dropdownOpen.value = false
}

async function handleLogout() {
  closeDropdown()
  await logout()
  await navigateTo(`/${locale.value}/`)
}

function toggleLang() {
  setLocale(locale.value === 'ua' ? 'en' : 'ua')
}

function onClickOutside(event: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    closeDropdown()
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
})
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

      <nav
        class="app-header__nav"
        :aria-label="t('layout.header.navLabel')"
      >
        <NuxtLink
          v-for="item in navItems"
          :key="item.key"
          :to="item.to"
          class="app-header__link"
        >
          {{ t(item.key) }}
        </NuxtLink>
      </nav>

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

        <template v-if="!isAuthenticated">
          <NuxtLink
            :to="`/${locale}/auth/login`"
            class="app-header__login"
          >
            {{ t('layout.header.login') }}
          </NuxtLink>
        </template>

        <template v-else>
          <div
            ref="dropdownRef"
            class="app-header__user-menu"
          >
            <button
              class="app-header__user-trigger"
              type="button"
              :aria-expanded="dropdownOpen"
              aria-haspopup="true"
              @click="toggleDropdown"
            >
              <UiIcon
                name="user"
                class="app-header__user-icon"
              />
              <span class="app-header__user-email">{{ userLabel }}</span>
            </button>

            <div
              v-if="dropdownOpen"
              class="app-header__dropdown"
              role="menu"
            >
              <span
                v-if="isPendingOrganizer"
                class="app-header__dropdown-item app-header__dropdown-item--pending"
                role="menuitem"
              >
                {{ t('layout.header.profilePending') }}
              </span>

              <NuxtLink
                v-if="isOrganizer"
                :to="`/${locale}/groups/new`"
                class="app-header__dropdown-item app-header__dropdown-item--link"
              >
                {{ t('groups.new.title') }}
              </NuxtLink>

              <NuxtLink
                v-if="isOrganizer"
                :to="`/${locale}/groups/my`"
                class="app-header__dropdown-item app-header__dropdown-item--link"
                role="menuitem"
                @click="closeDropdown"
              >
                {{ t('layout.header.myGroups') }}
              </NuxtLink>

              <NuxtLink
                v-if="isOrganizer"
                :to="`/${locale}/profile/edit`"
                class="app-header__dropdown-item app-header__dropdown-item--link"
                role="menuitem"
                @click="closeDropdown"
              >
                {{ t('layout.header.myProfile') }}
              </NuxtLink>

              <NuxtLink
                v-if="isAdmin"
                :to="`/${locale}/admin`"
                class="app-header__dropdown-item app-header__dropdown-item--link"
                role="menuitem"
                @click="closeDropdown"
              >
                {{ t('layout.header.adminPanel') }}
              </NuxtLink>

              <NuxtLink
                v-if="!isOrganizer && !isAdmin && isAuthenticated"
                :to="`/${locale}/applications/my`"
                class="app-header__dropdown-item app-header__dropdown-item--link"
                role="menuitem"
                @click="closeDropdown"
              >
                {{ t('layout.header.myApplications') }}
              </NuxtLink>

              <button
                class="app-header__dropdown-item app-header__dropdown-item--action"
                type="button"
                role="menuitem"
                @click="handleLogout"
              >
                {{ t('layout.header.logout') }}
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>
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

.app-header__nav {
  display: flex;
  gap: var(--spacing-md);
  margin-inline: auto;
}

.app-header__link {
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
  transition: color var(--transition-base);
}

.app-header__link:hover {
  color: var(--color-primary);
  text-decoration: none;
}

.app-header__actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
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

.app-header__lang-chevron {
  width: 1rem;
  height: 1rem;
}

.app-header__login {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.app-header__login:hover {
  color: var(--color-primary);
  text-decoration: none;
}

.app-header__user-menu {
  position: relative;
}

.app-header__user-trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  border: none;
  background: transparent;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  font-family: var(--font-family-base);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: color var(--transition-base);
  max-width: 200px;
}

.app-header__user-trigger:hover {
  color: var(--color-primary);
}

.app-header__user-icon {
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
}

.app-header__user-email {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-header__dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: var(--spacing-xs);
  min-width: 200px;
  background: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  z-index: 110;
  overflow: hidden;
}

.app-header__dropdown-item {
  display: block;
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--font-size-sm);
  text-align: left;
  box-sizing: border-box;
}

.app-header__dropdown-item--pending {
  color: var(--color-text-muted);
  cursor: default;
  border-bottom: var(--border-width) solid var(--color-border);
}

.app-header__dropdown-item--action {
  border: none;
  background: transparent;
  color: var(--color-text);
  font-family: var(--font-family-base);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: background var(--transition-base);
}

.app-header__dropdown-item--action:hover {
  background: var(--color-background);
  color: var(--color-error);
}

.app-header__dropdown-item--link {
  color: var(--color-text);
  text-decoration: none;
  transition: background var(--transition-base);
}

.app-header__dropdown-item--link:hover {
  background: var(--color-background);
  color: var(--color-primary);
}

@media (max-width: 1024px) {
  .app-header__nav {
    display: none;
  }
}

@media (max-width: 640px) {
  .app-header__login,
  .app-header__logo-subtitle,
  .app-header__user-email {
    display: none;
  }
}
</style>
