<script setup lang="ts">
interface Tab {
  value: string
  label: string
  count?: number
}

defineProps<{
  modelValue: string
  tabs: Tab[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const tabRefs = ref<HTMLButtonElement[]>([])

function setActive(value: string) {
  emit('update:modelValue', value)
}

function onKeydown(event: KeyboardEvent, index: number) {
  const tabElements = tabRefs.value
  let newIndex = index

  if (event.key === 'ArrowRight') {
    newIndex = (index + 1) % tabElements.length
    event.preventDefault()
  }
  else if (event.key === 'ArrowLeft') {
    newIndex = (index - 1 + tabElements.length) % tabElements.length
    event.preventDefault()
  }
  else if (event.key === 'Home') {
    newIndex = 0
    event.preventDefault()
  }
  else if (event.key === 'End') {
    newIndex = tabElements.length - 1
    event.preventDefault()
  }

  if (newIndex !== index) {
    tabElements[newIndex]?.focus()
    const newValue = tabElements[newIndex]?.dataset.value
    if (newValue) emit('update:modelValue', newValue)
  }
}
</script>

<template>
  <div
    class="ui-tabs"
    role="tablist"
  >
    <button
      v-for="(tab, index) in tabs"
      :key="tab.value"
      :ref="(el) => { if (el) tabRefs[index] = el as HTMLButtonElement }"
      class="ui-tabs__tab"
      :class="{ 'ui-tabs__tab--active': modelValue === tab.value }"
      role="tab"
      :aria-selected="modelValue === tab.value"
      :data-value="tab.value"
      :tabindex="modelValue === tab.value ? 0 : -1"
      @click="setActive(tab.value)"
      @keydown="onKeydown($event, index)"
    >
      {{ tab.label }}
      <span
        v-if="tab.count !== undefined"
        class="ui-tabs__count"
      >
        {{ tab.count }}
      </span>
    </button>
  </div>
</template>

<style scoped>
.ui-tabs {
  display: flex;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-xl);
  border-bottom: var(--border-width) solid var(--color-border);
}

.ui-tabs__tab {
  padding: var(--spacing-sm) var(--spacing-lg);
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
  font-family: var(--font-family-base);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: all var(--transition-base);
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.ui-tabs__tab:hover {
  color: var(--color-text);
}

.ui-tabs__tab--active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.ui-tabs__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.375rem;
  border-radius: var(--radius-full);
  background: var(--color-background);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}

.ui-tabs__tab--active .ui-tabs__count {
  background: var(--color-primary-light);
  color: var(--color-primary);
}
</style>
