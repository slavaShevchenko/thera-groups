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
  }>(),
  {
    submitLabel: undefined,
    totalCount: null,
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

function formatLabel(format: string) {
  const map: Record<string, string> = {
    ONLINE: t('common.formats.online'),
    OFFLINE: t('common.formats.offline'),
    HYBRID: t('common.formats.hybrid'),
  }
  return map[format] ?? format
}
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
        <UiSelect
          :model-value="modelValue.type"
          :options="typeOptions"
          :placeholder="t('filters.allTypes')"
          @update:model-value="updateField('type', $event)"
        />
      </div>

      <div class="group-filters__divider"></div>

      <div class="group-filters__field group-filters__field--format">
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
        <input
          :value="modelValue.dateFrom"
          type="date"
          class="group-filters__input"
          :placeholder="t('filters.dateFrom')"
          @input="updateField('dateFrom', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <UiButton
        type="submit"
        class="group-filters__submit"
      >
        <template v-if="submitLabel">
          {{ submitLabel }}
        </template>
        <template v-else-if="totalCount !== null">
          {{ t('filters.show') }} {{ totalCount }} {{ t('filters.groupsFound') }}
        </template>
        <template v-else>
          {{ t('filters.apply') }}
        </template>
      </UiButton>
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
        {{ t('filters.reset') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.group-filters {
  margin-bottom: var(--spacing-xl);
}

.group-filters__bar {
  display: grid;
  grid-template-columns: 2fr 1.2fr 1.4fr 1fr auto;
  align-items: center;
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: var(--spacing-sm);
  gap: 0;
}

.group-filters__field {
  padding: var(--spacing-xs) var(--spacing-sm);
}

.group-filters__field--search {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
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
  padding: var(--spacing-xs) 0;
}

.group-filters__input::placeholder {
  color: var(--color-text-muted);
}

.group-filters__input[type="date"] {
  color: var(--color-text);
}

.group-filters__divider {
  width: 1px;
  height: 2rem;
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

.group-filters__segment-btn--active {
  background: var(--color-primary);
  color: var(--color-surface);
}

.group-filters__submit {
  flex-shrink: 0;
  margin: 0 var(--spacing-xs);
}

.group-filters__footer {
  display: flex;
  justify-content: flex-end;
  padding: var(--spacing-xs) var(--spacing-sm) 0;
}

.group-filters__reset {
  border: none;
  background: transparent;
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

@media (max-width: 900px) {
  .group-filters__bar {
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-xs);
  }

  .group-filters__field--search {
    grid-column: 1 / -1;
  }

  .group-filters__field--format {
    grid-column: 1 / -1;
  }

  .group-filters__field--date {
    grid-column: 1 / -1;
  }

  .group-filters__submit {
    grid-column: 1 / -1;
    margin: var(--spacing-xs) 0 0;
  }

  .group-filters__divider {
    display: none;
  }
}
</style>
