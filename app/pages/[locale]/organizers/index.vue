<script setup lang="ts">
const { t, locale } = useLocale()
const route = useRoute()
const router = useRouter()

const head = useLocaleHead()
useHead({
  title: t('organizers.title'),
  meta: [
    {
      name: 'description',
      content: locale.value === 'en'
        ? 'Find a psychotherapy group organizer'
        : 'Знайдіть організатора психотерапевтичних груп',
    },
  ],
  ...head,
})

const selectedSpecialization = computed(() =>
  (route.query.specialization as string) || '',
)

const selectedCity = computed(() =>
  (route.query.city as string) || '',
)

const selectedFormats = computed(() => {
  const raw = route.query.format
  if (!raw) return []
  if (typeof raw === 'string') return [raw]
  return raw
})

const queryParams = computed(() => {
  const params: Record<string, string> = {}

  if (selectedSpecialization.value) {
    params.specialization = selectedSpecialization.value
  }

  if (selectedCity.value) {
    params.city = selectedCity.value
  }

  if (selectedFormats.value.length > 0) {
    params.format = selectedFormats.value.join(',')
  }

  return params
})

const { data: organizers, pending } = await useAsyncData(
  'organizers-catalog',
  () => $fetch('/api/organizers', { query: queryParams.value }),
  { watch: [queryParams] },
)

const { data: specializations } = await useFetch('/api/specializations', {
  key: 'organizers-specializations',
})

const { data: cities } = await useFetch('/api/cities', {
  key: 'organizers-cities',
})

const buildQuery = (overrides: Record<string, string>) => {
  const base = { ...queryParams.value, ...overrides }
  const result: Record<string, string> = {}

  for (const [key, value] of Object.entries(base)) {
    if (value) {
      result[key] = value
    }
  }

  return result
}

const updateFilter = (key: string, value: string) => {
  router.push({ query: buildQuery({ [key]: value }) })
}

const toggleFormat = (format: string) => {
  const current = [...selectedFormats.value]
  const index = current.indexOf(format)

  if (index >= 0) {
    current.splice(index, 1)
  }
  else {
    current.push(format)
  }

  router.push({
    query: buildQuery({ format: current.length > 0 ? current.join(',') : '' }),
  })
}

const specializationLabel = (spec: { nameUa: string, nameEn: string }) =>
  locale.value === 'en' ? spec.nameEn : spec.nameUa

const formatOptions = computed(() => [
  { value: 'ONLINE', label: t('organizers.filters.formatOnline') },
  { value: 'OFFLINE', label: t('organizers.filters.formatOffline') },
  { value: 'MIXED', label: t('organizers.filters.formatMixed') },
])

const organizersCount = computed(() =>
  organizers.value?.length ?? 0,
)
</script>

<template>
  <div class="organizers-page">
    <header class="organizers-page__header">
      <h1 class="organizers-page__title">
        {{ t('organizers.title') }}
      </h1>
    </header>

    <div class="organizers-page__layout">
      <aside class="organizers-page__filters">
        <div class="organizers-page__filter-group">
          <label
            for="specialization-filter"
            class="organizers-page__filter-label"
          >
            {{ t('organizers.filters.specialization') }}
          </label>
          <select
            id="specialization-filter"
            class="organizers-page__select"
            :value="selectedSpecialization"
            @change="updateFilter('specialization', ($event.target as HTMLSelectElement).value)"
          >
            <option value="">
              {{ t('organizers.filters.allSpecializations') }}
            </option>
            <option
              v-for="spec in specializations"
              :key="spec.id"
              :value="spec.slug"
            >
              {{ specializationLabel(spec) }}
            </option>
          </select>
        </div>

        <div class="organizers-page__filter-group">
          <label
            for="city-filter"
            class="organizers-page__filter-label"
          >
            {{ t('organizers.filters.city') }}
          </label>
          <select
            id="city-filter"
            class="organizers-page__select"
            :value="selectedCity"
            @change="updateFilter('city', ($event.target as HTMLSelectElement).value)"
          >
            <option value="">
              {{ t('organizers.filters.allCities') }}
            </option>
            <option
              v-for="city in cities"
              :key="city"
              :value="city"
            >
              {{ city }}
            </option>
          </select>
        </div>

        <fieldset class="organizers-page__filter-group organizers-page__filter-group--fieldset">
          <legend class="organizers-page__filter-label">
            {{ t('organizers.filters.format') }}
          </legend>
          <div class="organizers-page__checkbox-group">
            <label
              v-for="option in formatOptions"
              :key="option.value"
              class="organizers-page__checkbox-label"
            >
              <input
                type="checkbox"
                class="organizers-page__checkbox"
                :value="option.value"
                :checked="selectedFormats.includes(option.value)"
                @change="toggleFormat(option.value)"
              />
              {{ option.label }}
            </label>
          </div>
        </fieldset>
      </aside>

      <main class="organizers-page__content">
        <p class="organizers-page__count">
          {{ t('organizers.found', { count: String(organizersCount) }) }}
        </p>

        <div
          v-if="pending"
          class="organizers-page__status"
        >
          {{ t('common.loading') }}
        </div>

        <div
          v-else-if="organizers && organizers.length > 0"
          class="organizers-page__grid"
        >
          <OrganizerCatalogCard
            v-for="organizer in organizers"
            :key="organizer.id"
            :organizer="organizer"
          />
        </div>

        <div
          v-else
          class="organizers-page__status"
        >
          {{ t('organizers.empty') }}
        </div>
      </main>
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

.organizers-page__layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: var(--spacing-xl);
  align-items: start;
}

.organizers-page__filters {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  padding: var(--spacing-lg);
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  border: var(--border-width) solid var(--color-border);
}

.organizers-page__filter-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.organizers-page__filter-group--fieldset {
  border: none;
  margin: 0;
  padding: 0;
}

.organizers-page__filter-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.organizers-page__select {
  padding: var(--spacing-sm) var(--spacing-md);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-md);
  line-height: var(--line-height-normal);
  appearance: auto;
}

.organizers-page__select:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}

.organizers-page__checkbox-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.organizers-page__checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--font-size-md);
  color: var(--color-text);
  cursor: pointer;
}

.organizers-page__checkbox {
  width: 18px;
  height: 18px;
  accent-color: var(--color-primary);
}

.organizers-page__content {
  min-width: 0;
}

.organizers-page__count {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin: 0 0 var(--spacing-md) 0;
}

.organizers-page__status {
  text-align: center;
  padding: var(--spacing-2xl);
  font-size: var(--font-size-lg);
  color: var(--color-text-muted);
}

.organizers-page__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--spacing-lg);
}

@media (max-width: 768px) {
  .organizers-page__layout {
    grid-template-columns: 1fr;
  }
}
</style>
