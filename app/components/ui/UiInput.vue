<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue?: string
    label?: string
    /**
     * Accessible name for an input that has no visible `label`. It is a prop rather than a
     * fallthrough attribute on purpose: the component's root is the wrapper `div`, so an
     * `aria-label` written on `<UiInput>` would name the wrapper and leave the `<input>`
     * unnamed.
     */
    ariaLabel?: string
    type?: string
    placeholder?: string
    error?: string
    disabled?: boolean
    required?: boolean
    autocomplete?: string
    name?: string
    id?: string
    min?: string
    max?: string
    maxChars?: number
  }>(),
  {
    modelValue: '',
    type: 'text',
    disabled: false,
    required: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const autoId = useId()
const inputId = computed(() => props.id || autoId)
const errorId = computed(() => `${inputId.value}-error`)

const isDateInput = computed(() => props.type === 'date' || props.type === 'datetime-local')

const isOver = computed(() => props.maxChars !== undefined && props.modelValue.length > props.maxChars)

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}
</script>

<template>
  <div
    class="ui-input"
    :class="{ 'ui-input--error': error, 'ui-input--disabled': disabled }"
  >
    <label
      v-if="label"
      :for="inputId"
      class="ui-input__label"
    >
      {{ label }}
      <span
        v-if="required"
        class="ui-input__required"
      >*</span>
    </label>
    <div class="ui-input__wrapper">
      <input
        :id="inputId"
        class="ui-input__field"
        :class="{
          'ui-input__field--date': isDateInput,
        }"
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :required="required"
        :name="name"
        :autocomplete="autocomplete"
        :min="min"
        :max="max"
        :aria-label="label ? undefined : ariaLabel"
        :aria-invalid="!!error"
        :aria-describedby="error ? errorId : undefined"
        @input="onInput"
      />
      <UiIcon
        v-if="isDateInput"
        name="calendar"
        :size="18"
        class="ui-input__date-icon"
      />
    </div>
    <span
      v-if="maxChars"
      class="ui-input__counter"
      :class="{ 'ui-input__counter--over': isOver }"
      aria-hidden="true"
    >
      {{ modelValue.length }} / {{ maxChars }}
    </span>
    <p
      v-if="error"
      :id="errorId"
      class="ui-input__error"
      role="alert"
    >
      {{ error }}
    </p>
  </div>
</template>

<style scoped>
.ui-input {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.ui-input__label {
  margin-bottom: var(--spacing-xs);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.ui-input__required {
  color: var(--color-error);
}

.ui-input__wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.ui-input__field {
  padding: var(--spacing-sm) var(--spacing-md);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  font-family: var(--font-family-base);
  font-size: var(--font-size-md);
  color: var(--color-text);
  background: var(--color-surface);
  transition: border-color var(--transition-base), box-shadow var(--transition-base);
  width: 100%;
  box-sizing: border-box;
}

.ui-input__field--date {
  padding-right: 2.5rem;
  cursor: pointer;
}

/* Нативная иконка календаря скрываем — ставим свою */
.ui-input__field--date::-webkit-calendar-picker-indicator {
  display: none;
}

.ui-input__field:focus {
  outline: none;
}

.ui-input__field:focus-visible {
  border-color: var(--color-primary);
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  box-shadow: 0 0 0 2px var(--color-focus-ring);
}

.ui-input--error .ui-input__field {
  border-color: var(--color-error);
}

.ui-input--error .ui-input__field:focus-visible {
  outline-color: var(--color-error);
  box-shadow: 0 0 0 2px var(--color-error-border-soft);
}

.ui-input--disabled {
  opacity: 0.5;
}

.ui-input__error {
  font-size: var(--font-size-xs);
  color: var(--color-error);
  margin: 0;
}

.ui-input__counter {
  align-self: flex-end;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.ui-input__counter--over {
  color: var(--color-error-text);
  font-weight: var(--font-weight-medium);
}

.ui-input__date-icon {
  position: absolute;
  right: var(--spacing-sm);
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-muted);
  pointer-events: none;
}
</style>
