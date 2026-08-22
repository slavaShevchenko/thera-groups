<script setup lang="ts">
const { t, locale, setLocale } = useLocale()

// TODO: заменить '#' на реальные маршруты по мере создания страниц
const navItems = computed(() => [
  { key: 'layout.header.nav.findGroup', to: `/${locale.value}/groups` },
  { key: 'layout.header.nav.therapists', to: '#' },
  { key: 'layout.header.nav.about', to: '#' },
  { key: 'layout.header.nav.blog', to: '#' },
  { key: 'layout.header.nav.howItWorks', to: '#' },
])

const toggleLang = () => {
  setLocale(locale.value === 'ua' ? 'en' : 'ua')
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

        <NuxtLink
          to="#"
          class="app-header__login"
        >
          {{ t('layout.header.login') }}
        </NuxtLink>

        <UiButton :label="t('layout.header.createGroup')" />
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

@media (max-width: 1024px) {
  .app-header__nav {
    display: none;
  }
}

@media (max-width: 640px) {
  .app-header__login,
  .app-header__logo-subtitle {
    display: none;
  }
}
</style>
