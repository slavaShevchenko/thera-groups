<script setup lang="ts">
const { t, locale } = useLocale()

const searchTerm = ref('')
const selectedFormat = ref<string | null>(null)

const formats = ['online', 'offline', 'hybrid'] as const

function toggleFormat(format: string) {
  selectedFormat.value = selectedFormat.value === format ? null : format
}

function submitSearch() {
  const params = new URLSearchParams()

  if (searchTerm.value.trim()) {
    params.set('q', searchTerm.value.trim())
  }

  if (selectedFormat.value) {
    params.set('format', selectedFormat.value)
  }

  const query = params.toString()

  navigateTo(`/${locale.value}/groups${query ? `?${query}` : ''}`)
}
</script>

<template>
  <form
    class="group-search"
    role="search"
    :aria-label="t('components.groupSearch.ariaLabel')"
    @submit.prevent="submitSearch"
  >
    <div class="group-search__input-wrapper">
      <UiIcon
        name="search"
        :size="20"
        class="group-search__icon"
      />
      <input
        v-model="searchTerm"
        type="search"
        class="group-search__input"
        :placeholder="t('components.groupSearch.placeholder')"
        :aria-label="t('components.groupSearch.inputLabel')"
      />
    </div>

    <div class="group-search__formats">
      <button
        v-for="format in formats"
        :key="format"
        type="button"
        class="group-search__format-btn"
        :class="{ 'group-search__format-btn--active': selectedFormat === format }"
        :aria-pressed="selectedFormat === format"
        @click="toggleFormat(format)"
      >
        {{ t(`common.formats.${format}`) }}
      </button>
    </div>

    <UiButton
      type="submit"
      class="group-search__submit"
    >
      {{ t('components.groupSearch.submit') }}
    </UiButton>
  </form>
</template>

<style scoped>
.group-search {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  align-items: center;
  background: var(--color-surface);
  padding: var(--spacing-md);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  max-width: 640px;
}

.group-search__input-wrapper {
  flex: 1;
  min-width: 200px;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  transition: border-color var(--transition-base);
}

.group-search__input-wrapper:focus-within {
  border-color: var(--color-primary);
}

.group-search__icon {
  flex-shrink: 0;
  color: var(--color-text-muted);
}

.group-search__input {
  flex: 1;
  border: none;
  background: none;
  font-size: var(--font-size-md);
  color: var(--color-text);
  outline: none;
  min-width: 0;
}

.group-search__input::placeholder {
  color: var(--color-text-muted);
}

.group-search__formats {
  display: flex;
  gap: var(--spacing-xs);
}

.group-search__format-btn {
  padding: var(--spacing-sm) var(--spacing-md);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all var(--transition-base);
  white-space: nowrap;
}

.group-search__format-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.group-search__format-btn--active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-surface);
}

.group-search__format-btn--active:hover {
  background: var(--color-primary-hover);
  color: var(--color-surface);
}

.group-search__submit {
  padding: var(--spacing-sm) var(--spacing-xl);
  background: var(--color-primary);
  color: var(--color-surface);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: background var(--transition-base);
  white-space: nowrap;
}

.group-search__submit:hover {
  background: var(--color-primary-hover);
}

@media (max-width: 640px) {
  .group-search {
    flex-direction: column;
    align-items: stretch;
  }

  .group-search__submit {
    width: 100%;
  }
}
</style>
