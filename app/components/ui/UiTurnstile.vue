<script setup lang="ts">
/**
 * Cloudflare Turnstile widget — invisible captcha for spam protection.
 * Emits the token via `update:modelValue` for form submission.
 *
 * The widget renders nothing visible (invisible mode) — it just runs the challenge
 * in the background and provides a token that must be verified server-side.
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

function cleanup() {
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

  // Wait for the Turnstile script to load
  const checkInterval = setInterval(() => {
    if (!window.turnstile) return
    clearInterval(checkInterval)

    if (!containerRef.value) return

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

  onBeforeUnmount(() => {
    clearInterval(checkInterval)
    cleanup()
  })
})

onBeforeUnmount(() => {
  cleanup()
})
</script>

<template>
  <div
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
