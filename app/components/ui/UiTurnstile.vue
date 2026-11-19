<script setup lang="ts">
/**
 * Cloudflare Turnstile widget — captcha for spam protection.
 * Emits the token via `update:modelValue` for form submission.
 *
 * Nothing is rendered on the server: the container sits behind `v-if="isReady"`, which only
 * `onMounted` flips, so SSR emits no markup and the client matches it until the widget is
 * actually created. `window.turnstile.render()` runs on the client alone.
 */

defineProps<{
  modelValue?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { turnstileSiteKey } = useRuntimeConfig().public
const containerRef = ref<HTMLDivElement>()
const widgetId = ref<string>()
const isReady = ref(false)
let poll: ReturnType<typeof setInterval> | null = null

function stopPolling() {
  if (poll === null) return

  clearInterval(poll)
  poll = null
}

function cleanup() {
  stopPolling()

  if (widgetId.value !== undefined && window.turnstile) {
    window.turnstile.remove(widgetId.value)
    widgetId.value = undefined
  }
}

onMounted(() => {
  if (!turnstileSiteKey) {
    console.warn('[turnstile] TURNSTILE_SITE_KEY not configured')
    return
  }

  isReady.value = true

  // Two things have to arrive before the widget can be created, and neither is ready at
  // this point. `api.js` is loaded `async`, so `window.turnstile` may still be undefined;
  // and the container is behind `v-if="isReady"`, whose DOM patch is queued as a microtask
  // *after* this callback returns. Poll until both are present and stop only then —
  // clearing the timer on `window.turnstile` alone used to strand the component with no
  // container to render into and no further tick to notice.
  poll = setInterval(() => {
    if (!window.turnstile || !containerRef.value) return

    stopPolling()

    widgetId.value = window.turnstile.render(containerRef.value, {
      'sitekey': turnstileSiteKey,
      'theme': 'light',
      'callback': (token: string) => {
        emit('update:modelValue', token)
      },
      'expired-callback': () => {
        emit('update:modelValue', '')
      },
      'error-callback': () => {
        emit('update:modelValue', '')
      },
    })
  }, 100)
})

onBeforeUnmount(cleanup)
</script>

<template>
  <div
    v-if="isReady"
    ref="containerRef"
    class="turnstile-container"
  ></div>
</template>

<style scoped>
.turnstile-container {
  display: flex;
  justify-content: center;
  min-height: 65px;
}
</style>
