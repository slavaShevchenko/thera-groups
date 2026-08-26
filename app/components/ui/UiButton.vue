<script setup lang="ts">
withDefaults(
  defineProps<{
    label?: string
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
    type?: 'button' | 'submit' | 'reset'
    size?: 'sm' | 'md' | 'lg'
    disabled?: boolean
  }>(),
  {
    variant: 'primary',
    type: 'button',
    size: 'md',
    disabled: false,
  },
)
</script>

<template>
  <button
    class="ui-button"
    :class="[`ui-button--${variant}`, `ui-button--${size}`]"
    :type="type"
    :disabled="disabled"
  >
    <slot>{{ label }}</slot>
  </button>
</template>

<style scoped>
.ui-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  border: var(--border-width) solid transparent;
  border-radius: var(--radius-sm);
  font-family: var(--font-family-base);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: background-color var(--transition-base), border-color var(--transition-base), color var(--transition-base);
  white-space: nowrap;
}

.ui-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Sizes */
.ui-button--sm {
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: var(--font-size-xs);
}

.ui-button--md {
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--font-size-md);
}

.ui-button--lg {
  padding: var(--spacing-md) var(--spacing-xl);
  font-size: var(--font-size-lg);
}

/* Variants */
.ui-button--primary {
  background-color: var(--color-primary);
  color: #ffffff;
}

.ui-button--primary:hover:not(:disabled) {
  background-color: var(--color-primary-hover);
}

.ui-button--secondary {
  background-color: var(--color-surface);
  color: var(--color-text);
  border-color: var(--color-border);
}

.ui-button--secondary:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.ui-button--danger {
  background-color: transparent;
  color: var(--color-error);
  border-color: transparent;
}

.ui-button--danger:hover:not(:disabled) {
  background-color: #FEE2E2;
  border-color: var(--color-error);
}

.ui-button--ghost {
  background-color: transparent;
  color: var(--color-text-muted);
  border-color: transparent;
}

.ui-button--ghost:hover:not(:disabled) {
  background-color: var(--color-background);
  color: var(--color-text);
}
</style>
