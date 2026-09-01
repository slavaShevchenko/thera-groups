<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: number
    min?: number
    max?: number
    step?: number
    disabled?: boolean
  }>(),
  {
    min: 0,
    max: 15,
    step: 1,
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const { t } = useLocale()

function onInput(e: Event) {
  const target = e.target as HTMLInputElement
  emit('update:modelValue', Number(target.value))
}

const displayValue = computed(() => {
  return t('profile.edit.experienceYears', { count: String(props.modelValue) })
})
</script>

<template>
  <div class="forms-slider">
    <input
      type="range"
      class="forms-slider__input"
      :value="modelValue"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled"
      @input="onInput"
    />
    <output class="forms-slider__value">
      {{ displayValue }}
    </output>
  </div>
</template>

<style scoped>
.forms-slider {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.forms-slider__input {
  flex: 1;
  height: 6px;
  appearance: none;
  background: var(--color-border);
  border-radius: var(--radius-full);
  outline: none;
  cursor: pointer;
}

.forms-slider__input::-webkit-slider-thumb {
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--color-primary);
  cursor: pointer;
  transition: background-color var(--transition-base);
}

.forms-slider__input::-webkit-slider-thumb:hover {
  background: var(--color-primary-hover);
}

.forms-slider__input:focus-visible {
  box-shadow: 0 0 0 2px var(--color-focus-ring);
}

.forms-slider__input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.forms-slider__value {
  min-width: 80px;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
  text-align: right;
}
</style>
