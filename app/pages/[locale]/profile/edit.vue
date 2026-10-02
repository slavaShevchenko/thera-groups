<script setup lang="ts">
import type { OrganizerMe } from '~~/types'
import { LIMITS, PROFILE_LIMITS } from '~~/shared/constants/limits'

const { t, locale } = useLocale()
const { user, isLoading: isUserLoading } = useUser()
const { can } = usePermissions()
const { startLoading, finishLoading, forceHide } = usePageLoading()

const isProfileLoading = ref(true)
const loadError = ref(false)
const isSubmitting = ref(false)
const successMessage = ref('')
const submitError = ref('')
const formErrors = ref<Record<string, string>>({})

const avatarUrl = ref<string | null>(null)
const firstName = ref('')
const lastName = ref('')
const bio = ref('')
const qualification = ref('')
const experienceYears = ref(0)
const specializations = ref<string[]>([])
const specInput = ref('')
const workFormats = ref<string[]>([])
const languages = ref<string[]>([])
const city = ref('')
const education = ref<Array<{ id: string, value: string }>>([])
const professionalOrganization = ref('')
const professionalOrganizationStatus = ref('')
const telegramUrl = ref('')
const instagramUrl = ref('')
const linkedinUrl = ref('')
const whatsappUrl = ref('')
const facebookUrl = ref('')
const youtubeUrl = ref('')

const workFormatOptions = [
  { value: 'ONLINE', labelKey: 'common.online' },
  { value: 'OFFLINE', labelKey: 'common.offline' },
  { value: 'HYBRID', labelKey: 'common.formats.hybrid' },
]

function toggleWorkFormat(value: string) {
  const idx = workFormats.value.indexOf(value)
  if (idx === -1) {
    workFormats.value.push(value)
  }
  else {
    workFormats.value.splice(idx, 1)
  }
}

async function searchLanguages(query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return languageOptions.slice(0, 10).map(l => ({ id: l.code, label: l.label }))
  return languageOptions
    .filter(l => l.searchName.includes(q))
    .slice(0, 10)
    .map(l => ({ id: l.code, label: l.label }))
}

function onLanguageSelect(item: { id: string, label: string }) {
  if (!languages.value.includes(item.id)) {
    languages.value.push(item.id)
  }
}

function removeLanguage(code: string) {
  languages.value = languages.value.filter(l => l !== code)
}

function addSpecialization() {
  const val = specInput.value.trim()
  if (val && val.length <= PROFILE_LIMITS.SPECIALIZATION_MAX && !specializations.value.includes(val)) {
    specializations.value.push(val)
    specInput.value = ''
  }
}

function removeSpecialization(index: number) {
  specializations.value.splice(index, 1)
}

function addEducation() {
  education.value.push({ id: crypto.randomUUID(), value: '' })
}

function removeEducation(id: string) {
  education.value = education.value.filter(item => item.id !== id)
}

function validate(): boolean {
  const errors: Record<string, string> = {}
  const tooLong = (max: number) => t('errors.fieldTooLong', { max })
  const check = (key: string, value: string, max: number, isRequired: boolean) => {
    const trimmed = value.trim()
    if (isRequired && !trimmed) errors[key] = t('errors.requiredField')
    else if (trimmed.length > max) errors[key] = tooLong(max)
  }

  check('firstName', firstName.value, PROFILE_LIMITS.FIRST_NAME_MAX, true)
  check('lastName', lastName.value, PROFILE_LIMITS.LAST_NAME_MAX, true)
  check('bio', bio.value, PROFILE_LIMITS.BIO_MAX, false)
  check('qualification', qualification.value, PROFILE_LIMITS.QUALIFICATION_MAX, true)
  check('specInput', specInput.value, PROFILE_LIMITS.SPECIALIZATION_MAX, false)
  check('city', city.value, PROFILE_LIMITS.CITY_MAX, false)
  check('professionalOrganization', professionalOrganization.value, PROFILE_LIMITS.PROFESSIONAL_ORG_MAX, true)
  check('professionalOrganizationStatus', professionalOrganizationStatus.value, PROFILE_LIMITS.PROFESSIONAL_ORG_STATUS_MAX, true)
  check('telegramUrl', telegramUrl.value, PROFILE_LIMITS.SOCIAL_URL_MAX, false)
  check('instagramUrl', instagramUrl.value, PROFILE_LIMITS.SOCIAL_URL_MAX, false)
  check('linkedinUrl', linkedinUrl.value, PROFILE_LIMITS.SOCIAL_URL_MAX, false)
  check('whatsappUrl', whatsappUrl.value, PROFILE_LIMITS.SOCIAL_URL_MAX, false)
  check('facebookUrl', facebookUrl.value, PROFILE_LIMITS.SOCIAL_URL_MAX, false)
  check('youtubeUrl', youtubeUrl.value, PROFILE_LIMITS.SOCIAL_URL_MAX, false)

  if (specializations.value.some(s => s.length > PROFILE_LIMITS.SPECIALIZATION_MAX)) {
    errors.specializations = tooLong(PROFILE_LIMITS.SPECIALIZATION_MAX)
  }

  for (const item of education.value) {
    if (item.value.trim().length > PROFILE_LIMITS.EDUCATION_MAX) {
      errors[`education-${item.id}`] = tooLong(PROFILE_LIMITS.EDUCATION_MAX)
    }
  }

  formErrors.value = errors
  return Object.keys(errors).length === 0
}

function mapServerIssues(issues: Array<{ path: string, message: string }>) {
  const errors: Record<string, string> = { ...formErrors.value }
  for (const issue of issues) {
    const field = issue.path.split('.')[0]
    if (field && !errors[field]) {
      errors[field] = issue.message
    }
  }
  formErrors.value = errors
}

function onAvatarUploaded(url: string) {
  avatarUrl.value = url
}

async function loadProfile() {
  isProfileLoading.value = true
  loadError.value = false
  try {
    const data = await $fetch<OrganizerMe>('/api/organizers/me')

    firstName.value = data.firstName || ''
    lastName.value = data.lastName || ''
    bio.value = data.bio || ''
    qualification.value = data.qualification || ''
    avatarUrl.value = data.avatarUrl || null
    experienceYears.value = data.experienceYears || 0
    workFormats.value = data.workFormats || []
    languages.value = data.languages || []
    education.value = (data.education || []).map(value => ({ id: crypto.randomUUID(), value }))
    professionalOrganization.value = data.professionalOrganization || ''
    professionalOrganizationStatus.value = data.professionalOrganizationStatus || ''
    telegramUrl.value = data.telegramUrl || ''
    instagramUrl.value = data.instagramUrl || ''
    linkedinUrl.value = data.linkedinUrl || ''
    whatsappUrl.value = data.whatsappUrl || ''
    facebookUrl.value = data.facebookUrl || ''
    youtubeUrl.value = data.youtubeUrl || ''
    specializations.value = data.specializations || []
    city.value = data.city || ''
  }
  catch {
    loadError.value = true
  }
  finally {
    isProfileLoading.value = false
  }
}

async function handleSubmit() {
  if (!validate()) return

  isSubmitting.value = true
  successMessage.value = ''
  submitError.value = ''
  formErrors.value = {}

  const payload: Record<string, unknown> = {
    firstName: firstName.value.trim(),
    lastName: lastName.value.trim(),
    bio: bio.value.trim(),
    qualification: qualification.value.trim(),
    experienceYears: experienceYears.value,
    specializations: specializations.value,
    workFormats: workFormats.value,
    languages: languages.value,
    city: city.value.trim(),
    education: education.value.map(item => item.value.trim()).filter(Boolean),
    professionalOrganization: professionalOrganization.value.trim(),
    professionalOrganizationStatus: professionalOrganizationStatus.value.trim(),
    telegramUrl: telegramUrl.value.trim(),
    instagramUrl: instagramUrl.value.trim(),
    linkedinUrl: linkedinUrl.value.trim(),
    whatsappUrl: whatsappUrl.value.trim(),
    facebookUrl: facebookUrl.value.trim(),
    youtubeUrl: youtubeUrl.value.trim(),
  }

  try {
    await $fetch('/api/organizers/me', {
      method: 'PATCH',
      body: payload,
    })
    successMessage.value = t('profile.edit.success')
  }
  catch (error) {
    const err = error as { statusCode?: number, data?: { issues?: Array<{ path: string, message: string }> } }
    if (err?.statusCode === 400 && err.data?.issues) {
      mapServerIssues(err.data.issues)
    }
    submitError.value = t('profile.edit.error')
    console.error('Profile save failed:', error)
  }
  finally {
    isSubmitting.value = false
  }
}

useHead({
  title: () => t('profile.edit.title'),
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
  ],
})

watch(isUserLoading, async (loading) => {
  if (loading) return

  if (!user.value || !can('organizer.profile.edit')) {
    forceHide()
    navigateTo(`/${locale.value}/`)
    return
  }

  startLoading()
  try {
    await loadProfile()
  }
  finally {
    finishLoading()
  }
}, { immediate: true })
</script>

<template>
  <div class="profile-edit-page">
    <div
      v-if="isUserLoading || isProfileLoading"
      class="profile-edit-page__loading"
    >
      {{ t('common.loading') }}
    </div>

    <div
      v-else-if="loadError"
      class="profile-edit-page__error"
    >
      <p>{{ t('errors.failedToLoad') }}</p>
      <UiButton
        variant="secondary"
        @click="loadProfile"
      >
        {{ t('common.retry') }}
      </UiButton>
    </div>

    <div
      v-else-if="user && !can('organizer.profile.edit')"
      class="profile-edit-page__loading"
    >
      {{ t('common.loading') }}
    </div>

    <div
      v-else
      class="profile-edit"
    >
      <header class="profile-edit__header">
        <h1 class="profile-edit__title">
          {{ t('profile.edit.title') }}
        </h1>
        <p class="profile-edit__subtitle">
          {{ t('profile.edit.subtitle') }}
        </p>
      </header>

      <div
        v-if="successMessage"
        class="profile-edit__success"
        role="status"
      >
        {{ successMessage }}
      </div>

      <div
        v-if="submitError"
        class="profile-edit__error"
        role="alert"
      >
        {{ submitError }}
      </div>

      <form
        class="profile-edit__form"
        novalidate
        @submit.prevent="handleSubmit"
      >
        <!-- AVATAR -->
        <section class="profile-edit__section">
          <h2 class="profile-edit__section-title">
            {{ t('profile.edit.avatar') }}
          </h2>
          <div class="profile-edit__section-avatar-wrapper">
            <AvatarUploader
              upload-url="/api/organizers/avatar"
              :current-avatar-url="avatarUrl"
              :disabled="isSubmitting"
              @uploaded="onAvatarUploaded"
            />
          </div>
        </section>

        <!-- BASIC INFO -->
        <section class="profile-edit__section">
          <h2 class="profile-edit__section-title">
            {{ t('profile.edit.basicInfo') }}
          </h2>
          <div class="profile-edit__row">
            <UiInput
              v-model="firstName"
              :label="t('common.firstName')"
              autocomplete="given-name"
              required
              :max-chars="PROFILE_LIMITS.FIRST_NAME_MAX"
              :error="formErrors.firstName"
              :disabled="isSubmitting"
            />
            <UiInput
              v-model="lastName"
              :label="t('common.lastName')"
              autocomplete="family-name"
              required
              :max-chars="PROFILE_LIMITS.LAST_NAME_MAX"
              :error="formErrors.lastName"
              :disabled="isSubmitting"
            />
          </div>
        </section>

        <!-- ABOUT -->
        <section class="profile-edit__section">
          <h2 class="profile-edit__section-title">
            {{ t('common.about') }}
          </h2>
          <UiTextarea
            v-model="bio"
            :label="t('common.about')"
            :rows="5"
            :max-chars="PROFILE_LIMITS.BIO_MAX"
            :error="formErrors.bio"
            :disabled="isSubmitting"
          />
        </section>

        <!-- PROFESSIONAL -->
        <section class="profile-edit__section">
          <h2 class="profile-edit__section-title">
            {{ t('profile.edit.professional') }}
          </h2>

          <div class="profile-edit__field">
            <UiInput
              v-model="qualification"
              :label="t('profile.edit.qualification')"
              required
              :max-chars="PROFILE_LIMITS.QUALIFICATION_MAX"
              :error="formErrors.qualification"
              :disabled="isSubmitting"
            />
          </div>

          <div class="profile-edit__row">
            <UiInput
              v-model="professionalOrganization"
              :label="t('profile.edit.professionalOrganization')"
              required
              :max-chars="PROFILE_LIMITS.PROFESSIONAL_ORG_MAX"
              :error="formErrors.professionalOrganization"
              :disabled="isSubmitting"
            />
            <UiInput
              v-model="professionalOrganizationStatus"
              :label="t('profile.edit.professionalOrganizationStatus')"
              required
              :max-chars="PROFILE_LIMITS.PROFESSIONAL_ORG_STATUS_MAX"
              :error="formErrors.professionalOrganizationStatus"
              :disabled="isSubmitting"
            />
          </div>

          <div class="profile-edit__field">
            <div class="profile-edit__field-header">
              <label class="profile-edit__label">
                {{ t('profile.edit.experience') }}
              </label>
            </div>
            <Slider
              v-model="experienceYears"
              :min="0"
              :max="LIMITS.MAX_EXPERIENCE_YEARS"
              :step="1"
              :disabled="isSubmitting"
              :aria-label="t('profile.edit.experience')"
            />
          </div>

          <div class="profile-edit__field">
            <label class="profile-edit__label">
              {{ t('common.specializations') }}
            </label>
            <div class="profile-edit__spec-input">
              <UiInput
                v-model="specInput"
                :placeholder="t('profile.edit.specializationsPlaceholder')"
                :max-chars="PROFILE_LIMITS.SPECIALIZATION_MAX"
                :error="formErrors.specInput"
                :disabled="isSubmitting"
                @keydown.enter.prevent="addSpecialization"
              />
              <UiButton
                variant="secondary"
                class="profile-edit__add-btn"
                :disabled="isSubmitting || !specInput.trim()"
                @click="addSpecialization"
              >
                {{ t('common.add') }}
              </UiButton>
            </div>
            <p
              v-if="formErrors.specializations"
              class="profile-edit__field-error"
              role="alert"
            >
              {{ formErrors.specializations }}
            </p>
            <div
              v-if="specializations.length"
              class="profile-edit__pills"
            >
              <span
                v-for="(spec, index) in specializations"
                :key="index"
                class="profile-edit__pill"
              >
                {{ spec }}
                <button
                  type="button"
                  class="profile-edit__pill-remove"
                  :aria-label="`${t('common.actions.remove')} ${spec}`"
                  :disabled="isSubmitting"
                  @click="removeSpecialization(index)"
                >
                  ×
                </button>
              </span>
            </div>
          </div>
        </section>

        <!-- LOGISTICS -->
        <section class="profile-edit__section">
          <h2 class="profile-edit__section-title">
            {{ t('profile.edit.logistics') }}
          </h2>

          <div class="profile-edit__field">
            <label class="profile-edit__label">
              {{ t('common.workFormats') }}
            </label>
            <div
              class="profile-edit__checkbox-group"
              role="group"
              :aria-label="t('common.workFormats')"
            >
              <UiCheckbox
                v-for="opt in workFormatOptions"
                :key="opt.value"
                :model-value="workFormats.includes(opt.value)"
                :label="t(opt.labelKey)"
                :disabled="isSubmitting"
                @update:model-value="toggleWorkFormat(opt.value)"
              />
            </div>
          </div>

          <div class="profile-edit__field">
            <label class="profile-edit__label">
              {{ t('common.languages') }}
            </label>
            <Combobox
              :placeholder="t('profile.edit.languagesPlaceholder')"
              :search-fn="searchLanguages"
              :disabled="isSubmitting"
              @select="onLanguageSelect"
            />
            <div
              v-if="languages.length"
              class="profile-edit__pills"
            >
              <span
                v-for="code in languages"
                :key="code"
                class="profile-edit__pill"
              >
                {{ languageLabel(code) }}
                <button
                  type="button"
                  class="profile-edit__pill-remove"
                  :aria-label="`${t('common.actions.remove')} ${languageLabel(code)}`"
                  :disabled="isSubmitting"
                  @click="removeLanguage(code)"
                >
                  ×
                </button>
              </span>
            </div>
          </div>

          <div class="profile-edit__field">
            <UiInput
              v-model="city"
              :label="t('common.city')"
              :placeholder="t('profile.edit.cityPlaceholder')"
              :max-chars="PROFILE_LIMITS.CITY_MAX"
              :error="formErrors.city"
              :disabled="isSubmitting"
            />
          </div>
        </section>

        <!-- EDUCATION -->
        <section class="profile-edit__section">
          <h2 class="profile-edit__section-title">
            {{ t('profile.edit.education') }}
          </h2>

          <div
            class="profile-edit__list"
            role="group"
            :aria-label="t('profile.edit.education')"
          >
            <div
              v-for="(item, index) in education"
              :key="item.id"
              class="profile-edit__list-row"
            >
              <span
                class="profile-edit__list-index"
                aria-hidden="true"
              >{{ index + 1 }}.</span>
              <UiInput
                v-model="item.value"
                :placeholder="t('profile.edit.education')"
                :max-chars="PROFILE_LIMITS.EDUCATION_MAX"
                :error="formErrors[`education-${item.id}`]"
                :disabled="isSubmitting"
              />
              <UiButton
                variant="danger"
                size="sm"
                class="profile-edit__list-remove"
                :aria-label="t('profile.edit.removeEducation')"
                :disabled="isSubmitting"
                @click="removeEducation(item.id)"
              >
                <span aria-hidden="true">×</span>
              </UiButton>
            </div>
          </div>

          <div class="profile-edit__list-add">
            <UiButton
              variant="secondary"
              size="sm"
              :disabled="isSubmitting"
              @click="addEducation"
            >
              {{ t('profile.edit.addEducation') }}
            </UiButton>
          </div>
        </section>

        <!-- SOCIAL -->
        <section class="profile-edit__section">
          <h2 class="profile-edit__section-title">
            {{ t('common.social') }}
          </h2>
          <div class="profile-edit__social-grid">
            <UiInput
              v-model="telegramUrl"
              :label="t('profile.edit.telegram')"
              type="url"
              placeholder="https://t.me/..."
              :max-chars="PROFILE_LIMITS.SOCIAL_URL_MAX"
              :error="formErrors.telegramUrl"
              :disabled="isSubmitting"
            />
            <UiInput
              v-model="instagramUrl"
              :label="t('profile.edit.instagram')"
              type="url"
              placeholder="https://instagram.com/..."
              :max-chars="PROFILE_LIMITS.SOCIAL_URL_MAX"
              :error="formErrors.instagramUrl"
              :disabled="isSubmitting"
            />
            <UiInput
              v-model="linkedinUrl"
              :label="t('profile.edit.linkedin')"
              type="url"
              placeholder="https://linkedin.com/in/..."
              :max-chars="PROFILE_LIMITS.SOCIAL_URL_MAX"
              :error="formErrors.linkedinUrl"
              :disabled="isSubmitting"
            />
            <UiInput
              v-model="whatsappUrl"
              :label="t('profile.edit.whatsapp')"
              type="url"
              placeholder="https://wa.me/380671234567"
              :max-chars="PROFILE_LIMITS.SOCIAL_URL_MAX"
              :error="formErrors.whatsappUrl"
              :disabled="isSubmitting"
            />
            <UiInput
              v-model="facebookUrl"
              :label="t('profile.edit.facebook')"
              type="url"
              placeholder="https://facebook.com/username"
              :max-chars="PROFILE_LIMITS.SOCIAL_URL_MAX"
              :error="formErrors.facebookUrl"
              :disabled="isSubmitting"
            />
            <UiInput
              v-model="youtubeUrl"
              :label="t('profile.edit.youtube')"
              type="url"
              placeholder="https://youtube.com/@channel"
              :max-chars="PROFILE_LIMITS.SOCIAL_URL_MAX"
              :error="formErrors.youtubeUrl"
              :disabled="isSubmitting"
            />
          </div>
        </section>

        <!-- ACTIONS -->
        <div class="profile-edit__actions">
          <UiButton
            :label="isSubmitting ? t('common.loading') : t('common.save')"
            type="submit"
            :disabled="isSubmitting"
          />
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.profile-edit-page {
  display: flex;
  justify-content: center;
  padding: var(--spacing-2xl) var(--spacing-lg);
  min-height: 60vh;
}

.profile-edit-page__loading {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--color-text-muted);
  font-size: var(--font-size-md);
}

.profile-edit-page__error {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--color-error-text);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
}

.profile-edit {
  width: 100%;
  max-width: 720px;
}

.profile-edit__header {
  margin-bottom: var(--spacing-xl);
}

.profile-edit__title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  margin: 0 0 var(--spacing-md);
  color: var(--color-text);
}

.profile-edit__subtitle {
  font-size: var(--font-size-md);
  color: var(--color-text-muted);
  margin: 0;
}

.profile-edit__success {
  background: var(--color-success-bg-soft);
  color: var(--color-success-text);
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-lg);
  font-size: var(--font-size-sm);
  border: var(--border-width) solid var(--color-success-border-soft);
}

.profile-edit__error {
  background: var(--color-error-bg-soft);
  color: var(--color-error-text);
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-lg);
  font-size: var(--font-size-sm);
  border: var(--border-width) solid var(--color-error-border-soft);
}

.profile-edit__form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

.profile-edit__section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-lg);
}

.profile-edit__section-avatar-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
}

.profile-edit__section-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  margin: 0;
  color: var(--color-text);
  padding-bottom: var(--spacing-sm);
  border-bottom: var(--border-width) solid var(--color-border);
}

.profile-edit__field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.profile-edit__field + .profile-edit__field {
  margin-top: var(--spacing-md);
}

.profile-edit__field-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-xs);
}

.profile-edit__label {
  display: block;
  margin-bottom: var(--spacing-xs);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.profile-edit__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
}

.profile-edit__social-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-md);
}

.profile-edit__checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-md);
}

.profile-edit__pills {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  margin-top: var(--spacing-sm);
}

.profile-edit__pill {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  background: var(--color-background-accent);
  color: var(--color-text);
  border: var(--border-width) solid var(--color-border);
}

.profile-edit__pill-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: none;
  background: transparent;
  color: inherit;
  font-size: var(--font-size-sm);
  cursor: pointer;
  padding: 0;
  line-height: 1;
  opacity: 0.8;
}

.profile-edit__pill-remove:hover:not(:disabled) {
  opacity: 1;
}

.profile-edit__pill-remove:disabled {
  cursor: not-allowed;
}

.profile-edit__spec-input {
  display: flex;
  gap: var(--spacing-sm);
  align-items: flex-start;
}

.profile-edit__spec-input :deep(.ui-input) {
  flex: 1;
}

.profile-edit__add-btn {
  height: 40px;
  white-space: nowrap;
}

.profile-edit__field-error {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-error);
}

.profile-edit__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.profile-edit__list-row {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
}

.profile-edit__list-row :deep(.ui-input) {
  flex: 1;
}

.profile-edit__list-index {
  flex-shrink: 0;
  height: 40px;
  display: inline-flex;
  align-items: center;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.profile-edit__list-remove {
  flex-shrink: 0;
  height: 40px;
  width: 40px;
}

.profile-edit__list-add {
  display: flex;
}

.profile-edit__actions {
  padding-top: var(--spacing-lg);
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 640px) {
  .profile-edit__row {
    grid-template-columns: 1fr;
  }

  .profile-edit__social-grid {
    grid-template-columns: 1fr;
  }

  .profile-edit__spec-input {
    flex-direction: column;
  }

  .profile-edit__add-btn {
    width: 100%;
    justify-content: center;
  }

  .profile-edit__section {
    padding: var(--spacing-md);
  }
}
</style>
