<script setup lang="ts">
/**
 * Multi-select for ISO 639-1 language codes, shared by the organizer profile and the group
 * editor.
 *
 * Extracted from `profile/edit.vue` rather than copied into `groups/edit/[slug].vue`: the two
 * pages need the identical search, the identical pill list and the identical remove button,
 * and a second copy is how the two forms drift apart on the one field they have in common.
 * `iso-639-1` knows ~180 languages, so the picker searches instead of listing — that part is
 * `Combobox`, which this wraps.
 *
 * The label and any hint stay with the calling page, because each form already has its own
 * label styles and required-field markers.
 */
const props = withDefaults(
  defineProps<{
    /** Selected codes. The component never mutates it — it emits a new array. */
    modelValue: string[]
    placeholder?: string
    disabled?: boolean
    /** `id` of the caller's label element, forwarded to the search input as `aria-labelledby`. */
    labelledBy?: string
  }>(),
  {
    placeholder: '',
    disabled: false,
    labelledBy: undefined,
  },
)

const emit = defineEmits<{
  'update:modelValue': [string[]]
}>()

const { t, locale } = useLocale()

/**
 * `Combobox` closes its list on an empty query and never calls this with one, so there is no
 * "show the first ten" branch to maintain.
 */
async function searchLanguages(query: string) {
  const q = query.trim().toLowerCase()

  return getLanguageOptions(locale.value)
    .filter(l => l.searchName.includes(q))
    .slice(0, 10)
    .map(l => ({ id: l.code, label: l.label }))
}

function onSelect(item: { id: string, label: string }) {
  if (!props.modelValue.includes(item.id)) {
    emit('update:modelValue', [...props.modelValue, item.id])
  }
}

function removeLanguage(code: string) {
  emit('update:modelValue', props.modelValue.filter(c => c !== code))
}
</script>

<template>
  <div class="language-picker">
    <Combobox
      :placeholder="placeholder"
      :search-fn="searchLanguages"
      :disabled="disabled"
      :labelled-by="labelledBy"
      @select="onSelect"
    />

    <ul
      v-if="modelValue.length"
      class="language-picker__pills"
    >
      <li
        v-for="code in modelValue"
        :key="code"
        class="language-picker__pill"
      >
        {{ languageLabel(code, locale) }}
        <button
          type="button"
          class="language-picker__remove"
          :aria-label="`${t('common.actions.remove')} ${languageLabel(code, locale)}`"
          :disabled="disabled"
          @click="removeLanguage(code)"
        >
          ×
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.language-picker__pills {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  margin: var(--spacing-sm) 0 0;
  padding: 0;
  list-style: none;
}

.language-picker__pill {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-background-accent);
  color: var(--color-text);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}

.language-picker__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  font-size: var(--font-size-sm);
  line-height: 1;
  cursor: pointer;
  opacity: 0.8;
}

.language-picker__remove:hover:not(:disabled) {
  opacity: 1;
}

.language-picker__remove:focus-visible {
  outline: 2px solid var(--color-primary-text);
  outline-offset: 1px;
  border-radius: var(--radius-full);
}

.language-picker__remove:disabled {
  cursor: not-allowed;
}
</style>
