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
const previouslyFocused = ref<HTMLElement | null>(null)

function close() {
  emit('update:modelValue', false)
}

function onBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) close()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    close()
    return
  }

  if (e.key === 'Tab' && dialogRef.value) {
    const focusable = dialogRef.value.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault()
        last?.focus()
      }
    }
    else {
      if (document.activeElement === last) {
        e.preventDefault()
        first?.focus()
      }
    }
  }
}

watch(() => props.modelValue, (open) => {
  if (open) {
    previouslyFocused.value = document.activeElement as HTMLElement
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
    nextTick(() => {
      previouslyFocused.value?.focus()
    })
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
            :aria-label="t('common.close')"
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
  background: color-mix(in srgb, var(--color-text) 50%, transparent);
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

.ui-modal__close:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
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
