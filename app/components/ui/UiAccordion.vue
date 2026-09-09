<script setup lang="ts">
interface AccordionItem {
  id: string
  question: string
  answer: string
}

defineProps<{
  items: AccordionItem[]
}>()

const openItems = ref<Set<string>>(new Set())

function toggle(id: string) {
  if (openItems.value.has(id)) {
    openItems.value.delete(id)
  }
  else {
    openItems.value.add(id)
  }
}

function isOpen(id: string) {
  return openItems.value.has(id)
}
</script>

<template>
  <div class="ui-accordion">
    <div
      v-for="item in items"
      :key="item.id"
      class="ui-accordion__item"
    >
      <button
        class="ui-accordion__trigger"
        :aria-expanded="isOpen(item.id)"
        :aria-controls="`accordion-content-${item.id}`"
        @click="toggle(item.id)"
      >
        <span class="ui-accordion__question">{{ item.question }}</span>
        <UiIcon
          name="chevron-down"
          class="ui-accordion__icon"
          :class="{ 'ui-accordion__icon--open': isOpen(item.id) }"
          :size="20"
        />
      </button>
      <div
        :id="`accordion-content-${item.id}`"
        class="ui-accordion__content"
        :class="{ 'ui-accordion__content--open': isOpen(item.id) }"
        role="region"
        :aria-labelledby="`accordion-trigger-${item.id}`"
      >
        <div class="ui-accordion__answer">
          {{ item.answer }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ui-accordion {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.ui-accordion__item {
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.ui-accordion__trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-surface);
  border: none;
  cursor: pointer;
  text-align: left;
  transition: background-color var(--transition-base);
}

.ui-accordion__trigger:hover {
  background: var(--color-background);
}

.ui-accordion__trigger:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

.ui-accordion__question {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  flex: 1;
  margin-right: var(--spacing-md);
}

.ui-accordion__icon {
  color: var(--color-text-muted);
  transition: transform var(--transition-base);
  flex-shrink: 0;
}

.ui-accordion__icon--open {
  transform: rotate(180deg);
}

.ui-accordion__content {
  max-height: 0;
  overflow: hidden;
  transition: max-height var(--transition-base);
}

.ui-accordion__content--open {
  max-height: 500px;
}

.ui-accordion__answer {
  padding: var(--spacing-md) var(--spacing-lg) var(--spacing-lg);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
  color: var(--color-text);
}
</style>
