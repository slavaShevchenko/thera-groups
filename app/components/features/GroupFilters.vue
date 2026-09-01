<script setup lang="ts">
interface Filters {
  q: string
  type: string
  format: string
  dateFrom: string
}

const props = withDefaults(
  defineProps<{
    modelValue: Filters
    submitLabel?: string
    totalCount?: number | null
    loading?: boolean
    live?: boolean
  }>(),
  {
    submitLabel: undefined,
    totalCount: null,
    loading: false,
    live: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: Filters]
  'submit': []
}>()

const { t } = useLocale()

const formats = ['ONLINE', 'OFFLINE', 'HYBRID'] as const

const typeOptions = computed(() => [
  { value: '', label: t('filters.allTypes') },
  ...Object.entries(t('groupTypes') as Record<string, string>).map(([value, label]) => ({
    value,
    label,
  })),
])

const hasActiveFilters = computed(() =>
  props.modelValue.q
  || props.modelValue.type
  || props.modelValue.format
  || props.modelValue.dateFrom,
)

function updateField<K extends keyof Filters>(key: K, value: Filters[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}

function toggleFormat(format: string) {
  const current = props.modelValue.format
  updateField('format', current === format ? '' : format)
}

function resetFilters() {
  emit('update:modelValue', { q: '', type: '', format: '', dateFrom: '' })
}

function onSubmit() {
  emit('submit')
}

function openDatePicker(e: Event) {
  const input = e.currentTarget as HTMLInputElement
  if (typeof input.showPicker === 'function') {
    try {
      input.showPicker()
    }
    catch {
      input.focus()
    }
  }
}

function formatLabel(format: string) {
  const map: Record<string, string> = {
    ONLINE: t('common.formats.online'),
    OFFLINE: t('common.formats.offline'),
    HYBRID: t('common.formats.hybrid'),
  }
  return map[format] ?? format
}

function pluralGroups(n: number) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return t('filters.groupOne')
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return t('filters.groupFew')
  return t('filters.groupsFound')
}

const displayCount = computed(() => {
  if (props.totalCount === null) return 0
  return props.totalCount > 99 ? 99 : props.totalCount
})

const countLabel = computed(() =>
  props.totalCount !== null && props.totalCount > 99
    ? '99+'
    : String(props.totalCount ?? 0),
)

const countText = computed(() =>
  `${countLabel.value} ${pluralGroups(displayCount.value)}`,
)

const buttonLabel = computed(() => {
  if (props.totalCount !== null) {
    const prefix = props.submitLabel || t('filters.show')
    return `${prefix} ${countText.value}`
  }
  return props.submitLabel || t('filters.apply')
})
</script>

<template>
  <div class="group-filters">
    <form
      class="group-filters__bar"
      @submit.prevent="onSubmit"
    >
      <div class="group-filters__field group-filters__field--search">
        <UiIcon
          name="search"
          :size="18"
          class="group-filters__icon"
        />
        <input
          :value="modelValue.q"
          type="search"
          class="group-filters__input"
          :placeholder="t('filters.searchPlaceholder')"
          @input="updateField('q', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="group-filters__divider"></div>

      <div class="group-filters__field group-filters__field--type">
        <span class="group-filters__label">{{ t('filters.typeLabel') }}</span>
        <UiSelect
          class="group-filters__type-select"
          :model-value="modelValue.type"
          :options="typeOptions"
          @update:model-value="updateField('type', $event)"
        />
      </div>

      <div class="group-filters__divider"></div>

      <div class="group-filters__field group-filters__field--format">
        <span class="group-filters__label">{{ t('filters.formatLabel') }}</span>
        <div
          class="group-filters__segment"
          role="group"
          :aria-label="t('groups.format')"
        >
          <button
            type="button"
            class="group-filters__segment-btn"
            :class="{ 'group-filters__segment-btn--active': !modelValue.format }"
            @click="toggleFormat('')"
          >
            {{ t('filters.anyFormat') }}
          </button>
          <button
            v-for="fmt in formats"
            :key="fmt"
            type="button"
            class="group-filters__segment-btn"
            :class="{ 'group-filters__segment-btn--active': modelValue.format === fmt }"
            @click="toggleFormat(fmt)"
          >
            {{ formatLabel(fmt) }}
          </button>
        </div>
      </div>

      <div class="group-filters__divider"></div>

      <div class="group-filters__field group-filters__field--date">
        <span class="group-filters__label">{{ t('filters.dateFrom') }}</span>
        <input
          :value="modelValue.dateFrom"
          type="date"
          class="group-filters__input group-filters__input--date"
          @input="updateField('dateFrom', ($event.target as HTMLInputElement).value)"
          @click="openDatePicker"
        />
      </div>

      <UiButton
        v-if="!live"
        type="submit"
        class="group-filters__submit"
        :disabled="loading"
      >
        <span
          v-if="loading"
          class="group-filters__spinner"
          aria-hidden="true"
        ></span>
        {{ buttonLabel }}
      </UiButton>

      <span
        v-else
        class="group-filters__live-count"
        role="status"
      >
        <span
          v-if="loading"
          class="group-filters__spinner group-filters__spinner--inline"
          aria-hidden="true"
        ></span>
        <template v-if="totalCount !== null">
          {{ t('filters.found') }} {{ countText }}
        </template>
      </span>
    </form>

    <div
      v-if="hasActiveFilters"
      class="group-filters__footer"
    >
      <button
        type="button"
        class="group-filters__reset"
        @click="resetFilters"
      >
        <UiIcon
          name="x"
          :size="16"
        />
        {{ t('filters.reset') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.group-filters {
  margin-bottom: var(--spacing-2xl);
  position: relative;
}

.group-filters__bar {
  display: flex;
  align-items: center;
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: var(--spacing-md);
  gap: var(--spacing-sm);
}

.group-filters__field {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  min-width: 0;
}

.group-filters__field--search {
  flex: 1 1 220px;
  flex-direction: row;
  align-items: center;
  gap: var(--spacing-xs);
}

.group-filters__field--type {
  flex: 0 1 190px;
  min-width: 150px;
}

.group-filters__field--format {
  flex: 0 0 auto;
}

.group-filters__field--date {
  flex: 0 1 170px;
  min-width: 150px;
}

.group-filters__label {
  margin-bottom: var(--spacing-xs);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  line-height: 1;
}

.group-filters__icon {
  flex-shrink: 0;
  color: var(--color-text-muted);
}

.group-filters__input {
  width: 100%;
  border: none;
  background: transparent;
  font-family: var(--font-family-base);
  font-size: var(--font-size-md);
  color: var(--color-text);
  outline: none;
  padding: 0;
}

.group-filters__input::placeholder {
  color: var(--color-text-muted);
}

.group-filters__input--date:invalid,
.group-filters__input--date:empty {
  color: var(--color-text-muted);
}

.group-filters__type-select :deep(.ui-select__field) {
  border: none;
  background: transparent;
  box-shadow: none;
  border-radius: 0;
  padding: 0;
  height: auto;
  font-size: var(--font-size-md);
  color: var(--color-text);
}

.group-filters__type-select :deep(.ui-select__field:focus) {
  box-shadow: none;
}

.group-filters__divider {
  width: 1px;
  height: 2.25rem;
  background: var(--color-border);
  flex-shrink: 0;
}

.group-filters__segment {
  display: flex;
  gap: 2px;
  background: var(--color-background);
  border-radius: var(--radius-md);
  padding: 2px;
}

.group-filters__segment-btn {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-family: var(--font-family-base);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition-base);
  white-space: nowrap;
}

.group-filters__segment-btn:hover {
  color: var(--color-text);
}

.group-filters__segment-btn--active,
.group-filters__segment-btn--active:hover {
  background: var(--color-primary);
  color: var(--color-surface);
}

.group-filters__submit {
  flex-shrink: 0;
  margin-left: auto;
  position: relative;
}

.group-filters__live-count {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  margin-left: auto;
  flex-shrink: 0;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  white-space: nowrap;
}

.group-filters__spinner {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 1rem;
  height: 1rem;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: var(--radius-full);
  animation: group-filters-spin 0.6s linear infinite;
}

.group-filters__spinner--inline {
  position: static;
  inset: auto;
  margin: 0;
  width: 0.9rem;
  height: 0.9rem;
}

@keyframes group-filters-spin {
  to {
    transform: rotate(360deg);
  }
}

.group-filters__footer {
  padding: var(--spacing-xs) var(--spacing-sm) 0;
  position: absolute;
  right: 0;
  top: 100%;
}

.group-filters__reset {
  display: flex;
  align-items: center;
  border: none;
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-family: var(--font-family-base);
  font-size: var(--font-size-sm);
  cursor: pointer;
  padding: var(--spacing-xs) var(--spacing-sm);
  transition: color var(--transition-base);
}

.group-filters__reset:hover {
  color: var(--color-primary);
}

@media (max-width: 1100px) {
  .group-filters__bar {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-sm);
    align-items: center;
  }

  .group-filters__field--search {
    grid-column: 1 / -1;
  }

  .group-filters__field--format {
    grid-column: 1 / -1;
  }

  .group-filters__submit {
    grid-column: 1 / -1;
    margin-left: 0;
  }

  .group-filters__live-count {
    grid-column: 1 / -1;
    margin-left: 0;
    justify-content: center;
  }

  .group-filters__divider {
    display: none;
  }
}

@media (max-width: 560px) {
  .group-filters__bar {
    grid-template-columns: 1fr;
  }
}
</style>
