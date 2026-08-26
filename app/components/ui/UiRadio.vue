<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue?: string
    value: string
    label?: string
    disabled?: boolean
    name?: string
  }>(),
  {
    modelValue: '',
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const autoId = useId()

function onChange() {
  emit('update:modelValue', props.value)
}
</script>

<template>
  <label
    class="ui-radio"
    :class="{ 'ui-radio--disabled': disabled }"
  >
    <input
      :id="autoId"
      type="radio"
      class="ui-radio__native"
      :checked="modelValue === value"
      :disabled="disabled"
      :name="name"
      :value="value"
      @change="onChange"
    />
    <span class="ui-radio__circle"></span>
    <span
      v-if="label"
      class="ui-radio__label"
    >{{ label }}</span>
  </label>
</template>

<style scoped>
.ui-radio {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  cursor: pointer;
  user-select: none;
}

.ui-radio--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ui-radio__native {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;
}

.ui-radio__circle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-surface);
  flex-shrink: 0;
  transition: border-color var(--transition-base);
}

.ui-radio__native:checked + .ui-radio__circle {
  border-color: var(--color-primary);
}

.ui-radio__native:checked + .ui-radio__circle::after {
  content: '';
  display: block;
  width: 0.625rem;
  height: 0.625rem;
  border-radius: var(--radius-full);
  background: var(--color-primary);
}

.ui-radio__native:focus-visible + .ui-radio__circle {
  box-shadow: 0 0 0 2px var(--color-focus-ring);
}

.ui-radio__label {
  font-size: var(--font-size-sm);
  color: var(--color-text);
}
</style>
