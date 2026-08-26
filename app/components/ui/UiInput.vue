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
    id?: string
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
    <input
      :id="inputId"
      class="ui-input__field"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :required="required"
      :autocomplete="autocomplete"
      :aria-invalid="!!error"
      :aria-describedby="error ? errorId : undefined"
      @input="onInput"
    />
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
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.ui-input__required {
  color: var(--color-error);
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

.ui-input__field::placeholder {
  color: var(--color-text-muted);
  opacity: 0.7;
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
</style>
