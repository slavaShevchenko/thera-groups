<script setup lang="ts">
import { LIMITS } from '~~/shared/constants/limits'

const { t, tRaw, locale } = useLocale()
const { user, isLoading: isUserLoading } = useUser()
const { can } = usePermissions()
const { startLoading, finishLoading, forceHide } = usePageLoading()
const route = useRoute()
const slug = computed(() => route.params.slug as string)

const { formData, groupOwnerId, isSaving, lastSaved, checklist, isReadyToPublish, loadGroup, currentSlug, flushSave } = useGroupForm(slug)

const isPublishing = ref(false)
const publishError = ref('')
const isDeleting = ref(false)
const deleteError = ref('')
const adminOrganizerId = ref('')
const isAdmin = computed(() => can('group.publish'))
const isCoOrganizer = computed<boolean | null>(() => {
  if (!user.value) return null
  if (user.value.role === 'ADMIN') return false
  if (!groupOwnerId.value) return null
  return groupOwnerId.value !== user.value.id
})

const groupTypeOptions = computed(() => {
  const types = tRaw('groupTypes') as Record<string, string>
  return Object.entries(types).map(([key, label]) => ({ key, label }))
})

const groupTypeSelectOptions = computed(() =>
  groupTypeOptions.value.map(opt => ({ value: opt.key, label: opt.label })),
)

async function openDatePicker(event: MouseEvent, field: 'startDate' | 'endDate') {
  const root = event.currentTarget as HTMLElement
  const input = root instanceof HTMLInputElement
    ? root
    : root.querySelector<HTMLInputElement>('input[type="datetime-local"]')

  if (!formData.value[field]) {
    const def = new Date()
    def.setHours(LIMITS.DEFAULT_START_HOUR, 0, 0, 0)
    formData.value[field] = field === 'endDate' && formData.value.startDate
      ? formData.value.startDate
      : toLocalInputValue(def)
    await nextTick()
  }

  input?.showPicker?.()
}

const priceAmountInput = computed({
  get: () => formData.value.priceAmount != null ? String(formData.value.priceAmount) : '',
  set: (val: string) => {
    const num = Number(val)
    formData.value.priceAmount = val === '' || isNaN(num) ? null : num
  },
})

const maxParticipantsInput = computed({
  get: () => formData.value.maxParticipants != null ? String(formData.value.maxParticipants) : '',
  set: (val: string) => {
    const num = Number(val)
    formData.value.maxParticipants = val === '' || isNaN(num) ? null : num
  },
})

const isFreePrice = computed({
  get: () => formData.value.priceAmount === 0,
  set: (val: boolean) => {
    formData.value.priceAmount = val ? 0 : null
  },
})

// Guard + загрузка группы
watch(isUserLoading, async (loading) => {
  if (loading) return

  if (!user.value || !can('group.create')) {
    forceHide()
    navigateTo(`/${locale.value}/`)
    return
  }

  startLoading()
  try {
    await loadGroup(slug.value)
  }
  finally {
    finishLoading()
  }
}, { immediate: true })

watch(() => formData.value.endDate, (newEnd) => {
  if (!newEnd || !formData.value.startDate) return

  if (new Date(newEnd) < new Date(formData.value.startDate)) {
    formData.value.endDate = ''
  }
})

// Відправка групи на модерацію (організатор) або публікація (адмін)
async function publishGroup() {
  if (!isReadyToPublish.value) return

  if (isAdmin.value && !adminOrganizerId.value) return

  isPublishing.value = true
  try {
    // Спочатку зберігаємо все що в debounce ще не пішло
    await flushSave()

    if (isAdmin.value) {
      // Адмін: зберігаємо organizerId + coOrganizers (без обраного організатора) + публікуємо
      const coOrganizers = formData.value.coOrganizers
        .filter(c => c.userId !== adminOrganizerId.value)
        .map(c => ({ userId: c.userId, role: c.role }))

      await $fetch(`/api/groups/${currentSlug.value}`, {
        method: 'PATCH',
        body: {
          organizerId: adminOrganizerId.value,
          coOrganizers,
          status: 'PUBLISHED',
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      navigateTo(`/${locale.value}/admin`)
    }
    else {
      // Організатор: звичайний флоу на модерацію
      await $fetch(`/api/groups/${currentSlug.value}`, {
        method: 'PATCH',
        body: { status: 'PENDING_REVIEW' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      navigateTo(`/${locale.value}/groups/my`)
    }
  }
  catch {
    publishError.value = t('errors.publishFailed')
  }
  finally {
    isPublishing.value = false
  }
}

// Передперегляд
function previewGroup() {
  window.open(`/${locale.value}/groups/${currentSlug.value}`, '_blank', 'noopener,noreferrer')
}

const showDeleteConfirm = ref(false)

// Видалення чернетки
function requestDeleteDraft() {
  showDeleteConfirm.value = true
}

async function confirmDeleteDraft() {
  isDeleting.value = true
  deleteError.value = ''
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await $fetch(`/api/groups/${currentSlug.value}`, { method: 'DELETE' } as any)
    navigateTo(`/${locale.value}/groups/my`)
  }
  catch {
    deleteError.value = t('errors.saveFailed')
    showDeleteConfirm.value = false
  }
  finally {
    isDeleting.value = false
  }
}

const isPendingReview = computed(() => formData.value.status === 'PENDING_REVIEW')
const isPublished = computed(() => formData.value.status === 'PUBLISHED')
const isRejected = computed(() => formData.value.status === 'REJECTED')

const isNewGroup = computed(() => !currentSlug.value)
const pageTitle = computed(() => isNewGroup.value ? t('groups.new.title') : t('groups.edit.title'))

useHead({
  title: () => pageTitle.value,
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
  ],
})
</script>

<template>
  <div class="group-edit-page">
    <div class="group-edit-layout">
      <!-- Левая колонка: форма -->
      <div class="group-edit-form">
        <h1 class="group-edit__title">
          {{ pageTitle }}
        </h1>

        <!-- Модерація: очікує схвалення -->
        <div
          v-if="isPendingReview && !isRejected"
          class="group-edit__moderation-banner group-edit__moderation-banner--pending"
        >
          <span
            class="group-edit__moderation-icon"
            aria-hidden="true"
          >⏳</span>
          {{ t('groups.edit.moderation.waitingApproval') }}
        </div>

        <!-- Модерація: відхилено з причиною -->
        <div
          v-if="isRejected"
          class="group-edit__moderation-banner group-edit__moderation-banner--rejected"
        >
          <span
            class="group-edit__moderation-icon"
            aria-hidden="true"
          >✕</span>
          <div class="group-edit__moderation-content">
            <strong>{{ t('groups.edit.moderation.rejected') }}</strong>
            <p class="group-edit__moderation-reason">
              {{ formData.rejectionReason }}
            </p>
          </div>
        </div>

        <!-- Опубліковано: не можна змінити статус -->
        <div
          v-if="isPublished"
          class="group-edit__moderation-banner group-edit__moderation-banner--published"
        >
          <span
            class="group-edit__moderation-icon"
            aria-hidden="true"
          >✓</span>
          {{ t('groups.my.statuses.PUBLISHED') }}
        </div>

        <!-- Співорганізатор: обмеження -->
        <div
          v-if="isCoOrganizer"
          class="group-edit__moderation-banner group-edit__moderation-banner--coorganizer"
        >
          {{ t('groups.edit.coOrganizerBanner') }}
        </div>

        <!-- Секция: Основне -->
        <fieldset class="group-edit__section">
          <legend class="group-edit__section-title">
            {{ t('groups.edit.sections.base') }}
          </legend>

          <div class="group-edit__field">
            <UiInput
              v-model="formData.title"
              :label="t('groups.edit.groupName')"
              :placeholder="t('groups.edit.titlePlaceholder')"
              required
            />
          </div>

          <div class="group-edit__field">
            <UiTextarea
              v-model="formData.description"
              :label="t('groups.edit.description')"
              :placeholder="t('groups.edit.descriptionPlaceholder')"
              :rows="6"
              required
            />
          </div>

          <div class="group-edit__field">
            <UiSelect
              v-model="formData.type"
              :label="t('groups.edit.type')"
              :options="groupTypeSelectOptions"
              :placeholder="t('groups.edit.selectType')"
              required
            />
          </div>
        </fieldset>

        <!-- Секция: Деталі -->
        <fieldset class="group-edit__section">
          <legend class="group-edit__section-title">
            {{ t('groups.edit.sections.details') }}
          </legend>

          <div class="group-edit__field">
            <label class="group-edit__label">
              {{ t('common.format') }} *
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
                  name="group-format"
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
              <UiInput
                v-model="formData.startDate"
                type="datetime-local"
                :label="t('common.startDate')"
                :placeholder="t('filters.datePlaceholder')"
                required
                @click="openDatePicker($event, 'startDate')"
              />
            </div>

            <div class="group-edit__field">
              <UiInput
                v-model="formData.endDate"
                type="datetime-local"
                :label="t('common.endDate')"
                :placeholder="t('filters.datePlaceholder')"
                :min="formData.startDate"
                :disabled="!formData.startDate"
                @click="formData.startDate && openDatePicker($event, 'endDate')"
              />
            </div>
          </div>

          <div
            v-if="formData.format === 'OFFLINE' || formData.format === 'HYBRID'"
            class="group-edit__field"
          >
            <UiInput
              v-model="formData.location"
              :label="t('common.location')"
              :placeholder="t('groups.edit.locationPlaceholder')"
              required
            />
          </div>

          <div class="group-edit__row">
            <div class="group-edit__field">
              <label class="group-edit__label">
                {{ t('groups.edit.price') }}
              </label>
              <div class="group-edit__price-row">
                <UiInput
                  v-model="priceAmountInput"
                  type="number"
                  min="0"
                  :disabled="isFreePrice"
                  :placeholder="t('groups.edit.pricePlaceholder')"
                  class="group-edit__price-input"
                />
                <select
                  v-model="formData.currency"
                  class="group-edit__currency-select"
                >
                  <option value="UAH">
                    {{ t('currencies.UAH') }}
                  </option>
                  <option value="USD">
                    {{ t('currencies.USD') }}
                  </option>
                  <option value="EUR">
                    {{ t('currencies.EUR') }}
                  </option>
                </select>
              </div>
              <label class="group-edit__checkbox">
                <input
                  v-model="isFreePrice"
                  type="checkbox"
                />
                {{ t('groups.edit.free') }}
              </label>
            </div>

            <div class="group-edit__field">
              <UiInput
                v-model="maxParticipantsInput"
                type="number"
                :label="t('groups.edit.maxParticipants')"
                placeholder="10"
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
          />
        </fieldset>

        <!-- Секція: Співведучі (тільки для власника) -->
        <fieldset
          v-if="isCoOrganizer === false"
          class="group-edit__section"
        >
          <legend class="group-edit__section-title">
            {{ t('common.coOrganizers') }}
          </legend>
          <p class="group-edit__section-hint">
            {{ t('groups.edit.coOrganizersHint') }}
          </p>
          <CoOrganizersPicker
            v-model="formData.coOrganizers"
            :owner-id="groupOwnerId"
            :is-admin="isAdmin"
            :organizer-id="adminOrganizerId"
            :current-user-id="user?.id"
            @update:organizer-id="adminOrganizerId = $event"
          />
        </fieldset>
      </div>

      <!-- Правая колонка: sticky sidebar -->
      <aside class="group-edit-sidebar">
        <div class="group-edit-sidebar__status">
          <div
            v-if="isSaving"
            class="group-edit-sidebar__saving"
            role="status"
            aria-live="polite"
          >
            <span aria-hidden="true">⏳</span> {{ t('groups.edit.autosave.saving') }}
          </div>
          <div
            v-else-if="lastSaved"
            class="group-edit-sidebar__saved"
            role="status"
            aria-live="polite"
          >
            <span aria-hidden="true">✓</span> {{ t('groups.edit.autosave.saved') }}
          </div>
        </div>

        <!-- Чек-лист -->
        <div class="group-edit-sidebar__checklist">
          <h3 class="group-edit-sidebar__checklist-title">
            {{ t('groups.edit.checklist.title') }}
          </h3>
          <ul class="group-edit-sidebar__checklist-items">
            <li :class="{ 'checklist-item--done': checklist.title }">
              <span aria-hidden="true">{{ checklist.title ? '✅' : '⬜' }}</span>
              <span :class="{ 'sr-only': checklist.title }">{{ checklist.title ? '' : '' }}</span>
              {{ t('groups.edit.checklist.titleItem') }}
            </li>
            <li :class="{ 'checklist-item--done': checklist.description }">
              <span aria-hidden="true">{{ checklist.description ? '✅' : '⬜' }}</span>
              {{ t('groups.edit.checklist.description') }}
            </li>
            <li :class="{ 'checklist-item--done': checklist.type }">
              <span aria-hidden="true">{{ checklist.type ? '✅' : '⬜' }}</span>
              {{ t('groups.edit.checklist.type') }}
            </li>
            <li :class="{ 'checklist-item--done': checklist.format }">
              <span aria-hidden="true">{{ checklist.format ? '✅' : '⬜' }}</span>
              {{ t('groups.edit.checklist.format') }}
            </li>
            <li :class="{ 'checklist-item--done': checklist.startDate }">
              <span aria-hidden="true">{{ checklist.startDate ? '✅' : '⬜' }}</span>
              {{ t('common.startDate') }}
            </li>
          </ul>
        </div>

        <!-- Дії -->
        <div class="group-edit-sidebar__actions">
          <UiButton
            v-if="isCoOrganizer === false && (formData.status === 'DRAFT' || isRejected || isAdmin)"
            :disabled="(!isReadyToPublish || isPublishing) || (isAdmin && !adminOrganizerId)"
            :loading="isPublishing"
            @click="publishGroup"
          >
            {{ isPublishing ? t('groups.publishing') : (isAdmin ? t('common.publish') : (formData.status === 'REJECTED' ? t('groups.edit.resubmit') : t('groups.edit.publish'))) }}
          </UiButton>

          <p
            v-if="isAdmin && !adminOrganizerId && formData.coOrganizers.length > 0"
            class="group-edit-sidebar__hint"
          >
            {{ t('groups.edit.selectOrganizerHint') }}
          </p>

          <div
            v-if="isPendingReview && !isRejected"
            class="group-edit-sidebar__status-label"
          >
            {{ t('common.underReview') }}
          </div>

          <div
            v-if="isPublished"
            class="group-edit-sidebar__status-label"
          >
            {{ t('groups.my.statuses.PUBLISHED') }}
          </div>

          <UiButton
            variant="secondary"
            @click="previewGroup"
          >
            {{ t('groups.edit.preview') }}
          </UiButton>

          <UiButton
            v-if="isCoOrganizer === false && formData.status === 'DRAFT'"
            variant="danger"
            @click="requestDeleteDraft"
          >
            {{ t('groups.edit.deleteDraft') }}
          </UiButton>
        </div>
      </aside>
    </div>

    <UiConfirmModal
      v-model="showDeleteConfirm"
      :title="t('groups.confirmDeleteTitle')"
      :message="t('groups.confirmDeleteMessage')"
      :loading="isDeleting"
      @confirm="confirmDeleteDraft"
    />

    <div
      v-if="publishError || deleteError"
      class="group-edit__error-toast"
      role="alert"
    >
      {{ publishError || deleteError }}
    </div>
  </div>
</template>

<style scoped>
.group-edit-page {
  padding: var(--spacing-xl) var(--spacing-lg);
  max-width: var(--container-width);
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

.group-edit__section-hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin: 0 0 var(--spacing-md);
}

.group-edit__field {
  margin-bottom: var(--spacing-md);
}

.group-edit__label {
  display: flex;
  justify-content: space-between;
  margin-bottom: calc(var(--spacing-xs) * 2);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
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

.group-edit__format-card:has(.group-edit__radio:focus-visible) {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.group-edit__format-icon {
  font-size: 2rem;
  margin-bottom: var(--spacing-xs);
}

.group-edit__format-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.group-edit__price-row {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
}

.group-edit__price-input {
  flex: 1;
}

.group-edit__currency-select {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  font-size: var(--font-size-sm);
  min-width: 120px;
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
  color: var(--color-white);
  border-color: var(--color-primary);
}

.group-edit__tag-checkbox {
  display: none;
}

.group-edit-sidebar {
  position: sticky;
  top: 100px;
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

.group-edit-sidebar__hint {
  font-size: var(--font-size-xs);
  color: var(--color-warning);
  margin: var(--spacing-xs) 0 0;
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
  margin-top: 0;
  margin-bottom: var(--spacing-md);
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

.group-edit-sidebar__checklist-items li + li {
  margin-top: var(--spacing-md);
}

.group-edit-sidebar__checklist-items li.checklist-item--done {
  color: var(--color-text);
}

.group-edit-sidebar__actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.group-edit__moderation-banner {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-xl);
  font-size: var(--font-size-sm);
}

.group-edit__moderation-banner--pending {
  background: var(--color-status-warning-bg);
  color: var(--color-status-warning-text);
  border: var(--border-width) solid var(--color-status-warning-border);
}

.group-edit__moderation-banner--rejected {
  background: var(--color-status-error-bg);
  color: var(--color-status-error-text);
  border: var(--border-width) solid var(--color-status-error-border);
}

.group-edit__moderation-banner--published {
  background: var(--color-status-success-bg);
  color: var(--color-status-success-text);
  border: var(--border-width) solid var(--color-status-success-border);
}

.group-edit__moderation-banner--coorganizer {
  background: var(--color-status-info-bg);
  color: var(--color-status-info-text);
  border: var(--border-width) solid var(--color-status-info-border);
}

.group-edit__moderation-icon {
  flex-shrink: 0;
  font-size: var(--font-size-lg);
  line-height: 1;
}

.group-edit__moderation-content {
  flex: 1;
  min-width: 0;
}

.group-edit__moderation-reason {
  margin: var(--spacing-xs) 0 0;
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

.group-edit-sidebar__status-label {
  text-align: center;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  background: var(--color-status-warning-bg);
  color: var(--color-status-warning-text);
}

.group-edit__error-toast {
  position: fixed;
  bottom: var(--spacing-lg);
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-error);
  color: var(--color-white);
  padding: var(--spacing-sm) var(--spacing-lg);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  z-index: var(--z-toast, 1000);
}

@media (max-width: 640px) {
  .group-edit__row,
  .group-edit__format-cards {
    grid-template-columns: 1fr;
  }
}
</style>
