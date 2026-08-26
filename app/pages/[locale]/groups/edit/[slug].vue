<script setup lang="ts">
const { t, locale } = useLocale()
const { user, isLoading: isUserLoading } = useUser()
const route = useRoute()
const slug = computed(() => route.params.slug as string)

const { formData, isSaving, lastSaved, checklist, isReadyToPublish, loadGroup, currentSlug, flushSave } = useGroupForm(slug)

interface CategoryOption {
  id: string
  name: string
}

const categories = ref<CategoryOption[]>([])
const isPublishing = ref(false)

const groupTypeOptions = computed(() => {
  const types = t('groupTypes') as Record<string, string>
  return Object.entries(types).map(([key, label]) => ({ key, label }))
})

onMounted(async () => {
  categories.value = await $fetch<CategoryOption[]>('/api/categories')
})

// Guard + загрузка группы
watch(isUserLoading, (loading) => {
  if (loading) return

  if (!user.value || user.value.role !== 'ORGANIZER') {
    navigateTo(`/${locale.value}/`)
    return
  }

  loadGroup(slug.value)
}, { immediate: true })

// Публикация группы
async function publishGroup() {
  if (!isReadyToPublish.value) return

  isPublishing.value = true
  try {
    // Сначала сохраняем всё что в debounce ещё не ушло
    await flushSave()

    await $fetch(`/api/groups/${currentSlug.value}`, {
      method: 'PATCH',
      body: { status: 'PUBLISHED' },
    })

    navigateTo(`/${locale.value}/groups/${currentSlug.value}`)
  }
  catch {
    // Publish error handled by UI state
  }
  finally {
    isPublishing.value = false
  }
}

// Предпросмотр
function previewGroup() {
  window.open(`/${locale.value}/groups/${currentSlug.value}`, '_blank')
}

// Удаление черновика
async function deleteDraft() {
  if (!confirm(t('groups.edit.confirmDelete'))) return

  try {
    await $fetch(`/api/groups/${currentSlug.value}`, { method: 'DELETE' })
    navigateTo(`/${locale.value}/groups/my`)
  }
  catch {
    // Delete error handled by UI state
  }
}

useHead({ title: () => t('groups.edit.title') })
</script>

<template>
  <div class="group-edit-page">
    <div class="group-edit-layout">
      <!-- Левая колонка: форма -->
      <div class="group-edit-form">
        <h1 class="group-edit__title">
          {{ t('groups.edit.title') }}
        </h1>

        <!-- Секция: Основне -->
        <fieldset class="group-edit__section">
          <legend class="group-edit__section-title">
            {{ t('groups.edit.sections.base') }}
          </legend>

          <div class="group-edit__field">
            <label class="group-edit__label">
              {{ t('groups.edit.title') }} *
            </label>
            <input
              v-model="formData.title"
              type="text"
              class="group-edit__input"
              :placeholder="t('groups.edit.titlePlaceholder')"
            />
          </div>

          <div class="group-edit__field">
            <label class="group-edit__label">
              {{ t('groups.edit.description') }} *
              <span class="group-edit__char-count">
                {{ formData.description.length }} / 100+
              </span>
            </label>
            <textarea
              v-model="formData.description"
              class="group-edit__input group-edit__textarea"
              rows="6"
              :placeholder="t('groups.edit.descriptionPlaceholder')"
            ></textarea>
          </div>

          <div class="group-edit__row">
            <div class="group-edit__field">
              <label class="group-edit__label">
                {{ t('groups.edit.category') }} *
              </label>
              <select
                v-model="formData.categoryId"
                class="group-edit__select"
              >
                <option
                  value=""
                  disabled
                >
                  {{ t('groups.edit.selectCategory') }}
                </option>
                <option
                  v-for="cat in categories"
                  :key="cat.id"
                  :value="cat.id"
                >
                  {{ cat.name }}
                </option>
              </select>
            </div>

            <div class="group-edit__field">
              <label class="group-edit__label">
                {{ t('groups.edit.type') }} *
              </label>
              <select
                v-model="formData.type"
                class="group-edit__select"
              >
                <option
                  v-for="opt in groupTypeOptions"
                  :key="opt.key"
                  :value="opt.key"
                >
                  {{ opt.label }}
                </option>
              </select>
            </div>
          </div>
        </fieldset>

        <!-- Секция: Деталі -->
        <fieldset class="group-edit__section">
          <legend class="group-edit__section-title">
            {{ t('groups.edit.sections.details') }}
          </legend>

          <div class="group-edit__field">
            <label class="group-edit__label">
              {{ t('groups.edit.format') }} *
            </label>
            <div class="group-edit__format-cards">
              <label
                v-for="format in ['ONLINE', 'OFFLINE', 'HYBRID']"
                :key="format"
                class="group-edit__format-card"
                :class="{ 'group-edit__format-card--active': formData.format === format }"
              >
                <input
                  v-model="formData.format"
                  type="radio"
                  :value="format"
                  class="group-edit__radio"
                />
                <span class="group-edit__format-icon">
                  {{ format === 'ONLINE' ? '💻' : format === 'OFFLINE' ? '🏢' : '🔄' }}
                </span>
                <span class="group-edit__format-label">
                  {{ t(`common.formats.${format.toLowerCase()}`) }}
                </span>
              </label>
            </div>
          </div>

          <div class="group-edit__row">
            <div class="group-edit__field">
              <label class="group-edit__label">
                {{ t('groups.edit.startDate') }} *
              </label>
              <input
                v-model="formData.startDate"
                type="datetime-local"
                class="group-edit__input"
              />
            </div>

            <div class="group-edit__field">
              <label class="group-edit__label">
                {{ t('groups.edit.endDate') }}
              </label>
              <input
                v-model="formData.endDate"
                type="datetime-local"
                class="group-edit__input"
              />
            </div>
          </div>

          <div
            v-if="formData.format === 'OFFLINE' || formData.format === 'HYBRID'"
            class="group-edit__field"
          >
            <label class="group-edit__label">
              {{ t('groups.edit.location') }} *
            </label>
            <input
              v-model="formData.location"
              type="text"
              class="group-edit__input"
              :placeholder="t('groups.edit.locationPlaceholder')"
            />
          </div>

          <div class="group-edit__row">
            <div class="group-edit__field">
              <label class="group-edit__label">
                {{ t('groups.edit.price') }}
              </label>
              <div class="group-edit__price-wrapper">
                <input
                  v-model.number="formData.price"
                  type="number"
                  class="group-edit__input"
                  :disabled="formData.price === null"
                  placeholder="0"
                  min="0"
                />
                <span class="group-edit__currency">₴</span>
              </div>
              <label class="group-edit__checkbox">
                <input
                  v-model="formData.price"
                  type="checkbox"
                  :true-value="null"
                  :false-value="0"
                />
                {{ t('groups.edit.free') }}
              </label>
            </div>

            <div class="group-edit__field">
              <label class="group-edit__label">
                {{ t('groups.edit.maxParticipants') }}
              </label>
              <input
                v-model.number="formData.maxParticipants"
                type="number"
                class="group-edit__input"
                placeholder="10"
                min="1"
              />
            </div>
          </div>
        </fieldset>

        <!-- Секція: Питання -->
        <fieldset class="group-edit__section">
          <legend class="group-edit__section-title">
            {{ t('groups.edit.sections.questions') }}
          </legend>

          <GroupQuestionsBuilder
            v-model="formData.questions"
            :disabled="isSaving"
          />
        </fieldset>
      </div>

      <!-- Правая колонка: sticky sidebar -->
      <aside class="group-edit-sidebar">
        <div class="group-edit-sidebar__status">
          <div
            v-if="isSaving"
            class="group-edit-sidebar__saving"
          >
            ⏳ {{ t('groups.edit.autosave.saving') }}
          </div>
          <div
            v-else-if="lastSaved"
            class="group-edit-sidebar__saved"
          >
            ✓ {{ t('groups.edit.autosave.saved') }}
          </div>
        </div>

        <!-- Чек-лист -->
        <div class="group-edit-sidebar__checklist">
          <h3 class="group-edit-sidebar__checklist-title">
            {{ t('groups.edit.checklist.title') }}
          </h3>
          <ul class="group-edit-sidebar__checklist-items">
            <li :class="{ 'checklist-item--done': checklist.title }">
              {{ checklist.title ? '✅' : '⬜' }} {{ t('groups.edit.checklist.titleItem') }}
            </li>
            <li :class="{ 'checklist-item--done': checklist.description }">
              {{ checklist.description ? '✅' : '⬜' }} {{ t('groups.edit.checklist.description') }}
            </li>
            <li :class="{ 'checklist-item--done': checklist.category }">
              {{ checklist.category ? '✅' : '⬜' }} {{ t('groups.edit.checklist.category') }}
            </li>
            <li :class="{ 'checklist-item--done': checklist.type }">
              {{ checklist.type ? '✅' : '⬜' }} {{ t('groups.edit.checklist.type') }}
            </li>
            <li :class="{ 'checklist-item--done': checklist.startDate }">
              {{ checklist.startDate ? '✅' : '⬜' }} {{ t('groups.edit.checklist.startDate') }}
            </li>
            <li :class="{ 'checklist-item--done': checklist.format }">
              {{ checklist.format ? '✅' : '⬜' }} {{ t('groups.edit.checklist.format') }}
            </li>
            <li :class="{ 'checklist-item--done': checklist.questions }">
              {{ checklist.questions ? '⚠️' : '⬜' }} {{ t('groups.edit.checklist.questions') }}
            </li>
          </ul>
        </div>

        <!-- Действия -->
        <div class="group-edit-sidebar__actions">
          <button
            class="group-edit-sidebar__button group-edit-sidebar__button--primary"
            :disabled="!isReadyToPublish || isPublishing"
            @click="publishGroup"
          >
            {{ t('groups.edit.publish') }}
          </button>

          <button
            class="group-edit-sidebar__button"
            @click="previewGroup"
          >
            {{ t('groups.edit.preview') }}
          </button>

          <button
            v-if="formData.status === 'DRAFT'"
            class="group-edit-sidebar__button group-edit-sidebar__button--danger"
            @click="deleteDraft"
          >
            {{ t('groups.edit.deleteDraft') }}
          </button>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.group-edit-page {
  padding: var(--spacing-xl) var(--spacing-lg);
  max-width: 1400px;
  margin: 0 auto;
}

.group-edit-layout {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: var(--spacing-2xl);
}

@media (max-width: 1024px) {
  .group-edit-layout {
    grid-template-columns: 1fr;
  }

  .group-edit-sidebar {
    order: -1;
  }
}

.group-edit__title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  margin: 0 0 var(--spacing-xl);
}

.group-edit__section {
  border: none;
  border-bottom: var(--border-width) solid var(--color-border);
  padding: 0 0 var(--spacing-xl);
  margin: 0 0 var(--spacing-xl);
}

.group-edit__section:last-of-type {
  border-bottom: none;
  margin-bottom: 0;
}

.group-edit__section-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--spacing-lg);
  color: var(--color-text);
}

.group-edit__field {
  margin-bottom: var(--spacing-md);
}

.group-edit__label {
  display: flex;
  justify-content: space-between;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  margin-bottom: var(--spacing-xs);
}

.group-edit__char-count {
  color: var(--color-text-muted);
  font-weight: var(--font-weight-normal);
}

.group-edit__input,
.group-edit__select {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
  font-family: var(--font-family-base);
  color: var(--color-text);
  background: var(--color-background);
}

.group-edit__input:focus,
.group-edit__select:focus {
  border-color: var(--color-primary);
  outline: none;
  box-shadow: 0 0 0 2px var(--color-focus-ring);
}

.group-edit__textarea {
  resize: vertical;
  min-height: 120px;
}

.group-edit__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
}

.group-edit__format-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-sm);
}

.group-edit__format-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--spacing-md);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-base);
}

.group-edit__format-card:hover {
  border-color: var(--color-primary);
}

.group-edit__format-card--active {
  border-color: var(--color-primary);
  background: rgba(var(--color-primary-rgb), 0.05);
}

.group-edit__radio {
  display: none;
}

.group-edit__format-icon {
  font-size: 2rem;
  margin-bottom: var(--spacing-xs);
}

.group-edit__format-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.group-edit__price-wrapper {
  position: relative;
}

.group-edit__currency {
  position: absolute;
  right: var(--spacing-md);
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-muted);
  pointer-events: none;
}

.group-edit__checkbox {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  margin-top: var(--spacing-xs);
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.group-edit__tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.group-edit__tag {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-full);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all var(--transition-base);
}

.group-edit__tag:hover {
  border-color: var(--color-primary);
}

.group-edit__tag--active {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}

.group-edit__tag-checkbox {
  display: none;
}

.group-edit-sidebar {
  position: sticky;
  top: 80px;
  align-self: start;
}

.group-edit-sidebar__status {
  margin-bottom: var(--spacing-md);
  font-size: var(--font-size-sm);
  text-align: center;
}

.group-edit-sidebar__saving {
  color: var(--color-text-muted);
}

.group-edit-sidebar__saved {
  color: var(--color-success);
}

.group-edit-sidebar__checklist {
  background: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.group-edit-sidebar__checklist-title {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
  margin: 0 0 var(--spacing-sm);
}

.group-edit-sidebar__checklist-items {
  list-style: none;
  padding: 0;
  margin: 0;
}

.group-edit-sidebar__checklist-items li {
  font-size: var(--font-size-sm);
  padding: var(--spacing-xs) 0;
  color: var(--color-text-muted);
}

.group-edit-sidebar__checklist-items li.checklist-item--done {
  color: var(--color-text);
}

.group-edit-sidebar__actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.group-edit-sidebar__button {
  padding: var(--spacing-sm) var(--spacing-md);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all var(--transition-base);
}

.group-edit-sidebar__button:hover:not(:disabled) {
  border-color: var(--color-primary);
  background: var(--color-surface);
}

.group-edit-sidebar__button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.group-edit-sidebar__button--primary {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}

.group-edit-sidebar__button--primary:hover:not(:disabled) {
  background: var(--color-primary-dark);
  border-color: var(--color-primary-dark);
}

.group-edit-sidebar__button--danger {
  color: var(--color-error);
  border-color: var(--color-error);
}

.group-edit-sidebar__button--danger:hover:not(:disabled) {
  background: var(--color-error);
  color: #fff;
}

@media (max-width: 640px) {
  .group-edit__row,
  .group-edit__format-cards {
    grid-template-columns: 1fr;
  }
}
</style>
