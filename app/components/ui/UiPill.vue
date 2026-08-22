<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    background?: string
    color?: string
  }>(),
  {
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
  },
)
</script>

<template>
  <span
    class="ui-pill"
    :style="{ backgroundColor: background, color }"
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
</style>
