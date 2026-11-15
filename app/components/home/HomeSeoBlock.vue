<script setup lang="ts">
const { t } = useLocale()
</script>

<template>
  <section class="home-seo">
    <h2 class="home-seo__title">
      {{ t('pages.seoBlock.title') }}
    </h2>
    <div class="home-seo__content">
      <p class="home-seo__text">
        {{ t('pages.seoBlock.text1') }}
      </p>
      <p class="home-seo__text">
        {{ t('pages.seoBlock.text2') }}
      </p>
      <p class="home-seo__text">
        {{ t('pages.seoBlock.text3') }}
      </p>
      <p class="home-seo__text">
        {{ t('pages.seoBlock.text4') }}
      </p>
      <p class="home-seo__text">
        {{ t('pages.seoBlock.text5') }}
      </p>
    </div>
  </section>
</template>

<style scoped>
.home-seo {
  max-width: var(--container-width);
  margin: 0 auto;
  padding: var(--spacing-2xl) var(--spacing-lg);
}

.home-seo__title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  margin: 0 0 var(--spacing-lg);
  line-height: var(--line-height-tight);
}

.home-seo__content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.home-seo__text {
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
  line-height: var(--line-height-relaxed);
  margin: 0;
}

@media (max-width: 768px) {
  .home-seo {
    padding: var(--spacing-xl) var(--spacing-md);
  }

  .home-seo__title {
    font-size: var(--font-size-lg);
  }

  .home-seo__text {
    font-size: var(--font-size-sm);
  }
}
</style>
