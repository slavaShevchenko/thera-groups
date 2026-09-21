<script setup lang="ts">
type PillVariant = 'neutral' | 'primary' | 'success' | 'warning' | 'error' | 'info'

withDefaults(
  defineProps<{
    label: string
    variant?: PillVariant
  }>(),
  {
    variant: 'neutral',
  },
)

const variantClass = computed(() => `ui-pill--${variant}`)
</script>

<template>
  <span
    class="ui-pill"
    :class="variantClass"
  >
    {{ label }}
  </span>
</template>

<style scoped>
.ui-pill {
  display: inline-flex;
  align-items: center;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  line-height: var(--line-height-tight);
  box-shadow: var(--shadow-sm);
}

.ui-pill--neutral {
  background: var(--color-surface);
  color: var(--color-text);
}

.ui-pill--primary {
  background: var(--color-primary);
  color: var(--color-white);
}

.ui-pill--success {
  background: var(--color-status-success-bg);
  color: var(--color-status-success-text);
}

.ui-pill--warning {
  background: var(--color-status-warning-bg);
  color: var(--color-status-warning-text);
}

.ui-pill--error {
  background: var(--color-status-error-bg);
  color: var(--color-status-error-text);
}

.ui-pill--info {
  background: var(--color-status-info-bg);
  color: var(--color-status-info-text);
}
</style>
