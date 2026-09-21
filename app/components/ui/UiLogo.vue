<script setup lang="ts">
const { t, locale } = useLocale()
</script>

<template>
  <NuxtLink
    :to="`/${locale}`"
    class="app-header__logo"
  >
    <img
      src="/logo/logo.webp"
      :alt="t('common.logoAlt')"
      width="50"
      height="50"
      loading="lazy"
    />
    <span class="app-header__logo-text">
      <span class="app-header__logo-title">{{ t('seo.siteName') }}</span>
      <span class="app-header__logo-subtitle">{{ t('layout.header.logoSubtitle') }}</span>
    </span>
  </NuxtLink>
</template>

<style scoped>
.app-header__logo {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  max-width: 200px;
  color: var(--color-text-muted);
}

.app-header__logo:hover {
  text-decoration: none;
}

.app-header__logo img {
  border-radius: var(--radius-md);
}

.app-header__logo-text {
  display: flex;
  flex-direction: column;
}

.app-header__logo-title {
  margin-bottom: var(--spacing-xs);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}

.app-header__logo-subtitle {
  font-size: var(--font-size-xs);
  line-height: 1.1;
  color: var(--color-text-muted);
}

@media (max-width: 767px) {
  .app-header__logo img {
    width: 40px;
    height: 40px;
  }
  .app-header__logo-title {
    margin-bottom: var(--spacing-xs);
    font-size: var(--font-size-md);
  }
  .app-header__logo-subtitle {
    font-size: var(--font-size-2xs);
    line-height: 1.1;
  }
}
</style>
