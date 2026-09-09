<script setup lang="ts">
const { t } = useLocale()
</script>

<template>
  <div class="info-page">
    <h1 class="info-page__title">
      <slot name="title"></slot>
    </h1>
    <div class="info-page__updated">
      {{ t('infoPage.updated', { date: 'вересень 2026' }) }}
    </div>
    <div class="info-page__content">
      <slot></slot>
    </div>
  </div>
</template>

<style scoped>
.info-page {
  max-width: var(--container-width);
  margin: 0 auto;
  padding: var(--spacing-xl) var(--spacing-lg);
}

.info-page__title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--spacing-lg);
  color: var(--color-text);
}

.info-page__updated {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin-bottom: var(--spacing-2xl);
}

.info-page__content :deep(h2) {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  margin-top: var(--spacing-2xl);
  margin-bottom: var(--spacing-md);
  color: var(--color-text);
}

.info-page__content :deep(h3) {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  margin-top: var(--spacing-xl);
  margin-bottom: var(--spacing-sm);
  color: var(--color-text);
}

.info-page__content :deep(p) {
  font-size: var(--font-size-md);
  line-height: var(--line-height-normal);
  margin-bottom: var(--spacing-md);
  color: var(--color-text);
}

.info-page__content :deep(ul),
.info-page__content :deep(ol) {
  padding-left: var(--spacing-lg);
  margin-bottom: var(--spacing-md);
}

.info-page__content :deep(li) {
  margin-bottom: var(--spacing-xs);
  line-height: var(--line-height-normal);
}

.info-page__content :deep(a) {
  color: var(--color-primary);
  text-decoration: underline;
}

.info-page__content :deep(a:hover) {
  text-decoration: none;
}
</style>
