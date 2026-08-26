<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    variant?: 'danger' | 'primary'
    loading?: boolean
  }>(),
  {
    variant: 'danger',
    loading: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'confirm': []
  'cancel': []
}>()

const { t } = useLocale()

const confirmLabel = computed(() => props.confirmText || t('common.actions.confirm'))
const cancelLabel = computed(() => props.cancelText || t('common.actions.cancel'))

function close() {
  emit('update:modelValue', false)
  emit('cancel')
}

function onConfirm() {
  emit('confirm')
}
</script>

<template>
  <UiModal
    :model-value="modelValue"
    :title="title"
    max-width="400px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <p class="ui-confirm-modal__message">
      {{ message }}
    </p>
    <div class="ui-confirm-modal__actions">
      <UiButton
        variant="secondary"
        :disabled="loading"
        @click="close"
      >
        {{ cancelLabel }}
      </UiButton>
      <UiButton
        :variant="variant"
        :disabled="loading"
        @click="onConfirm"
      >
        {{ confirmLabel }}
      </UiButton>
    </div>
  </UiModal>
</template>

<style scoped>
.ui-confirm-modal__message {
  font-size: var(--font-size-md);
  color: var(--color-text);
  margin: 0 0 var(--spacing-lg);
  line-height: var(--line-height-relaxed);
}

.ui-confirm-modal__actions {
  display: flex;
  gap: var(--spacing-sm);
  justify-content: flex-end;
}
</style>
