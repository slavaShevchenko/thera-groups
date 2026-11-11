<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    placeholder?: string
    searchFn: (_query: string) => Promise<{ id: string, label: string }[]>
    disabled?: boolean
    /**
     * `id` of the element naming this control, applied as `aria-labelledby`.
     *
     * The input has no `<label for>` to point at — callers render their own label markup in
     * their own form styles — and a placeholder is a weak accessible name that disappears as
     * soon as somebody types.
     */
    labelledBy?: string
  }>(),
  {
    placeholder: '',
    disabled: false,
    labelledBy: undefined,
  },
)

const emit = defineEmits<{
  select: [item: { id: string, label: string }]
}>()

const query = ref('')
const results = ref<{ id: string, label: string }[]>([])
const isOpen = ref(false)
const isLoading = ref(false)
const highlightedIndex = ref(-1)
const listboxId = useId()

let debounceTimer: ReturnType<typeof setTimeout> | null = null

function onInput() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    performSearch()
  }, 300)
}

async function performSearch() {
  const q = query.value.trim()
  if (!q) {
    results.value = []
    isOpen.value = false
    return
  }

  isLoading.value = true
  try {
    results.value = await props.searchFn(q)
    isOpen.value = results.value.length > 0
    highlightedIndex.value = -1
  }
  catch {
    // Silent by design: search failure shows no results
    results.value = []
    isOpen.value = false
  }
  finally {
    isLoading.value = false
  }
}

function selectItem(item: { id: string, label: string }) {
  emit('select', item)
  query.value = ''
  results.value = []
  isOpen.value = false
}

function onKeyDown(e: KeyboardEvent) {
  if (!isOpen.value) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    highlightedIndex.value = Math.min(highlightedIndex.value + 1, results.value.length - 1)
  }
  else if (e.key === 'ArrowUp') {
    e.preventDefault()
    highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0)
  }
  else if (e.key === 'Enter' && highlightedIndex.value >= 0) {
    e.preventDefault()
    const item = results.value[highlightedIndex.value]
    if (item) selectItem(item)
  }
  else if (e.key === 'Escape') {
    isOpen.value = false
  }
}

function onBlur() {
  setTimeout(() => {
    isOpen.value = false
  }, 200)
}

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
})
</script>

<template>
  <div class="forms-combobox">
    <input
      v-model="query"
      type="text"
      class="forms-combobox__input"
      :placeholder="placeholder"
      :disabled="disabled"
      role="combobox"
      :aria-labelledby="labelledBy"
      aria-autocomplete="list"
      :aria-expanded="isOpen"
      :aria-controls="listboxId"
      :aria-activedescendant="highlightedIndex >= 0 ? `${listboxId}-option-${highlightedIndex}` : undefined"
      @input="onInput"
      @keydown="onKeyDown"
      @blur="onBlur"
    />
    <ul
      v-if="isOpen"
      :id="listboxId"
      class="forms-combobox__list"
      role="listbox"
    >
      <li
        v-for="(item, index) in results"
        :id="`${listboxId}-option-${index}`"
        :key="item.id"
        class="forms-combobox__option"
        :class="{ 'forms-combobox__option--highlighted': index === highlightedIndex }"
        role="option"
        :aria-selected="index === highlightedIndex"
        @mousedown.prevent="selectItem(item)"
        @mouseenter="highlightedIndex = index"
      >
        {{ item.label }}
      </li>
    </ul>
    <span
      v-if="isLoading"
      class="forms-combobox__loading"
      aria-hidden="true"
    >
      …
    </span>
  </div>
</template>

<style scoped>
.forms-combobox {
  position: relative;
}

.forms-combobox__input {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
  font-family: var(--font-family-base);
  color: var(--color-text);
  background: var(--color-surface);
  transition: border-color var(--transition-base);
  box-sizing: border-box;
}

.forms-combobox__input:focus {
  outline: none;
}

.forms-combobox__input:focus-visible {
  border-color: var(--color-primary);
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  box-shadow: 0 0 0 2px var(--color-focus-ring);
}

.forms-combobox__input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.forms-combobox__list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 10;
  max-height: 200px;
  overflow-y: auto;
  margin: var(--spacing-xs) 0 0;
  padding: 0;
  list-style: none;
  background: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
}

.forms-combobox__option {
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: background-color var(--transition-base);
}

.forms-combobox__option:hover,
.forms-combobox__option--highlighted {
  background: var(--color-background-accent);
}

.forms-combobox__loading {
  position: absolute;
  right: var(--spacing-md);
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
</style>
