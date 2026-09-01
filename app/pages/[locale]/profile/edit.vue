<script setup lang="ts">
const { t } = useLocale()
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
const specializations = ref<string[]>([])
const specInput = ref('')
const workFormats = ref<string[]>([])
const languages = ref<string[]>([])
const city = ref('')
const cityOther = ref('')
const education = ref('')
const telegramUrl = ref('')
const instagramUrl = ref('')
const linkedinUrl = ref('')

const BIO_MAX_LENGTH = 500

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

const bioCharCount = computed(() => bio.value.length)
const bioCharClass = computed(() => {
  if (bioCharCount.value > BIO_MAX_LENGTH) return 'profile-edit__counter--over'
  if (bioCharCount.value > BIO_MAX_LENGTH * 0.9) return 'profile-edit__counter--warn'
  return ''
})

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

function addSpecialization() {
  const val = specInput.value.trim()
  if (val && val.length <= 60 && !specializations.value.includes(val)) {
    specializations.value.push(val)
    specInput.value = ''
  }
}

function removeSpecialization(index: number) {
  specializations.value.splice(index, 1)
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
    specializations.value = (data.specializations as string[]) || []

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
    specializations: specializations.value,
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

  if (!user.value || user.value.role !== 'ORGANIZER') {
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
      v-else-if="user && user.role !== 'ORGANIZER'"
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
        <section class="profile-edit__section profile-edit__section--avatar">
          <AvatarUploader
            upload-url="/api/organizers/avatar"
            :current-avatar-url="avatarUrl"
            :label="t('profile.edit.avatar')"
            :disabled="isSubmitting"
            @uploaded="onAvatarUploaded"
          />
        </section>

        <!-- BASIC INFO -->
        <section class="profile-edit__section">
          <h2 class="profile-edit__section-title">
            {{ t('profile.edit.basicInfo') }}
          </h2>
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
        </section>

        <!-- ABOUT -->
        <section class="profile-edit__section">
          <h2 class="profile-edit__section-title">
            {{ t('profile.edit.about') }}
          </h2>
          <UiTextarea
            v-model="bio"
            :label="t('profile.edit.about')"
            :rows="5"
            :max-length="BIO_MAX_LENGTH"
            :disabled="isSubmitting"
          />
          <div
            class="profile-edit__counter"
            :class="bioCharClass"
          >
            {{ bioCharCount }} / {{ BIO_MAX_LENGTH }}
          </div>
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
              :disabled="isSubmitting"
            />
          </div>

          <div class="profile-edit__field">
            <div class="profile-edit__field-header">
              <label class="profile-edit__label">
                {{ t('profile.edit.experience') }}
              </label>
              <span class="profile-edit__field-value">
                {{ experienceYears }}
                {{ experienceYears === 1 ? t('profile.edit.years1') : t('profile.edit.years') }}
              </span>
            </div>
            <Slider
              v-model="experienceYears"
              :min="0"
              :max="15"
              :step="1"
              :disabled="isSubmitting"
            />
          </div>

          <div class="profile-edit__field">
            <label class="profile-edit__label">
              {{ t('profile.edit.specializations') }}
            </label>
            <div class="profile-edit__spec-input">
              <UiInput
                v-model="specInput"
                :placeholder="t('profile.edit.specializationsPlaceholder')"
                :disabled="isSubmitting"
                @keydown.enter.prevent="addSpecialization"
              />
              <button
                type="button"
                class="profile-edit__add-btn"
                :disabled="isSubmitting || !specInput.trim()"
                @click="addSpecialization"
              >
                {{ t('profile.edit.addSpecialization') }}
              </button>
            </div>
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
                  :aria-label="`Remove ${spec}`"
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
              {{ t('profile.edit.formats') }}
            </label>
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
          </div>

          <div class="profile-edit__field">
            <label class="profile-edit__label">
              {{ t('profile.edit.languages') }}
            </label>
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
          </div>

          <div class="profile-edit__field">
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
          </div>
        </section>

        <!-- EDUCATION -->
        <section class="profile-edit__section">
          <h2 class="profile-edit__section-title">
            {{ t('profile.edit.education') }}
          </h2>
          <UiInput
            v-model="education"
            :label="t('profile.edit.education')"
            :disabled="isSubmitting"
          />
        </section>

        <!-- SOCIAL -->
        <section class="profile-edit__section">
          <h2 class="profile-edit__section-title">
            {{ t('profile.edit.social') }}
          </h2>
          <div class="profile-edit__row profile-edit__row--three">
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
          </div>
        </section>

        <!-- ACTIONS -->
        <div class="profile-edit__actions">
          <UiButton
            :label="isSubmitting ? t('common.loading') : t('profile.edit.save')"
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
  max-width: 720px;
}

.profile-edit__header {
  margin-bottom: var(--spacing-2xl);
  padding-bottom: var(--spacing-lg);
  border-bottom: var(--border-width) solid var(--color-border);
}

.profile-edit__title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  margin: 0 0 var(--spacing-xs);
  color: var(--color-text);
}

.profile-edit__subtitle {
  font-size: var(--font-size-md);
  color: var(--color-text-muted);
  margin: 0;
}

.profile-edit__success {
  background: rgba(92, 184, 92, 0.1);
  color: var(--color-success);
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-lg);
  font-size: var(--font-size-sm);
  border: 1px solid rgba(92, 184, 92, 0.2);
}

.profile-edit__error {
  background: rgba(217, 83, 79, 0.1);
  color: var(--color-error);
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-lg);
  font-size: var(--font-size-sm);
  border: 1px solid rgba(217, 83, 79, 0.2);
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

.profile-edit__section--avatar {
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

.profile-edit__field-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-xs);
}

.profile-edit__field-value {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-primary);
}

.profile-edit__label {
  display: block;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.profile-edit__counter {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-align: right;
  margin-top: calc(var(--spacing-xs) * -1);
}

.profile-edit__counter--warn {
  color: var(--color-warning);
}

.profile-edit__counter--over {
  color: var(--color-error);
  font-weight: var(--font-weight-medium);
}

.profile-edit__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
}

.profile-edit__row--three {
  grid-template-columns: repeat(3, 1fr);
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
  height: 40px;
  display: inline-flex;
  align-items: center;
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
  padding-top: var(--spacing-lg);
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 640px) {
  .profile-edit__row {
    grid-template-columns: 1fr;
  }

  .profile-edit__row--three {
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
