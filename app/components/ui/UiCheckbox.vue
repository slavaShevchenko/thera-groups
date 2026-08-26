<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue?: boolean
    label?: string
    disabled?: boolean
  }>(),
  {
    modelValue: false,
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const autoId = useId()

function onChange(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).checked)
}
</script>

<template>
  <label
    class="ui-checkbox"
    :class="{ 'ui-checkbox--disabled': disabled }"
  >
    <input
      :id="autoId"
      type="checkbox"
      class="ui-checkbox__native"
      :checked="modelValue"
      :disabled="disabled"
      @change="onChange"
    />
    <span class="ui-checkbox__box"></span>
    <span
      v-if="label"
      class="ui-checkbox__label"
    >{{ label }}</span>
  </label>
</template>

<style scoped>
.ui-checkbox {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  cursor: pointer;
  user-select: none;
}

.ui-checkbox--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ui-checkbox__native {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;
}

.ui-checkbox__box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  flex-shrink: 0;
  transition: background var(--transition-base), border-color var(--transition-base);
}

.ui-checkbox__native:checked + .ui-checkbox__box {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.ui-checkbox__native:checked + .ui-checkbox__box::after {
  content: '';
  display: block;
  width: 0.375rem;
  height: 0.625rem;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg) translateY(-1px);
}

.ui-checkbox__native:focus-visible + .ui-checkbox__box {
  box-shadow: 0 0 0 2px var(--color-focus-ring);
}

.ui-checkbox__label {
  font-size: var(--font-size-sm);
  color: var(--color-text);
}
</style>
