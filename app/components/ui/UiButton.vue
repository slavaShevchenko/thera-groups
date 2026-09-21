<script setup lang="ts">
import { resolveComponent } from 'vue'

const NuxtLink = resolveComponent('NuxtLink')

const props = withDefaults(
  defineProps<{
    label?: string
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
    type?: 'button' | 'submit' | 'reset'
    size?: 'sm' | 'md' | 'lg'
    disabled?: boolean
    to?: string | object
    href?: string
    loading?: boolean
  }>(),
  {
    variant: 'primary',
    type: 'button',
    size: 'md',
    disabled: false,
    loading: false,
  },
)

const tag = computed(() => {
  if (props.to) return NuxtLink
  if (props.href) return 'a'
  return 'button'
})

const attrs = computed(() => {
  if (props.to) return { to: props.to }
  if (props.href) return { href: props.href }
  return { type: props.type }
})

const isDisabled = computed(() => props.disabled || props.loading)
</script>

<template>
  <component
    :is="tag"
    v-bind="attrs"
    class="ui-button"
    :class="[`ui-button--${variant}`, `ui-button--${size}`]"
    :disabled="isDisabled"
    :aria-busy="loading || undefined"
  >
    <span
      v-if="loading"
      class="ui-button__spinner"
      aria-hidden="true"
    >⟳</span>
    <slot
      v-else
      name="icon"
    ></slot>
    <slot>{{ label }}</slot>
  </component>
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
  text-decoration: none;
}

.ui-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ui-button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
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
  color: var(--color-white);
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
  background-color: var(--color-status-error-bg);
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

.ui-button__spinner {
  display: inline-block;
  animation: ui-button-spin 0.8s linear infinite;
}

@keyframes ui-button-spin {
  to { transform: rotate(360deg); }
}
</style>
