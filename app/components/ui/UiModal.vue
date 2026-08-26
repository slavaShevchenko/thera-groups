<script setup lang="ts">
const { t } = useLocale()

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title?: string
    maxWidth?: string
  }>(),
  {
    maxWidth: '500px',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const titleId = useId()
const dialogRef = ref<HTMLElement | null>(null)

function close() {
  emit('update:modelValue', false)
}

function onBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) close()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

watch(() => props.modelValue, (open) => {
  if (open) {
    document.body.style.overflow = 'hidden'
    nextTick(() => {
      const focusable = dialogRef.value?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      focusable?.focus()
    })
  }
  else {
    document.body.style.overflow = ''
  }
})

onBeforeUnmount(() => {
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="ui-modal__backdrop"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="title ? titleId : undefined"
      @click="onBackdropClick"
      @keydown="onKeydown"
    >
      <div
        ref="dialogRef"
        class="ui-modal__dialog"
        :style="{ maxWidth }"
      >
        <div class="ui-modal__header">
          <h2
            v-if="title"
            :id="titleId"
            class="ui-modal__title"
          >
            {{ title }}
          </h2>
          <button
            type="button"
            class="ui-modal__close"
            :aria-label="t('common.actions.close')"
            @click="close"
          >
            &times;
          </button>
        </div>

        <div class="ui-modal__body">
          <slot></slot>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.ui-modal__backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(23, 58, 58, 0.5);
  padding: var(--spacing-md);
}

.ui-modal__dialog {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ui-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: var(--border-width) solid var(--color-border);
  flex-shrink: 0;
}

.ui-modal__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  margin: 0;
}

.ui-modal__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: none;
  background: transparent;
  font-size: var(--font-size-xl);
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: background var(--transition-base), color var(--transition-base);
}

.ui-modal__close:hover {
  background: var(--color-background);
  color: var(--color-text);
}

.ui-modal__body {
  padding: var(--spacing-lg);
  overflow-y: auto;
}

@media (max-width: 640px) {
  .ui-modal__backdrop {
    padding: 0;
    align-items: stretch;
  }

  .ui-modal__dialog {
    max-width: none;
    max-height: none;
    border-radius: 0;
    height: 100%;
  }
}
</style>
