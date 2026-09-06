<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue?: string
    label?: string
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

const { locale } = useLocale()

const autoId = useId()
const inputId = computed(() => props.id || autoId)
const errorId = computed(() => `${inputId.value}-error`)

const isDateInput = computed(() => props.type === 'date' || props.type === 'datetime-local')

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}

const displayValue = computed(() => {
  if (!props.modelValue) return props.placeholder || ''

  const date = new Date(props.modelValue)
  if (isNaN(date.getTime())) return props.modelValue

  const localeCode = locale.value === 'ua' ? 'uk-UA' : 'en-US'

  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }

  if (props.type === 'datetime-local') {
    options.hour = '2-digit'
    options.minute = '2-digit'
  }

  return new Intl.DateTimeFormat(localeCode, options).format(date)
})
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
        :aria-invalid="!!error"
        :aria-describedby="error ? errorId : undefined"
        @input="onInput"
      />
      <span
        v-if="isDateInput"
        class="ui-input__date-placeholder"
      >
        {{ displayValue }}
      </span>
      <UiIcon
        v-if="isDateInput"
        name="calendar"
        :size="18"
        class="ui-input__date-icon"
      />
    </div>
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
  border-color: var(--color-primary);
  outline: none;
  box-shadow: 0 0 0 2px var(--color-focus-ring);
}

.ui-input--error .ui-input__field {
  border-color: var(--color-error);
}

.ui-input--error .ui-input__field:focus {
  box-shadow: 0 0 0 2px rgba(217, 83, 79, 0.2);
}

.ui-input--disabled {
  opacity: 0.5;
}

.ui-input__error {
  font-size: var(--font-size-xs);
  color: var(--color-error);
  margin: 0;
}

.ui-input__date-placeholder {
  width: calc(100% - var(--spacing-md) * 2 - 2px);
  height: calc(100% - 2px);
  display: flex;
  align-items: center;
  position: absolute;
  left: var(--spacing-md);
  top: 1px;
  left: 1px;
  background-color: var(--color-surface);
  padding: 0 var(--spacing-md);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  font-size: var(--font-size-md);
  pointer-events: none;
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
