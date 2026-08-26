<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    variant?: 'primary' | 'secondary'
    disabled?: boolean
  }>(),
  {
    variant: 'primary',
    disabled: false,
  },
)

const emit = defineEmits<{
  click: []
}>()
</script>

<template>
  <button
    class="ui-button"
    :class="`ui-button--${variant}`"
    :disabled="disabled"
    @click="emit('click')"
  >
    {{ label }}
  </button>
</template>

<style scoped>
.ui-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-sm) var(--spacing-md);
  border: var(--border-width) solid transparent;
  border-radius: var(--radius-sm);
  font-family: var(--font-family-base);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: background-color var(--transition-base), border-color var(--transition-base);
}

.ui-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

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
</style>
