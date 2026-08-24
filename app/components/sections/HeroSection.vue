<script setup lang="ts">
defineProps<{
  title: string
  description: string
}>()
</script>

<template>
  <section class="hero-section">
    <div class="hero-section__image-wrap">
      <img
        src="/images/hero/hero.webp"
        alt=""
        class="hero-section__image"
      />
    </div>
    <div
      class="hero-section__overlay"
      aria-hidden="true"
    ></div>
    <div class="hero-section__content">
      <h1 class="hero-section__title">
        {{ title }}
      </h1>
      <p class="hero-section__description">
        {{ description }}
      </p>
      <slot></slot>
    </div>
  </section>
</template>

<style scoped>
.hero-section {
  position: relative;
  min-height: 400px;
  overflow: hidden;
  margin-bottom: var(--spacing-2xl);
}
.hero-section__image-wrap {
  width: 75%;
  height: 100%;
  position: absolute;
  right: 0;
  top: 0;
  z-index: 1;
}
.hero-section__image {
  object-fit: cover;
  width: 100%;
  height: 100%;
}

.hero-section__overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to right,
    var(--color-background-accent) 0%,
    var(--color-background-accent) 40%,
    transparent 80%
  );
  z-index: 1;
}

.hero-section__content {
  max-width: var(--container-width);
  margin: 0 auto;
  position: relative;
  z-index: 2;
  padding: var(--spacing-2xl) var(--spacing-lg);
}

.hero-section__title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
  margin: 0 0 var(--spacing-md);
  max-width: 36ch;
  color: var(--color-text);
}

.hero-section__description {
  font-size: var(--font-size-lg);
  line-height: var(--line-height-relaxed);
  color: var(--color-text-muted);
  margin: 0 0 var(--spacing-xl);
  max-width: 48ch;
}

@media (max-width: 768px) {
  .hero-section {
    min-height: 400px;
  }

  .hero-section__overlay {
    background: linear-gradient(
      to right,
      var(--color-background) 0%,
      var(--color-background) 50%,
      rgba(250, 248, 244, 0.4) 70%,
      transparent 85%
    );
  }

  .hero-section__title {
    font-size: var(--font-size-xl);
  }

  .hero-section__description {
    font-size: var(--font-size-md);
  }
}
</style>
