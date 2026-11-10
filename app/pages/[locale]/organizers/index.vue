<script setup lang="ts">
import type { OrganizerListItem } from '~~/types'

interface OrganizersResponse {
  organizers: OrganizerListItem[]
  total: number
  page: number
  totalPages: number
}

const { t, locale, pathLocale } = useLocale()
const route = useRoute()
const router = useRouter()

const siteUrl = useRuntimeConfig().public.siteUrl as string
const canonicalUrl = computed(() => `${siteUrl}/${pathLocale.value}/organizers`)

useSeoPage({
  title: () => t('seo.organizersTitle'),
  description: () => t('seo.organizersDescription'),
  canonicalUrl: canonicalUrl.value,
})

// The URL is the source of truth so a search survives reload and can be shared.
const activeQuery = computed(() => ((route.query.q as string) ?? '').trim())
const searchInput = ref(activeQuery.value)

function buildQuery(page?: number) {
  const query: Record<string, string> = {}
  if (activeQuery.value) query.q = activeQuery.value
  if (page) query.page = String(page)
  return query
}

const { data, status, error: fetchError, refresh } = await useAsyncData(
  'organizers-catalog',
  () => $fetch<OrganizersResponse>('/api/organizers', { query: buildQuery() }),
  { watch: [() => route.query.q] },
)

const allOrganizers = ref<OrganizerListItem[]>(data.value?.organizers ?? [])
const currentPage = ref(data.value?.page ?? 1)
const totalPages = ref(data.value?.totalPages ?? 1)
const total = ref(data.value?.total ?? 0)
const loadingMore = ref(false)

watch(data, (newData) => {
  if (newData) {
    allOrganizers.value = newData.organizers
    currentPage.value = newData.page
    totalPages.value = newData.totalPages
    total.value = newData.total
  }
})

const isLoading = computed(() => status.value === 'pending')
const isSearching = computed(() => isLoading.value && allOrganizers.value.length > 0)
const hasMore = computed(() => currentPage.value < totalPages.value)

function applyQuery(q: string) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  for (const [key, value] of Object.entries(route.query)) {
    if (key === 'q') continue
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item != null) params.append(key, String(item))
    }
  }
  const search = params.toString()
  return router.replace(`${route.path}${search ? `?${search}` : ''}`)
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null

watch(searchInput, () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    const next = searchInput.value.trim()
    if (next === activeQuery.value) return
    applyQuery(next)
  }, 300)
})

// Keeps the field in sync with back/forward navigation and with clearSearch().
watch(activeQuery, (value) => {
  if (value !== searchInput.value) searchInput.value = value
})

function clearSearch() {
  if (debounceTimer) clearTimeout(debounceTimer)
  searchInput.value = ''
  applyQuery('')
}

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
})

async function loadMore() {
  if (loadingMore.value || !hasMore.value) return
  loadingMore.value = true
  try {
    const result = await $fetch<OrganizersResponse>('/api/organizers', {
      query: buildQuery(currentPage.value + 1),
    })
    allOrganizers.value = [...allOrganizers.value, ...result.organizers]
    currentPage.value = result.page
    totalPages.value = result.totalPages
    total.value = result.total
  }
  catch {
    // Silent by design: organizers load failure shows empty state
  }
  finally {
    loadingMore.value = false
  }
}

const organizersCount = computed(() => total.value)
</script>

<template>
  <div class="organizers-page">
    <header class="organizers-page__header">
      <h1 class="organizers-page__title">
        {{ t('common.organizers') }}
      </h1>
    </header>

    <div class="organizers-page__content">
      <div class="organizers-page__search">
        <label
          for="organizers-search"
          class="organizers-page__sr-only"
        >
          {{ t('organizers.searchPlaceholder') }}
        </label>
        <UiInput
          id="organizers-search"
          v-model="searchInput"
          type="search"
          name="q"
          autocomplete="off"
          :placeholder="t('organizers.searchPlaceholder')"
        />
      </div>

      <p
        class="organizers-page__count"
        role="status"
      >
        <span
          v-if="isSearching"
          class="organizers-page__spinner"
          aria-hidden="true"
        ></span>
        {{ t('organizers.found', { count: String(organizersCount) }) }}
      </p>

      <div
        v-if="isLoading && !allOrganizers.length"
        class="organizers-page__status"
      >
        {{ t('common.loading') }}
      </div>

      <div
        v-else-if="fetchError"
        class="organizers-page__error"
      >
        <p>{{ t('errors.failedToLoad') }}</p>
        <UiButton
          variant="secondary"
          @click="refresh"
        >
          {{ t('common.retry') }}
        </UiButton>
      </div>

      <div
        v-else-if="allOrganizers && allOrganizers.length > 0"
        class="organizers-page__body"
        :aria-busy="isSearching"
      >
        <div
          class="organizers-page__grid"
          :class="{ 'organizers-page__grid--searching': isSearching }"
        >
          <OrganizerCatalogCard
            v-for="organizer in allOrganizers"
            :key="organizer.slug"
            :organizer="organizer"
          />
        </div>

        <div
          v-if="hasMore"
          class="organizers-page__load-more"
        >
          <UiButton
            variant="secondary"
            :disabled="loadingMore || isSearching"
            @click="loadMore"
          >
            {{ loadingMore ? t('common.loading') : t('pagination.loadMore') }}
          </UiButton>
          <span class="organizers-page__progress">
            {{ allOrganizers.length }} / {{ total }}
          </span>
        </div>
      </div>

      <UiEmptyState
        v-else-if="activeQuery"
        :title="t('organizers.noResults')"
      >
        <UiButton
          variant="secondary"
          @click="clearSearch"
        >
          {{ t('common.clearSearch') }}
        </UiButton>
      </UiEmptyState>

      <UiEmptyState
        v-else
        :title="t('emptyStates.organizers.title')"
      >
        <UiButton
          :to="`/${locale}/profile/edit`"
          variant="secondary"
        >
          {{ t('emptyStates.organizers.cta') }}
        </UiButton>
      </UiEmptyState>
    </div>
  </div>
</template>

<style scoped>
.organizers-page {
  padding: var(--spacing-xl) var(--spacing-lg);
  max-width: var(--container-width);
  margin: 0 auto;
}

.organizers-page__header {
  margin-bottom: var(--spacing-lg);
}

.organizers-page__title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  margin: 0;
  line-height: var(--line-height-tight);
}

.organizers-page__content {
  min-width: 0;
}

.organizers-page__search {
  max-width: 420px;
  margin-bottom: var(--spacing-md);
}

.organizers-page__sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.organizers-page__count {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin: 0 0 var(--spacing-md) 0;
}

.organizers-page__spinner {
  width: 0.875rem;
  height: 0.875rem;
  flex-shrink: 0;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: var(--radius-full);
  animation: organizers-page-spin 0.6s linear infinite;
}

@keyframes organizers-page-spin {
  to {
    transform: rotate(360deg);
  }
}

.organizers-page__status {
  text-align: center;
  padding: var(--spacing-2xl);
  font-size: var(--font-size-lg);
  color: var(--color-text-muted);
}

.organizers-page__error {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--color-error-text);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
}

.organizers-page__body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

.organizers-page__grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--spacing-lg);
  transition: opacity var(--transition-base);
}

.organizers-page__grid--searching {
  opacity: 0.5;
}

@media (max-width: 1100px) {
  .organizers-page__grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .organizers-page__grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .organizers-page__search {
    max-width: none;
    width: 100%;
  }

  .organizers-page__grid {
    grid-template-columns: 1fr;
  }
}

.organizers-page__load-more {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
}

.organizers-page__progress {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

@media (prefers-reduced-motion: reduce) {
  .organizers-page__spinner {
    animation-duration: 1.5s;
  }

  .organizers-page__grid {
    transition: none;
  }
}
</style>
