<script setup lang="ts">
interface AutocompleteItem {
  id: string
  label: string
  sublabel?: string
  avatarUrl?: string | null
}

const props = withDefaults(
  defineProps<{
    modelValue: string
    items: AutocompleteItem[]
    placeholder?: string
    loading?: boolean
    emptyText?: string
  }>(),
  {
    placeholder: '',
    loading: false,
    emptyText: '',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'select': [item: AutocompleteItem]
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const isFocused = ref(false)
const activeIndex = ref(-1)

const isOpen = computed(() => {
  if (!isFocused.value) return false
  if (props.loading) return true
  if (props.items.length > 0) return true
  if (props.items.length === 0 && props.modelValue.length >= 2) return true
  return false
})

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
  activeIndex.value = -1
}

function onFocus() {
  isFocused.value = true
}

function onBlur() {
  isFocused.value = false
  activeIndex.value = -1
}

function selectItem(item: AutocompleteItem) {
  emit('select', item)
  activeIndex.value = -1
}

function onKeyDown(e: KeyboardEvent) {
  if (!isOpen.value) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIndex.value = Math.min(activeIndex.value + 1, props.items.length - 1)
  }
  else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIndex.value = Math.max(activeIndex.value - 1, 0)
  }
  else if (e.key === 'Enter' && activeIndex.value >= 0) {
    e.preventDefault()
    selectItem(props.items[activeIndex.value])
  }
  else if (e.key === 'Escape') {
    isFocused.value = false
    activeIndex.value = -1
    inputRef.value?.blur()
  }
}

function getInitial(label: string): string {
  return label.trim().charAt(0).toUpperCase() || '?'
}

watch(() => props.items, () => {
  activeIndex.value = -1
})
</script>

<template>
  <div class="ui-autocomplete">
    <input
      ref="inputRef"
      type="text"
      class="ui-autocomplete__input"
      :value="modelValue"
      :placeholder="placeholder"
      role="combobox"
      aria-autocomplete="list"
      :aria-expanded="isOpen"
      @input="onInput"
      @focus="onFocus"
      @blur="onBlur"
      @keydown="onKeyDown"
    />
    <ul
      v-if="isOpen"
      class="ui-autocomplete__dropdown"
      role="listbox"
    >
      <li
        v-if="loading"
        class="ui-autocomplete__loading"
      >
        <span class="ui-autocomplete__spinner"></span>
        {{ t('common.loading') }}
      </li>
      <li
        v-else-if="items.length === 0 && modelValue.length >= 2"
        class="ui-autocomplete__empty"
      >
        {{ emptyText }}
      </li>
      <li
        v-for="(item, index) in items"
        v-else
        :key="item.id"
        class="ui-autocomplete__item"
        :class="{ 'ui-autocomplete__item--active': index === activeIndex }"
        role="option"
        :aria-selected="index === activeIndex"
        @click="selectItem(item)"
        @mouseenter="activeIndex = index"
      >
        <div class="ui-autocomplete__avatar">
          <img
            v-if="item.avatarUrl"
            :src="item.avatarUrl"
            :alt="item.label"
            class="ui-autocomplete__avatar-img"
          />
          <span
            v-else
            class="ui-autocomplete__avatar-initial"
          >{{ getInitial(item.label) }}</span>
        </div>
        <div class="ui-autocomplete__text">
          <span class="ui-autocomplete__label">{{ item.label }}</span>
          <span
            v-if="item.sublabel"
            class="ui-autocomplete__sublabel"
          >{{ item.sublabel }}</span>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.ui-autocomplete {
  position: relative;
}

.ui-autocomplete__input {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  font-family: var(--font-family-base);
  font-size: var(--font-size-md);
  color: var(--color-text);
  background: var(--color-surface);
  transition: border-color var(--transition-base), box-shadow var(--transition-base);
  box-sizing: border-box;
}

.ui-autocomplete__input::placeholder {
  color: var(--color-text-muted);
  opacity: 0.7;
}

.ui-autocomplete__input:focus {
  border-color: var(--color-primary);
  outline: none;
  box-shadow: 0 0 0 2px var(--color-focus-ring);
}

.ui-autocomplete__dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 10;
  max-height: 15rem;
  overflow-y: auto;
  margin: var(--spacing-xs) 0 0;
  padding: 0;
  list-style: none;
  background: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
}

.ui-autocomplete__loading {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.ui-autocomplete__spinner {
  display: inline-block;
  width: 1rem;
  height: 1rem;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: var(--radius-full);
  animation: ui-autocomplete-spin 0.6s linear infinite;
}

@keyframes ui-autocomplete-spin {
  to {
    transform: rotate(360deg);
  }
}

.ui-autocomplete__empty {
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.ui-autocomplete__item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  cursor: pointer;
  transition: background-color var(--transition-base);
}

.ui-autocomplete__item:hover,
.ui-autocomplete__item--active {
  background: var(--color-background-accent);
}

.ui-autocomplete__avatar {
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: var(--color-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.ui-autocomplete__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ui-autocomplete__avatar-initial {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.ui-autocomplete__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.ui-autocomplete__label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ui-autocomplete__sublabel {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
