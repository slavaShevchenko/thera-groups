<script setup lang="ts">
const { t, locale } = useLocale()
</script>

<template>
  <NuxtLink
    :to="`/${locale}`"
    class="ui-logo"
  >
    <img
      src="/logo/logo.webp"
      :alt="t('common.logoAlt')"
      width="50"
      height="50"
      loading="lazy"
    />
    <span class="ui-logo__text">
      <span class="ui-logo__title">{{ t('seo.siteName') }}</span>
      <span class="ui-logo__subtitle">{{ t('layout.header.logoSubtitle') }}</span>
    </span>
  </NuxtLink>
</template>

<style scoped>
.ui-logo {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  max-width: 200px;
  color: var(--color-text-muted);
  text-decoration: none;
}

.ui-logo img {
  border-radius: var(--radius-md);
}

.ui-logo__text {
  display: flex;
  flex-direction: column;
}

.ui-logo__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}

.ui-logo__subtitle {
  font-size: var(--font-size-xs);
  line-height: 1.1;
  color: var(--color-text-muted);
}

@media (max-width: 767px) {
  .ui-logo img {
    width: 40px;
    height: 40px;
  }
  .ui-logo__title {
    margin-bottom: var(--spacing-xs);
    font-size: var(--font-size-md);
  }
  .ui-logo__subtitle {
    font-size: var(--font-size-2xs);
    line-height: 1.1;
  }
}
</style>
