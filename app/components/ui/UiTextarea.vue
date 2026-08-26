<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue?: string
    label?: string
    placeholder?: string
    error?: string
    disabled?: boolean
    required?: boolean
    rows?: number
    maxlength?: number
    id?: string
  }>(),
  {
    modelValue: '',
    rows: 4,
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

const charCount = computed(() => props.modelValue.length)

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLTextAreaElement).value)
}
</script>

<template>
  <div
    class="ui-textarea"
    :class="{ 'ui-textarea--error': error, 'ui-textarea--disabled': disabled }"
  >
    <div
      v-if="label || maxlength"
      class="ui-textarea__header"
    >
      <label
        v-if="label"
        :for="inputId"
        class="ui-textarea__label"
      >
        {{ label }}
        <span
          v-if="required"
          class="ui-textarea__required"
        >*</span>
      </label>
      <span
        v-if="maxlength"
        class="ui-textarea__counter"
        :class="{ 'ui-textarea__counter--over': charCount > maxlength }"
      >
        {{ charCount }}/{{ maxlength }}
      </span>
    </div>
    <textarea
      :id="inputId"
      class="ui-textarea__field"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :required="required"
      :rows="rows"
      :maxlength="maxlength"
      :aria-invalid="!!error"
      :aria-describedby="error ? errorId : undefined"
      @input="onInput"
    ></textarea>
    <p
      v-if="error"
      :id="errorId"
      class="ui-textarea__error"
      role="alert"
    >
      {{ error }}
    </p>
  </div>
</template>

<style scoped>
.ui-textarea {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.ui-textarea__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
}

.ui-textarea__label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.ui-textarea__required {
  color: var(--color-error);
}

.ui-textarea__counter {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin-left: auto;
}

.ui-textarea__counter--over {
  color: var(--color-error);
}

.ui-textarea__field {
  padding: var(--spacing-sm) var(--spacing-md);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  font-family: var(--font-family-base);
  font-size: var(--font-size-md);
  color: var(--color-text);
  background: var(--color-surface);
  resize: vertical;
  min-height: 80px;
  transition: border-color var(--transition-base), box-shadow var(--transition-base);
  width: 100%;
  box-sizing: border-box;
}

.ui-textarea__field::placeholder {
  color: var(--color-text-muted);
  opacity: 0.7;
}

.ui-textarea__field:focus {
  border-color: var(--color-primary);
  outline: none;
  box-shadow: 0 0 0 2px var(--color-focus-ring);
}

.ui-textarea--error .ui-textarea__field {
  border-color: var(--color-error);
}

.ui-textarea--error .ui-textarea__field:focus {
  box-shadow: 0 0 0 2px rgba(217, 83, 79, 0.2);
}

.ui-textarea--disabled {
  opacity: 0.5;
}

.ui-textarea__error {
  font-size: var(--font-size-xs);
  color: var(--color-error);
  margin: 0;
}
</style>
