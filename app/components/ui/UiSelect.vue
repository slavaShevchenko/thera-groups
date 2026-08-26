<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue?: string
    label?: string
    options: Array<{ value: string, label: string }>
    placeholder?: string
    error?: string
    disabled?: boolean
    required?: boolean
    id?: string
  }>(),
  {
    modelValue: '',
    placeholder: 'Оберіть...',
    disabled: false,
    required: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const autoId = useId()
const selectId = computed(() => props.id || autoId)
const errorId = computed(() => `${selectId.value}-error`)

function onChange(e: Event) {
  emit('update:modelValue', (e.target as HTMLSelectElement).value)
}
</script>

<template>
  <div
    class="ui-select"
    :class="{ 'ui-select--error': error, 'ui-select--disabled': disabled }"
  >
    <label
      v-if="label"
      :for="selectId"
      class="ui-select__label"
    >
      {{ label }}
      <span
        v-if="required"
        class="ui-select__required"
      >*</span>
    </label>
    <select
      :id="selectId"
      class="ui-select__field"
      :value="modelValue"
      :disabled="disabled"
      :required="required"
      :aria-invalid="!!error"
      :aria-describedby="error ? errorId : undefined"
      @change="onChange"
    >
      <option
        v-if="placeholder"
        value=""
        disabled
      >
        {{ placeholder }}
      </option>
      <option
        v-for="opt in options"
        :key="opt.value"
        :value="opt.value"
      >
        {{ opt.label }}
      </option>
    </select>
    <p
      v-if="error"
      :id="errorId"
      class="ui-select__error"
      role="alert"
    >
      {{ error }}
    </p>
  </div>
</template>

<style scoped>
.ui-select {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.ui-select__label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.ui-select__required {
  color: var(--color-error);
}

.ui-select__field {
  padding: var(--spacing-sm) var(--spacing-md);
  padding-right: 2rem;
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  font-family: var(--font-family-base);
  font-size: var(--font-size-md);
  color: var(--color-text);
  background: var(--color-surface);
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%235a7a7a' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  cursor: pointer;
  transition: border-color var(--transition-base), box-shadow var(--transition-base);
  width: 100%;
  box-sizing: border-box;
}

.ui-select__field:focus {
  border-color: var(--color-primary);
  outline: none;
  box-shadow: 0 0 0 2px var(--color-focus-ring);
}

.ui-select--error .ui-select__field {
  border-color: var(--color-error);
}

.ui-select--error .ui-select__field:focus {
  box-shadow: 0 0 0 2px rgba(217, 83, 79, 0.2);
}

.ui-select--disabled {
  opacity: 0.5;
}

.ui-select__error {
  font-size: var(--font-size-xs);
  color: var(--color-error);
  margin: 0;
}
</style>
