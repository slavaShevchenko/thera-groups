<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title?: string
    width?: string
  }>(),
  {
    title: undefined,
    width: '400px',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const { t } = useLocale()

const panelRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)

function close() {
  emit('update:modelValue', false)
}

function onOverlayClick(event: MouseEvent) {
  if (event.target === event.currentTarget) {
    close()
  }
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    close()
    return
  }

  if (event.key === 'Tab' && panelRef.value) {
    const focusable = panelRef.value.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (event.shiftKey) {
      if (document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      }
    }
    else {
      if (document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
  }
}

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    triggerRef.value = document.activeElement as HTMLElement
    document.body.style.overflow = 'hidden'

    nextTick(() => {
      const firstFocusable = panelRef.value?.querySelector<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      firstFocusable?.focus()
    })
  }
  else {
    document.body.style.overflow = ''
    triggerRef.value?.focus()
  }
})

onBeforeUnmount(() => {
  document.body.style.overflow = ''
})

const panelStyle = computed(() => ({
  width: `min(${props.width}, 100%)`,
}))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="ui-drawer"
      @click="onOverlayClick"
      @keydown="onKeyDown"
    >
      <div class="ui-drawer__overlay"></div>
      <div
        ref="panelRef"
        class="ui-drawer__panel"
        :style="panelStyle"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
      >
        <div class="ui-drawer__header">
          <h2
            v-if="title"
            class="ui-drawer__title"
          >
            {{ title }}
          </h2>
          <button
            type="button"
            class="ui-drawer__close"
            :aria-label="t('common.close')"
            @click="close"
          >
            <UiIcon
              name="x"
              :size="24"
            />
          </button>
        </div>
        <div class="ui-drawer__content">
          <slot></slot>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.ui-drawer {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
}

.ui-drawer__overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(2px);
  animation: ui-drawer-fade-in 300ms ease-out;
}

.ui-drawer__panel {
  position: relative;
  height: 100%;
  background: var(--color-surface);
  box-shadow: var(--shadow-xl);
  display: flex;
  flex-direction: column;
  animation: ui-drawer-slide-in 300ms ease-out;
  overflow: hidden;
}

.ui-drawer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: var(--border-width) solid var(--color-border);
  min-height: var(--header-height);
}

.ui-drawer__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  margin: 0;
}

.ui-drawer__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: background var(--transition-base), color var(--transition-base);
}

.ui-drawer__close:hover {
  background: var(--color-background-accent);
  color: var(--color-text);
}

.ui-drawer__content {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-lg);
}

@keyframes ui-drawer-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes ui-drawer-slide-in {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

@media (max-width: 640px) {
  .ui-drawer__panel {
    width: 100% !important;
  }
}
</style>
