<script setup lang="ts">
const { t, locale } = useLocale()
const { user, isLoading: isUserLoading } = useUser()
const { startLoading, finishLoading, forceHide } = usePageLoading()

const isProfileLoading = ref(true)
const isSubmitting = ref(false)
const successMessage = ref('')
const submitError = ref('')

const avatarUrl = ref<string | null>(null)
const firstName = ref('')
const lastName = ref('')
const bio = ref('')
const qualification = ref('')
const experienceYears = ref(0)
const selectedSpecializationIds = ref<string[]>([])
const selectedSpecializations = ref<{ id: string, label: string }[]>([])
const customSpecializations = ref<string[]>([])
const customSpecInput = ref('')
const workFormats = ref<string[]>([])
const languages = ref<string[]>([])
const city = ref('')
const cityOther = ref('')
const education = ref('')
const telegramUrl = ref('')
const instagramUrl = ref('')
const linkedinUrl = ref('')

const cities = ['Київ', 'Харків', 'Одеса', 'Дніпро', 'Львів', 'Запоріжжя']

const cityOptions = computed(() => [
  ...cities.map(c => ({ value: c, label: c })),
  { value: '__other__', label: t('profile.edit.cityOther') },
])

const workFormatOptions = [
  { value: 'ONLINE', labelKey: 'profile.edit.formatsOnline' },
  { value: 'OFFLINE', labelKey: 'profile.edit.formatsOffline' },
  { value: 'MIXED', labelKey: 'profile.edit.formatsMixed' },
]

const languageOptions = [
  { value: 'UA', label: 'Українська' },
  { value: 'EN', label: 'English' },
  { value: 'RU', label: 'Русский' },
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

function toggleLanguage(value: string) {
  const idx = languages.value.indexOf(value)
  if (idx === -1) {
    languages.value.push(value)
  }
  else {
    languages.value.splice(idx, 1)
  }
}

async function searchSpecializations(query: string) {
  const data = await $fetch<{ id: string, nameUa: string, nameEn: string }[]>(
    '/api/specializations',
    { params: { query } },
  )
  return data.map(s => ({
    id: s.id,
    label: locale.value === 'ua' ? s.nameUa : s.nameEn,
  }))
}

function onSpecializationSelect(item: { id: string, label: string }) {
  if (!selectedSpecializationIds.value.includes(item.id)) {
    selectedSpecializationIds.value.push(item.id)
    selectedSpecializations.value.push(item)
  }
}

function removeSpecialization(id: string) {
  selectedSpecializationIds.value = selectedSpecializationIds.value.filter(sid => sid !== id)
  selectedSpecializations.value = selectedSpecializations.value.filter(s => s.id !== id)
}

function addCustomSpecialization() {
  const val = customSpecInput.value.trim()
  if (val && !customSpecializations.value.includes(val)) {
    customSpecializations.value.push(val)
    customSpecInput.value = ''
  }
}

function removeCustomSpecialization(index: number) {
  customSpecializations.value.splice(index, 1)
}

function onAvatarUploaded(url: string) {
  avatarUrl.value = url
}

async function loadProfile() {
  isProfileLoading.value = true
  try {
    const data = await $fetch<Record<string, unknown>>('/api/organizers/me')

    firstName.value = (data.firstName as string) || ''
    lastName.value = (data.lastName as string) || ''
    bio.value = (data.bio as string) || ''
    qualification.value = (data.qualification as string) || ''
    avatarUrl.value = (data.avatarUrl as string) || null
    experienceYears.value = (data.experienceYears as number) || 0
    workFormats.value = (data.workFormats as string[]) || []
    languages.value = (data.languages as string[]) || []
    education.value = (data.education as string) || ''
    telegramUrl.value = (data.telegramUrl as string) || ''
    instagramUrl.value = (data.instagramUrl as string) || ''
    linkedinUrl.value = (data.linkedinUrl as string) || ''
    customSpecializations.value = (data.customSpecializations as string[]) || []

    const specializations = (data.specializations as { id: string, nameUa: string, nameEn: string }[]) || []
    selectedSpecializationIds.value = specializations.map(s => s.id)
    selectedSpecializations.value = specializations.map(s => ({
      id: s.id,
      label: locale.value === 'ua' ? s.nameUa : s.nameEn,
    }))

    const cityVal = (data.city as string) || ''
    if (cities.includes(cityVal)) {
      city.value = cityVal
      cityOther.value = ''
    }
    else if (cityVal) {
      city.value = '__other__'
      cityOther.value = cityVal
    }
    else {
      city.value = ''
      cityOther.value = ''
    }
  }
  catch {
    submitError.value = t('common.errors.fetchFailed')
  }
  finally {
    isProfileLoading.value = false
  }
}

async function handleSubmit() {
  isSubmitting.value = true
  successMessage.value = ''
  submitError.value = ''

  const resolvedCity = city.value === '__other__'
    ? cityOther.value.trim()
    : city.value

  const payload: Record<string, unknown> = {
    firstName: firstName.value.trim(),
    lastName: lastName.value.trim(),
    bio: bio.value.trim(),
    qualification: qualification.value.trim(),
    experienceYears: experienceYears.value,
    specializationIds: selectedSpecializationIds.value,
    customSpecializations: customSpecializations.value,
    workFormats: workFormats.value,
    languages: languages.value,
    city: resolvedCity,
    education: education.value.trim(),
    telegramUrl: telegramUrl.value.trim(),
    instagramUrl: instagramUrl.value.trim(),
    linkedinUrl: linkedinUrl.value.trim(),
  }

  try {
    await $fetch('/api/organizers/me', {
      method: 'PATCH',
      body: payload,
    })
    successMessage.value = t('profile.edit.success')
  }
  catch {
    submitError.value = t('profile.edit.error')
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

  // Auth загрузился — проверяем роль
  if (!user.value || user.value.role !== 'ORGANIZER') {
    forceHide()
    navigateTo(`/${locale.value}/`)
    return
  }

  // Организатор авторизован — грузим профиль
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
      v-else-if="user && user.role !== 'ORGANIZER'"
      class="profile-edit-page__loading"
    >
      {{ t('common.loading') }}
    </div>

    <div
      v-else
      class="profile-edit"
    >
      <h1 class="profile-edit__title">
        {{ t('profile.edit.title') }}
      </h1>

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
        <fieldset class="profile-edit__section">
          <legend class="profile-edit__section-title">
            {{ t('profile.edit.avatar') }}
          </legend>
          <AvatarUploader
            upload-url="/api/organizers/avatar"
            :current-avatar-url="avatarUrl"
            :label="t('profile.edit.avatar')"
            :disabled="isSubmitting"
            @uploaded="onAvatarUploaded"
          />
        </fieldset>

        <fieldset class="profile-edit__section">
          <legend class="profile-edit__section-title">
            {{ t('profile.edit.basicInfo') }}
          </legend>
          <div class="profile-edit__row">
            <UiInput
              v-model="firstName"
              :label="t('profile.edit.firstName')"
              autocomplete="given-name"
              required
              :disabled="isSubmitting"
            />
            <UiInput
              v-model="lastName"
              :label="t('profile.edit.lastName')"
              autocomplete="family-name"
              required
              :disabled="isSubmitting"
            />
          </div>
        </fieldset>

        <fieldset class="profile-edit__section">
          <legend class="profile-edit__section-title">
            {{ t('profile.edit.about') }}
          </legend>
          <UiTextarea
            v-model="bio"
            :label="t('profile.edit.about')"
            :rows="4"
            :disabled="isSubmitting"
          />
        </fieldset>

        <fieldset class="profile-edit__section">
          <legend class="profile-edit__section-title">
            {{ t('profile.edit.qualification') }}
          </legend>
          <UiInput
            v-model="qualification"
            :label="t('profile.edit.qualification')"
            :disabled="isSubmitting"
          />
        </fieldset>

        <fieldset class="profile-edit__section">
          <legend class="profile-edit__section-title">
            {{ t('profile.edit.experience') }}
          </legend>
          <div class="profile-edit__field">
            <Slider
              v-model="experienceYears"
              :min="0"
              :max="15"
              :step="1"
              :disabled="isSubmitting"
            />
          </div>
        </fieldset>

        <fieldset class="profile-edit__section">
          <legend class="profile-edit__section-title">
            {{ t('profile.edit.specializations') }}
          </legend>
          <div class="profile-edit__field">
            <label class="profile-edit__label">
              {{ t('profile.edit.specializations') }}
            </label>
            <Combobox
              :placeholder="t('profile.edit.specializationsSearch')"
              :search-fn="searchSpecializations"
              :disabled="isSubmitting"
              @select="onSpecializationSelect"
            />
            <div
              v-if="selectedSpecializations.length"
              class="profile-edit__pills"
            >
              <span
                v-for="spec in selectedSpecializations"
                :key="spec.id"
                class="profile-edit__pill profile-edit__pill--primary"
              >
                {{ spec.label }}
                <button
                  type="button"
                  class="profile-edit__pill-remove"
                  :aria-label="`Remove ${spec.label}`"
                  :disabled="isSubmitting"
                  @click="removeSpecialization(spec.id)"
                >
                  ×
                </button>
              </span>
            </div>
          </div>
          <div class="profile-edit__field">
            <div class="profile-edit__custom-spec">
              <UiInput
                v-model="customSpecInput"
                :placeholder="t('profile.edit.customPlaceholder')"
                :disabled="isSubmitting"
                @keydown.enter.prevent="addCustomSpecialization"
              />
              <button
                type="button"
                class="profile-edit__add-btn"
                :disabled="isSubmitting || !customSpecInput.trim()"
                @click="addCustomSpecialization"
              >
                {{ t('profile.edit.addCustom') }}
              </button>
            </div>
            <div
              v-if="customSpecializations.length"
              class="profile-edit__pills"
            >
              <span
                v-for="(spec, index) in customSpecializations"
                :key="index"
                class="profile-edit__pill profile-edit__pill--secondary"
              >
                {{ spec }}
                <button
                  type="button"
                  class="profile-edit__pill-remove"
                  :aria-label="`Remove ${spec}`"
                  :disabled="isSubmitting"
                  @click="removeCustomSpecialization(index)"
                >
                  ×
                </button>
              </span>
            </div>
          </div>
        </fieldset>

        <fieldset class="profile-edit__section">
          <legend class="profile-edit__section-title">
            {{ t('profile.edit.formats') }}
          </legend>
          <div
            class="profile-edit__checkbox-group"
            role="group"
            :aria-label="t('profile.edit.formats')"
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
        </fieldset>

        <fieldset class="profile-edit__section">
          <legend class="profile-edit__section-title">
            {{ t('profile.edit.languages') }}
          </legend>
          <div
            class="profile-edit__checkbox-group"
            role="group"
            :aria-label="t('profile.edit.languages')"
          >
            <UiCheckbox
              v-for="opt in languageOptions"
              :key="opt.value"
              :model-value="languages.includes(opt.value)"
              :label="opt.label"
              :disabled="isSubmitting"
              @update:model-value="toggleLanguage(opt.value)"
            />
          </div>
        </fieldset>

        <fieldset class="profile-edit__section">
          <legend class="profile-edit__section-title">
            {{ t('profile.edit.city') }}
          </legend>
          <UiSelect
            v-model="city"
            :label="t('profile.edit.city')"
            :options="cityOptions"
            :placeholder="t('profile.edit.city')"
            :disabled="isSubmitting"
          />
          <UiInput
            v-if="city === '__other__'"
            v-model="cityOther"
            :label="t('profile.edit.cityOther')"
            :disabled="isSubmitting"
          />
        </fieldset>

        <fieldset class="profile-edit__section">
          <legend class="profile-edit__section-title">
            {{ t('profile.edit.education') }}
          </legend>
          <UiInput
            v-model="education"
            :label="t('profile.edit.education')"
            :disabled="isSubmitting"
          />
        </fieldset>

        <fieldset class="profile-edit__section">
          <legend class="profile-edit__section-title">
            {{ t('profile.edit.social') }}
          </legend>
          <UiInput
            v-model="telegramUrl"
            :label="t('profile.edit.telegram')"
            type="url"
            placeholder="https://t.me/..."
            :disabled="isSubmitting"
          />
          <UiInput
            v-model="instagramUrl"
            :label="t('profile.edit.instagram')"
            type="url"
            placeholder="https://instagram.com/..."
            :disabled="isSubmitting"
          />
          <UiInput
            v-model="linkedinUrl"
            :label="t('profile.edit.linkedin')"
            type="url"
            placeholder="https://linkedin.com/in/..."
            :disabled="isSubmitting"
          />
        </fieldset>

        <div class="profile-edit__actions">
          <UiButton
            :label="t('profile.edit.save')"
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

.profile-edit {
  width: 100%;
  max-width: 640px;
}

.profile-edit__title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  margin: 0 0 var(--spacing-xl);
}

.profile-edit__success {
  background: rgba(92, 184, 92, 0.1);
  color: var(--color-success);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-sm);
  margin-bottom: var(--spacing-lg);
  font-size: var(--font-size-sm);
}

.profile-edit__error {
  background: rgba(217, 83, 79, 0.1);
  color: var(--color-error);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-sm);
  margin-bottom: var(--spacing-lg);
  font-size: var(--font-size-sm);
}

.profile-edit__form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.profile-edit__section {
  border: none;
  border-bottom: var(--border-width) solid var(--color-border);
  padding: 0 0 var(--spacing-lg);
  margin: 0;
}

.profile-edit__section:last-of-type {
  border-bottom: none;
}

.profile-edit__section-title {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--spacing-md);
  color: var(--color-text);
}

.profile-edit__field {
  margin-bottom: var(--spacing-md);
}

.profile-edit__field:last-child {
  margin-bottom: 0;
}

.profile-edit__label {
  display: block;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  margin-bottom: var(--spacing-xs);
}

.profile-edit__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
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
}

.profile-edit__pill--primary {
  background: var(--color-primary);
  color: #fff;
}

.profile-edit__pill--secondary {
  background: var(--color-border);
  color: var(--color-text);
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

.profile-edit__custom-spec {
  display: flex;
  gap: var(--spacing-sm);
}

.profile-edit__custom-spec :deep(.ui-input) {
  flex: 1;
}

.profile-edit__add-btn {
  padding: var(--spacing-sm) var(--spacing-md);
  border: var(--border-width) solid var(--color-primary);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-family: var(--font-family-base);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  white-space: nowrap;
  transition: background-color var(--transition-base), color var(--transition-base);
}

.profile-edit__add-btn:hover:not(:disabled) {
  background: var(--color-primary);
  color: #fff;
}

.profile-edit__add-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.profile-edit__actions {
  padding-top: var(--spacing-md);
}

@media (max-width: 480px) {
  .profile-edit__row {
    grid-template-columns: 1fr;
  }

  .profile-edit__custom-spec {
    flex-direction: column;
  }
}
</style>
