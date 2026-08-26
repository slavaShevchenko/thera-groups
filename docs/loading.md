# Global Page Loading System

## Architecture

The loading system consists of three parts:

1. app/composables/usePageLoading.ts — composable with global state
2. app/components/layout/PageLoader.vue — fullscreen overlay UI
3. app/layouts/default.vue — connects navigation hooks to loader

## How it works

Navigation starts
  → router.beforeEach → startLoading() (counter++)
  → PageLoader appears (fullscreen overlay with spinner + brand)
  → Page mounts → nuxtApp.hook('page:finish') → finishLoading() (counter--)
  → If page has client-side data loading:
    → startLoading() before fetch
    → await loadData()
    → finishLoading() in finally block (counter--)
  → When counter === 0 → wait 200ms → isLoading = false
  → PageLoader fades out

## usePageLoading API

const { isLoading, startLoading, finishLoading, forceHide } = usePageLoading()

| Method         | Purpose                                                    |
|----------------|------------------------------------------------------------|
| startLoading() | Increment counter, show loader                             |
| finishLoading()| Decrement counter, hide when 0 (with 200ms delay)          |
| forceHide()    | Immediately hide loader (use before redirects)             |

## Integration Checklist

When creating a new page:

- If page uses await useFetch() with SSR → no extra integration needed
- If page uses lazy: true or server: false → add startLoading/finishLoading
- If page uses watch to wait for auth/state → add startLoading/finishLoading in callback
- If page redirects (auth guard) → call forceHide() before navigateTo()
- Always wrap data loading in try/finally with finishLoading() in finally

## Usage Patterns

### Pattern 1: watch-based loading (waiting for auth state)

<script setup lang="ts">
const { startLoading, finishLoading } = usePageLoading()

watch(isUserLoading, async (loading) => {
  if (!loading) {
    startLoading()
    try {
      await loadData()
    } finally {
      finishLoading()
    }
  }
}, { immediate: true })
</script>

### Pattern 2: onMounted loading

<script setup lang="ts">
const { startLoading, finishLoading } = usePageLoading()

onMounted(async () => {
  startLoading()
  try {
    await loadData()
  } finally {
    finishLoading()
  }
})
</script>

### Pattern 3: redirect with forceHide

<script setup lang="ts">
const { forceHide } = usePageLoading()

onMounted(() => {
  if (!user.value) {
    forceHide()
    navigateTo('/auth/login')
  }
})
</script>

## Anti-patterns

### Don't create local loading state for full-page loading

❌ Bad:
const localLoading = ref(true)
await fetchData()
localLoading.value = false

✅ Good:
const { startLoading, finishLoading } = usePageLoading()
startLoading()
try {
  await fetchData()
} finally {
  finishLoading()
}

### Don't forget finishLoading on error

❌ Bad — if fetchData throws, loader is stuck forever:
startLoading()
await fetchData()
finishLoading()

✅ Good:
startLoading()
try {
  await fetchData()
} finally {
  finishLoading()
}

### Don't use useLoadingIndicator from Nuxt

❌ Bad — inconsistent with global system:
const { isLoading } = useLoadingIndicator()

✅ Good:
const { isLoading } = usePageLoading()

## Rules

- Never create page-local loading spinners for full-page data loading. Use the global PageLoader via usePageLoading.
- Always call finishLoading() in a finally block to prevent stuck loaders on errors.
- Use forceHide() before navigateTo() redirects (e.g., auth guards) to prevent stuck loaders.
- Do not use useLoadingIndicator from Nuxt — use usePageLoading instead for consistent behavior.
- The 200ms delay after loading prevents content flicker. Do not remove it.
- Counter-based system: if a page has multiple async operations, each should call startLoading()/finishLoading(). The loader hides only when all complete.

## When NOT to use

- Pages that use await useFetch() with SSR (data loads on server, page:finish covers it)
- Inline component loading (e.g., a button spinner) — use local state for those
- Skeleton loaders within a page section — those are fine alongside the global loader