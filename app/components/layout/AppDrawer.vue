<script setup lang="ts">
import type { MenuSection } from '~~/types/drawer'

const { t } = useLocale()

defineProps<{
  modelValue: boolean
  menuSections: MenuSection[]
  isPendingOrganizer: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

function updateModelValue(value: boolean) {
  emit('update:modelValue', value)
}
</script>

<template>
  <UiDrawer
    :model-value="modelValue"
    :title="t('drawer.menu')"
    @update:model-value="updateModelValue"
  >
    <template
      v-for="section in menuSections"
      :key="section.id"
    >
      <hr
        v-if="section.divider"
        class="drawer-nav__divider"
      />
      <nav class="drawer-nav">
        <p class="drawer-nav__section-title">
          {{ section.title }}
        </p>
        <template
          v-for="item in section.items"
          :key="item.label"
        >
          <DrawerMenuItem
            v-if="!item.condition || item.condition()"
            :to="item.to"
            :icon="item.icon"
            :label="item.label"
            :danger="item.danger"
            @click="item.onClick"
          />
        </template>
      </nav>
    </template>

    <span
      v-if="isPendingOrganizer"
      class="drawer-nav__pending"
    >
      {{ t('layout.header.profilePending') }}
    </span>
  </UiDrawer>
</template>

<style scoped>
.drawer-nav {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.drawer-nav__section-title {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 var(--spacing-sm);
  padding: 0 var(--spacing-sm);
}

.drawer-nav__divider {
  border: none;
  border-top: var(--border-width) solid var(--color-border);
  margin: var(--spacing-lg) 0;
}

.drawer-nav__pending {
  display: block;
  margin-top: var(--spacing-lg);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-warning-bg, rgba(251, 191, 36, 0.1));
  color: var(--color-warning);
  font-size: var(--font-size-sm);
  border-radius: var(--radius-md);
  text-align: center;
}
</style>
