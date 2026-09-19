<script setup lang="ts">
const { t } = useLocale()

const steps = computed(() => [
  {
    number: 1,
    icon: 'search',
    title: t('pages.howItWorks.step1Title'),
    text: t('pages.howItWorks.step1Text'),
  },
  {
    number: 2,
    icon: 'file-text',
    title: t('pages.howItWorks.step2Title'),
    text: t('pages.howItWorks.step2Text'),
  },
  {
    number: 3,
    icon: 'mail',
    title: t('pages.howItWorks.step3Title'),
    text: t('pages.howItWorks.step3Text'),
  },
  {
    number: 4,
    icon: 'users',
    title: t('pages.howItWorks.step4Title'),
    text: t('pages.howItWorks.step4Text'),
  },
])
</script>

<template>
  <section class="how-it-works">
    <h2 class="how-it-works__title">
      {{ t('pages.howItWorks.title') }}
    </h2>
    <p class="how-it-works__subtitle">
      {{ t('pages.howItWorks.subtitle') }}
    </p>
    <div class="how-it-works__steps">
      <div
        v-for="step in steps"
        :key="step.number"
        class="how-it-works__step"
      >
        <span class="how-it-works__number">{{ step.number }}</span>
        <div class="how-it-works__icon-circle">
          <UiIcon
            :name="step.icon"
            :size="32"
          />
        </div>
        <h3 class="how-it-works__step-title">
          {{ step.title }}
        </h3>
        <p class="how-it-works__step-text">
          {{ step.text }}
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.how-it-works {
  padding: var(--spacing-3xl, 4rem) 0;
  background: var(--color-background);
  max-width: var(--container-width);
  margin: 0 auto;
  padding-left: var(--spacing-lg);
  padding-right: var(--spacing-lg);
}

.how-it-works__title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  text-align: center;
  color: var(--color-text);
  margin: 0 0 var(--spacing-sm);
}

.how-it-works__subtitle {
  font-size: var(--font-size-md);
  color: var(--color-text-muted);
  text-align: center;
  margin: 0 0 var(--spacing-2xl);
}

.how-it-works__steps {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--spacing-xl);
  position: relative;
}

.how-it-works__step {
  position: relative;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.how-it-works__number {
  position: absolute;
  top: 0;
  left: calc(50% - 60px);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--color-primary);
  color: var(--color-white);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  z-index: 2;
}

.how-it-works__icon-circle {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: var(--color-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: var(--spacing-md);
  margin-bottom: var(--spacing-md);
  color: var(--color-primary);
  box-shadow: var(--shadow-sm);
}

.how-it-works__step-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  margin: 0 0 var(--spacing-xs);
  color: var(--color-text);
}

.how-it-works__step-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  line-height: var(--line-height-relaxed);
  max-width: 240px;
  margin: 0;
}

/* Dashed connector lines between steps */
.how-it-works__step:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 55px;
  left: calc(50% + 50px);
  width: calc(100% - 100px);
  border-top: 2px dashed var(--color-border);
  z-index: 1;
}

/* Tablet: 2 columns */
@media (max-width: 1024px) {
  .how-it-works__steps {
    grid-template-columns: repeat(2, 1fr);
    gap: var(--spacing-2xl);
  }

  /* Hide connector lines on tablet */
  .how-it-works__step:not(:last-child)::after {
    display: none;
  }
}

/* Mobile: 1 column */
@media (max-width: 560px) {
  .how-it-works {
    padding: var(--spacing-2xl) var(--spacing-md);
  }

  .how-it-works__title {
    font-size: var(--font-size-xl);
  }

  .how-it-works__steps {
    grid-template-columns: 1fr;
    gap: var(--spacing-xl);
  }

  .how-it-works__step {
    flex-direction: row;
    text-align: left;
    align-items: flex-start;
    gap: var(--spacing-md);
  }

  .how-it-works__number {
    position: static;
    flex-shrink: 0;
  }

  .how-it-works__icon-circle {
    margin: 0;
    flex-shrink: 0;
    width: 60px;
    height: 60px;
  }

  .how-it-works__step-content {
    flex: 1;
  }

  .how-it-works__step-title {
    font-size: var(--font-size-md);
  }

  .how-it-works__step-text {
    font-size: var(--font-size-sm);
    max-width: none;
  }
}
</style>
