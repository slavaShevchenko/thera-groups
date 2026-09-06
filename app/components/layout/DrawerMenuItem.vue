<script setup lang="ts">
defineProps<{
  to?: string
  icon: string
  label: string
  danger?: boolean
}>()

defineEmits<{
  click: []
}>()
</script>

<template>
  <NuxtLink
    v-if="to"
    :to="to"
    class="drawer-menu-item"
    :class="{ 'drawer-menu-item--danger': danger }"
    @click="$emit('click')"
  >
    <UiIcon
      :name="icon"
      :size="20"
    />
    {{ label }}
  </NuxtLink>
  <button
    v-else
    type="button"
    class="drawer-menu-item"
    :class="{ 'drawer-menu-item--danger': danger }"
    @click="$emit('click')"
  >
    <UiIcon
      :name="icon"
      :size="20"
    />
    {{ label }}
  </button>
</template>

<style scoped>
.drawer-menu-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  min-height: 2.75rem;
  border: none;
  background: transparent;
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-family: var(--font-family-base);
  font-weight: var(--font-weight-medium);
  text-decoration: none;
  text-align: left;
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: background var(--transition-base), color var(--transition-base);
}

.drawer-menu-item:hover {
  background: var(--color-background-accent);
  color: var(--color-primary);
  text-decoration: none;
}

.drawer-menu-item--danger:hover {
  color: var(--color-error);
}
</style>
