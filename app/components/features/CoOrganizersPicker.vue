<script setup lang="ts">
interface CoOrganizer {
  userId: string
  role: string
  userName?: string
  avatarUrl?: string | null
}

interface OrganizerSearchResult {
  id: string
  firstName: string
  lastName: string
  email: string
  avatarUrl?: string | null
}

const props = defineProps<{
  modelValue: CoOrganizer[]
  ownerId: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: CoOrganizer[]]
}>()

const { t } = useLocale()

const searchQuery = ref('')
const searchResults = ref<{ id: string, label: string, sublabel: string, avatarUrl: string | null }[]>([])
const isSearching = ref(false)

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
      const exclude = props.modelValue.map(c => c.userId).concat(props.ownerId).join(',')
      const data = await $fetch<OrganizerSearchResult[]>('/api/organizers/search', {
        params: { q, exclude },
      })
      searchResults.value = data.map(u => ({
        id: u.id,
        label: `${u.firstName} ${u.lastName}`,
        sublabel: u.email,
        avatarUrl: u.avatarUrl ?? null,
      }))
    }
    catch {
      searchResults.value = []
    }
    finally {
      isSearching.value = false
    }
  }, 300)
})

function addCoOrganizer(item: { id: string, label: string, avatarUrl?: string | null }) {
  emit('update:modelValue', [
    ...props.modelValue,
    {
      userId: item.id,
      role: '',
      userName: item.label,
      avatarUrl: item.avatarUrl ?? null,
    },
  ])
  searchQuery.value = ''
  searchResults.value = []
}

function removeCoOrganizer(index: number) {
  const updated = [...props.modelValue]
  updated.splice(index, 1)
  emit('update:modelValue', updated)
}

function updateRole(index: number, event: Event) {
  const updated = [...props.modelValue]
  updated[index] = { ...updated[index], role: (event.target as HTMLInputElement).value }
  emit('update:modelValue', updated)
}

function getInitial(name?: string): string {
  return (name ?? '').trim().charAt(0).toUpperCase() || '?'
}
</script>

<template>
  <div class="co-organizers-picker">
    <UiAutocomplete
      v-model="searchQuery"
      :items="searchResults"
      :loading="isSearching"
      :placeholder="t('groups.edit.searchOrganizers')"
      :empty-text="t('noResults')"
      @select="addCoOrganizer"
    />

    <div
      v-if="modelValue.length > 0"
      class="co-organizers-picker__list"
    >
      <div
        v-for="(co, index) in modelValue"
        :key="co.userId"
        class="co-organizers-picker__item"
      >
        <div class="co-organizers-picker__avatar">
          <img
            v-if="co.avatarUrl"
            :src="co.avatarUrl"
            :alt="co.userName"
            class="co-organizers-picker__avatar-img"
          />
          <span
            v-else
            class="co-organizers-picker__avatar-initial"
          >
            {{ getInitial(co.userName) }}
          </span>
        </div>

        <span class="co-organizers-picker__name">{{ co.userName }}</span>

        <input
          class="co-organizers-picker__role"
          :value="co.role"
          :placeholder="t('groups.edit.coOrganizerRolePlaceholder')"
          @input="updateRole(index, $event)"
        />

        <button
          type="button"
          class="co-organizers-picker__remove"
          :aria-label="t('common.actions.remove')"
          @click="removeCoOrganizer(index)"
        >
          &times;
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.co-organizers-picker {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.co-organizers-picker__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.co-organizers-picker__item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.co-organizers-picker__avatar {
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: var(--color-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.co-organizers-picker__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.co-organizers-picker__avatar-initial {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.co-organizers-picker__name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
  white-space: nowrap;
  flex-shrink: 0;
}

.co-organizers-picker__role {
  flex: 1;
  min-width: 0;
  padding: var(--spacing-xs) var(--spacing-sm);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-sm);
  font-family: var(--font-family-base);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  background: var(--color-background);
  transition: border-color var(--transition-base), box-shadow var(--transition-base);
}

.co-organizers-picker__role::placeholder {
  color: var(--color-text-muted);
  opacity: 0.7;
}

.co-organizers-picker__role:focus {
  border-color: var(--color-primary);
  outline: none;
  box-shadow: 0 0 0 2px var(--color-focus-ring);
}

.co-organizers-picker__remove {
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
  transition: background-color var(--transition-base), color var(--transition-base);
  flex-shrink: 0;
}

.co-organizers-picker__remove:hover {
  background: var(--color-background-accent);
  color: var(--color-error);
}

.co-organizers-picker__remove:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
</style>
