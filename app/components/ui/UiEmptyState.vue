<script setup lang="ts">
defineProps<{
  icon?: string
  title: string
  description?: string
}>()
</script>

<template>
  <div class="ui-empty-state">
    <div
      v-if="icon"
      class="ui-empty-state__icon"
      aria-hidden="true"
    >
      {{ icon }}
    </div>
    <p class="ui-empty-state__title">
      {{ title }}
    </p>
    <p
      v-if="description"
      class="ui-empty-state__description"
    >
      {{ description }}
    </p>
    <div
      v-if="$slots.default"
      class="ui-empty-state__action"
    >
      <slot></slot>
    </div>
  </div>
</template>

<style scoped>
.ui-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-2xl) var(--spacing-lg);
  text-align: center;
}

.ui-empty-state__icon {
  font-size: 3rem;
  opacity: 0.4;
}

.ui-empty-state__title {
  font-size: var(--font-size-lg);
  color: var(--color-text-muted);
  margin: 0;
}

.ui-empty-state__description {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin: 0;
  max-width: 32ch;
}

.ui-empty-state__action {
  margin-top: var(--spacing-xs);
}
</style>
