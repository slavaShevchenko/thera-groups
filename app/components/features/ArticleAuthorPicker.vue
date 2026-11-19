<script setup lang="ts">
import type { OrganizerSearchResult } from '~~/types'

/**
 * The article byline picker: an organizer from the catalog, or a name typed in.
 *
 * Two inputs rather than a mode switch, because the rule they express is the one the database
 * enforces — `Article_author_single_source_check` allows exactly one of `authorId` and
 * `authorName`. Filling one clears the other here, so the form can never submit the pair the
 * validator and the CHECK both refuse. The alternative, a radio that hides one field, hides the
 * reason the other disappeared.
 *
 * The organizer search is `CoOrganizersPicker`'s, verbatim: same endpoint, same debounce, same
 * `UiAutocomplete`. It reads `profileId` where that one reads `id`, because `Article.authorId`
 * references `OrganizerProfile` and a co-organizer row references `User` — two vocabularies the
 * endpoint now returns side by side.
 */
const props = defineProps<{
  /** Read-only display name of an already-linked organizer; see `AdminArticleFormData`. */
  linkedAuthorName?: string | null
  error?: string
}>()

const authorId = defineModel<string | null>('authorId', { required: true })
const authorName = defineModel<string | null>('authorName', { required: true })

const { t } = useLocale()

/** Stable id for the visible label, so the combobox is named by it rather than by a copy of its text. */
const organizerLabelId = useId()

const searchQuery = ref('')
const isSearching = ref(false)
/** The label of an organizer picked in this session; the prop covers one loaded from the server. */
const pickedLabel = ref<string | null>(null)

interface AuthorSearchItem {
  /** The organizer **profile** id — what `Article.authorId` stores. */
  id: string
  label: string
  sublabel: string
  avatarUrl: string | null
}

const searchResults = ref<AuthorSearchItem[]>([])

let searchTimeout: ReturnType<typeof setTimeout> | null = null

watch(searchQuery, (q) => {
  if (searchTimeout) clearTimeout(searchTimeout)

  if (q.length < 2) {
    searchResults.value = []
    return
  }

  searchTimeout = setTimeout(async () => {
    isSearching.value = true
    try {
      const data = await $fetch<OrganizerSearchResult[]>('/api/organizers/search', { params: { q } })
      searchResults.value = data
        // A user with no organizer profile cannot be an author: `authorId` is a foreign key to
        // `OrganizerProfile`, and offering a row that would fail it is offering a broken form.
        .filter((u): u is OrganizerSearchResult & { profileId: string } => !!u.profileId)
        .map(u => ({
          id: u.profileId,
          label: `${u.firstName} ${u.lastName}`.trim(),
          sublabel: u.slug ?? '',
          avatarUrl: u.avatarUrl ?? null,
        }))
    }
    catch {
      // Silent by design: a failed search shows the autocomplete's own "no results" line, and
      // the byline is optional — an admin who cannot find somebody can still type their name.
      searchResults.value = []
    }
    finally {
      isSearching.value = false
    }
  }, 300)
})

onBeforeUnmount(() => {
  if (searchTimeout) clearTimeout(searchTimeout)
})

const selectedLabel = computed(() =>
  authorId.value ? (pickedLabel.value ?? props.linkedAuthorName ?? '') : '',
)

function selectOrganizer(item: { id: string, label: string }) {
  authorId.value = item.id
  pickedLabel.value = item.label
  authorName.value = null
  searchQuery.value = ''
  searchResults.value = []
}

function clearOrganizer() {
  authorId.value = null
  pickedLabel.value = null
}

/**
 * Typing a name releases the linked organizer.
 *
 * Only on a non-empty value: clearing the text field must not also drop a chosen organizer, or
 * the two inputs would fight and the last keystroke would always win.
 */
function onAuthorNameInput(value: string) {
  authorName.value = value
  if (value.trim() && authorId.value) clearOrganizer()
}
</script>

<template>
  <div class="author-picker">
    <p class="author-picker__hint">
      {{ t('admin.articles.authorHint') }}
    </p>

    <div class="author-picker__field">
      <span
        :id="organizerLabelId"
        class="author-picker__label"
      >
        {{ t('admin.articles.authorFromCatalog') }}
      </span>
      <UiAutocomplete
        v-model="searchQuery"
        :items="searchResults"
        :loading="isSearching"
        :placeholder="t('admin.articles.authorSearchPlaceholder')"
        :empty-text="t('common.noResults')"
        :labelledby="organizerLabelId"
        @select="selectOrganizer"
      />
    </div>

    <div
      v-if="selectedLabel"
      class="author-picker__selected"
    >
      <UiIcon
        name="check"
        :size="16"
        aria-hidden="true"
      />
      <span class="author-picker__selected-name">{{ selectedLabel }}</span>
      <button
        type="button"
        class="author-picker__clear"
        :aria-label="`${t('common.actions.remove')}: ${selectedLabel}`"
        @click="clearOrganizer"
      >
        &times;
      </button>
    </div>

    <UiInput
      :model-value="authorName ?? ''"
      :label="t('admin.articles.authorFreeText')"
      :placeholder="t('admin.articles.authorFreeTextPlaceholder')"
      :error="error"
      :max-chars="150"
      @update:model-value="onAuthorNameInput"
    />
  </div>
</template>

<style scoped>
.author-picker {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.author-picker__hint {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.author-picker__field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.author-picker__label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.author-picker__selected {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background-accent);
  color: var(--color-text-muted);
}

.author-picker__selected-name {
  flex: 1;
  min-width: 0;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.author-picker__clear {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  border: none;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--color-text-muted);
  font-size: var(--font-size-lg);
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color var(--transition-base), color var(--transition-base);
}

.author-picker__clear:hover {
  background: var(--color-surface);
  color: var(--color-error);
}

.author-picker__clear:focus-visible {
  outline: 2px solid var(--color-primary-text);
  outline-offset: 2px;
}
</style>
