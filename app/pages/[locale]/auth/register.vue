<script setup lang="ts">
import type { RegisterPayload } from '~~/types'
import { LIMITS, PROFILE_LIMITS } from '~~/shared/constants/limits'

const { t, locale } = useLocale()
const { register, error } = useUser()
const route = useRoute()

const selectedRole = ref<'VISITOR' | 'ORGANIZER'>('VISITOR')
const roles: Array<'VISITOR' | 'ORGANIZER'> = ['VISITOR', 'ORGANIZER']

const email = ref((route.query.email as string) || '')
const password = ref('')
const passwordConfirm = ref('')
const firstName = ref('')
const lastName = ref('')
const bio = ref('')
const qualification = ref('')
const professionalOrganization = ref('')
const professionalOrganizationStatus = ref('')
const fieldErrors = ref<Record<string, string>>({})
const moderationMessage = ref('')
const isSubmitting = ref(false)
let redirectTimer: ReturnType<typeof setTimeout> | null = null

onBeforeUnmount(() => {
  if (redirectTimer) clearTimeout(redirectTimer)
})

function onRoleKeydown(e: KeyboardEvent) {
  const currentIndex = roles.indexOf(selectedRole.value)
  let newIndex = currentIndex

  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault()
    newIndex = (currentIndex + 1) % roles.length
  }
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault()
    newIndex = (currentIndex - 1 + roles.length) % roles.length
  }

  if (newIndex !== currentIndex) {
    const role = roles[newIndex]
    if (role) {
      selectedRole.value = role
      const buttons = (e.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
      buttons?.[newIndex]?.focus()
    }
  }
}

function validate(): boolean {
  const errors: Record<string, string> = {}

  if (!email.value.trim()) {
    errors.email = t('auth.errors.emailRequired')
  }
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
    errors.email = t('auth.errors.emailInvalid')
  }

  if (!password.value) {
    errors.password = t('auth.errors.passwordRequired')
  }
  else if (password.value.length < LIMITS.MIN_PASSWORD_LENGTH) {
    errors.password = t('auth.errors.passwordMin')
  }

  if (password.value !== passwordConfirm.value) {
    errors.passwordConfirm = t('auth.errors.passwordMismatch')
  }

  if (selectedRole.value === 'ORGANIZER') {
    // Mirrors `requiredText` in `server/validators/organizerProfile.ts` — trimmed, at least
    // `REQUIRED_TEXT_MIN` characters, inside the profile limit. Without the parity the
    // server answers 400 naming a field this form had just reported as fine.
    const check = (key: string, value: string, max: number) => {
      const trimmed = value.trim()

      if (!trimmed) errors[key] = t('common.required')
      else if (trimmed.length < PROFILE_LIMITS.REQUIRED_TEXT_MIN) {
        errors[key] = t('errors.fieldTooShort', { min: PROFILE_LIMITS.REQUIRED_TEXT_MIN })
      }
      else if (trimmed.length > max) errors[key] = t('errors.fieldTooLong', { max })
    }

    check('firstName', firstName.value, PROFILE_LIMITS.FIRST_NAME_MAX)
    check('lastName', lastName.value, PROFILE_LIMITS.LAST_NAME_MAX)
    check('qualification', qualification.value, PROFILE_LIMITS.QUALIFICATION_MAX)
    check('professionalOrganization', professionalOrganization.value, PROFILE_LIMITS.PROFESSIONAL_ORG_MAX)
    check('professionalOrganizationStatus', professionalOrganizationStatus.value, PROFILE_LIMITS.PROFESSIONAL_ORG_STATUS_MAX)

    if (bio.value.trim().length > PROFILE_LIMITS.BIO_MAX) {
      errors.bio = t('errors.fieldTooLong', { max: PROFILE_LIMITS.BIO_MAX })
    }
  }

  fieldErrors.value = errors
  return Object.keys(errors).length === 0
}

async function handleSubmit() {
  if (!validate()) return

  isSubmitting.value = true

  try {
    const payload: RegisterPayload = {
      email: email.value,
      password: password.value,
      role: selectedRole.value,
      preferredLocale: locale.value,
    }

    if (selectedRole.value === 'ORGANIZER') {
      payload.organizerData = {
        firstName: firstName.value.trim(),
        lastName: lastName.value.trim(),
        bio: bio.value.trim() || undefined,
        qualification: qualification.value.trim(),
        professionalOrganization: professionalOrganization.value.trim(),
        professionalOrganizationStatus: professionalOrganizationStatus.value.trim(),
      }
    }

    const result = await register(payload as RegisterPayload)

    if (result) {
      if (selectedRole.value === 'ORGANIZER') {
        moderationMessage.value = t('auth.moderation.afterRegister')
        redirectTimer = setTimeout(() => {
          navigateTo(`/${locale.value}/`)
        }, 3000)
      }
      else {
        await navigateTo(`/${locale.value}/`)
      }
    }
  }
  finally {
    isSubmitting.value = false
  }
}

useHead({
  title: () => t('auth.register.title'),
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
  ],
})
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <h1 class="auth-card__title">
        {{ t('auth.register.title') }}
      </h1>

      <div
        v-if="moderationMessage"
        class="auth-card__success"
        role="status"
      >
        {{ moderationMessage }}
      </div>

      <div
        v-if="error"
        class="auth-card__error"
        role="alert"
      >
        {{ error }}
      </div>

      <form
        v-if="!moderationMessage"
        class="auth-form"
        novalidate
        @submit.prevent="handleSubmit"
      >
        <div class="auth-form__field">
          <label class="auth-form__label">
            {{ t('auth.register.roleLabel') }}
          </label>
          <div
            class="auth-form__role-group"
            role="radiogroup"
            :aria-label="t('auth.register.roleLabel')"
          >
            <button
              type="button"
              class="auth-form__role-btn"
              :class="{ 'auth-form__role-btn--active': selectedRole === 'VISITOR' }"
              role="radio"
              :aria-checked="selectedRole === 'VISITOR'"
              :tabindex="selectedRole === 'VISITOR' ? 0 : -1"
              :disabled="isSubmitting"
              @click="selectedRole = 'VISITOR'"
              @keydown="onRoleKeydown"
            >
              {{ t('auth.register.role.participant') }}
            </button>
            <button
              type="button"
              class="auth-form__role-btn"
              :class="{ 'auth-form__role-btn--active': selectedRole === 'ORGANIZER' }"
              role="radio"
              :aria-checked="selectedRole === 'ORGANIZER'"
              :tabindex="selectedRole === 'ORGANIZER' ? 0 : -1"
              :disabled="isSubmitting"
              @click="selectedRole = 'ORGANIZER'"
              @keydown="onRoleKeydown"
            >
              {{ t('auth.register.role.organizer') }}
            </button>
          </div>
        </div>

        <div class="auth-form__field">
          <label
            for="register-email"
            class="auth-form__label"
          >
            {{ t('common.email') }}
            <span
              class="auth-form__required"
              aria-hidden="true"
            >*</span>
          </label>
          <input
            id="register-email"
            v-model="email"
            type="email"
            name="email"
            class="auth-form__input"
            :class="{ 'auth-form__input--error': fieldErrors.email }"
            autocomplete="username"
            :disabled="isSubmitting"
            aria-required="true"
            aria-describedby="register-email-error"
          />
          <span
            v-if="fieldErrors.email"
            id="register-email-error"
            class="auth-form__field-error"
            role="alert"
          >
            {{ fieldErrors.email }}
          </span>
        </div>

        <div class="auth-form__field">
          <label
            for="register-password"
            class="auth-form__label"
          >
            {{ t('auth.login.password') }}
            <span
              class="auth-form__required"
              aria-hidden="true"
            >*</span>
          </label>
          <input
            id="register-password"
            v-model="password"
            type="password"
            name="password"
            class="auth-form__input"
            :class="{ 'auth-form__input--error': fieldErrors.password }"
            autocomplete="new-password"
            :disabled="isSubmitting"
            aria-required="true"
            aria-describedby="register-password-error"
          />
          <span
            v-if="fieldErrors.password"
            id="register-password-error"
            class="auth-form__field-error"
            role="alert"
          >
            {{ fieldErrors.password }}
          </span>
        </div>

        <div class="auth-form__field">
          <label
            for="register-password-confirm"
            class="auth-form__label"
          >
            {{ t('auth.register.passwordConfirm') }}
            <span
              class="auth-form__required"
              aria-hidden="true"
            >*</span>
          </label>
          <input
            id="register-password-confirm"
            v-model="passwordConfirm"
            type="password"
            name="password-confirm"
            class="auth-form__input"
            :class="{ 'auth-form__input--error': fieldErrors.passwordConfirm }"
            autocomplete="new-password"
            :disabled="isSubmitting"
            aria-required="true"
            aria-describedby="register-password-confirm-error"
          />
          <span
            v-if="fieldErrors.passwordConfirm"
            id="register-password-confirm-error"
            class="auth-form__field-error"
            role="alert"
          >
            {{ fieldErrors.passwordConfirm }}
          </span>
        </div>

        <template v-if="selectedRole === 'ORGANIZER'">
          <p class="auth-form__hint">
            {{ t('auth.register.requiredHint') }}
          </p>

          <div class="auth-form__row">
            <div class="auth-form__field">
              <label
                for="register-firstName"
                class="auth-form__label"
              >
                {{ t('common.firstName') }}
                <span
                  class="auth-form__required"
                  aria-hidden="true"
                >*</span>
              </label>
              <input
                id="register-firstName"
                v-model="firstName"
                type="text"
                name="firstName"
                class="auth-form__input"
                :class="{ 'auth-form__input--error': fieldErrors.firstName }"
                autocomplete="given-name"
                :disabled="isSubmitting"
                aria-required="true"
                aria-describedby="register-firstName-error"
              />
              <span
                v-if="fieldErrors.firstName"
                id="register-firstName-error"
                class="auth-form__field-error"
                role="alert"
              >
                {{ fieldErrors.firstName }}
              </span>
            </div>

            <div class="auth-form__field">
              <label
                for="register-lastName"
                class="auth-form__label"
              >
                {{ t('common.lastName') }}
                <span
                  class="auth-form__required"
                  aria-hidden="true"
                >*</span>
              </label>
              <input
                id="register-lastName"
                v-model="lastName"
                type="text"
                name="lastName"
                class="auth-form__input"
                :class="{ 'auth-form__input--error': fieldErrors.lastName }"
                autocomplete="family-name"
                :disabled="isSubmitting"
                aria-required="true"
                aria-describedby="register-lastName-error"
              />
              <span
                v-if="fieldErrors.lastName"
                id="register-lastName-error"
                class="auth-form__field-error"
                role="alert"
              >
                {{ fieldErrors.lastName }}
              </span>
            </div>
          </div>

          <div class="auth-form__field">
            <label
              for="register-qualification"
              class="auth-form__label"
            >
              {{ t('common.qualification') }}
              <span
                class="auth-form__required"
                aria-hidden="true"
              >*</span>
            </label>
            <input
              id="register-qualification"
              v-model="qualification"
              type="text"
              name="qualification"
              class="auth-form__input"
              :class="{ 'auth-form__input--error': fieldErrors.qualification }"
              :disabled="isSubmitting"
              aria-required="true"
              aria-describedby="register-qualification-error"
            />
            <span
              v-if="fieldErrors.qualification"
              id="register-qualification-error"
              class="auth-form__field-error"
              role="alert"
            >
              {{ fieldErrors.qualification }}
            </span>
          </div>

          <div class="auth-form__field">
            <label
              for="register-professionalOrganization"
              class="auth-form__label"
            >
              {{ t('common.professionalOrganization') }}
              <span
                class="auth-form__required"
                aria-hidden="true"
              >*</span>
            </label>
            <input
              id="register-professionalOrganization"
              v-model="professionalOrganization"
              type="text"
              name="professionalOrganization"
              class="auth-form__input"
              :class="{ 'auth-form__input--error': fieldErrors.professionalOrganization }"
              :disabled="isSubmitting"
              aria-required="true"
              aria-describedby="register-professionalOrganization-error"
            />
            <span
              v-if="fieldErrors.professionalOrganization"
              id="register-professionalOrganization-error"
              class="auth-form__field-error"
              role="alert"
            >
              {{ fieldErrors.professionalOrganization }}
            </span>
          </div>

          <div class="auth-form__field">
            <label
              for="register-professionalOrganizationStatus"
              class="auth-form__label"
            >
              {{ t('common.professionalOrganizationStatus') }}
              <span
                class="auth-form__required"
                aria-hidden="true"
              >*</span>
            </label>
            <input
              id="register-professionalOrganizationStatus"
              v-model="professionalOrganizationStatus"
              type="text"
              name="professionalOrganizationStatus"
              class="auth-form__input"
              :class="{ 'auth-form__input--error': fieldErrors.professionalOrganizationStatus }"
              :disabled="isSubmitting"
              aria-required="true"
              aria-describedby="register-professionalOrganizationStatus-error"
            />
            <span
              v-if="fieldErrors.professionalOrganizationStatus"
              id="register-professionalOrganizationStatus-error"
              class="auth-form__field-error"
              role="alert"
            >
              {{ fieldErrors.professionalOrganizationStatus }}
            </span>
          </div>

          <div class="auth-form__field">
            <label
              for="register-bio"
              class="auth-form__label"
            >
              {{ t('common.about') }}
            </label>
            <textarea
              id="register-bio"
              v-model="bio"
              class="auth-form__input auth-form__input--textarea"
              :class="{ 'auth-form__input--error': fieldErrors.bio }"
              rows="3"
              :disabled="isSubmitting"
              aria-describedby="register-bio-error"
            ></textarea>
            <span
              v-if="fieldErrors.bio"
              id="register-bio-error"
              class="auth-form__field-error"
              role="alert"
            >
              {{ fieldErrors.bio }}
            </span>
          </div>
        </template>

        <UiButton
          :label="t('common.register')"
          type="submit"
          :disabled="isSubmitting"
          class="auth-form__submit"
        />
      </form>

      <p class="auth-card__footer">
        {{ t('auth.register.haveAccount') }}
        <NuxtLink :to="`/${locale}/auth/login`">
          {{ t('common.login') }}
        </NuxtLink>
      </p>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: var(--spacing-2xl) var(--spacing-lg);
  min-height: 60vh;
}

.auth-card {
  width: 100%;
  max-width: 480px;
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  box-shadow: var(--shadow-md);
}

.auth-card__title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  margin: 0 0 var(--spacing-xl);
  text-align: center;
}

.auth-card__error {
  background: var(--color-error-bg-soft);
  color: var(--color-error-text);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-sm);
  margin-bottom: var(--spacing-lg);
  font-size: var(--font-size-sm);
}

.auth-card__success {
  background: var(--color-success-bg-soft);
  color: var(--color-success-text);
  padding: var(--spacing-md);
  border-radius: var(--radius-sm);
  margin-bottom: var(--spacing-lg);
  font-size: var(--font-size-md);
  text-align: center;
}

.auth-card__footer {
  text-align: center;
  margin-top: var(--spacing-lg);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.auth-form__field {
  margin-bottom: var(--spacing-md);
}

.auth-form__hint {
  margin: 0 0 var(--spacing-lg);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-background);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.auth-form__required {
  color: var(--color-error-text);
}

.auth-form__label {
  display: block;
  margin-bottom: var(--spacing-sm);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.auth-form__input {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
  font-family: var(--font-family-base);
  color: var(--color-text);
  background: var(--color-background);
  transition: border-color var(--transition-base);
  box-sizing: border-box;
}

.auth-form__input:focus {
  outline: none;
}

.auth-form__input:focus-visible {
  border-color: var(--color-primary);
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  box-shadow: 0 0 0 2px var(--color-focus-ring);
}

.auth-form__input--error {
  border-color: var(--color-error);
}

.auth-form__input--textarea {
  resize: vertical;
  min-height: 80px;
}

.auth-form__field-error {
  display: block;
  color: var(--color-error-text);
  font-size: var(--font-size-xs);
  margin-top: var(--spacing-xs);
}

.auth-form__role-group {
  display: flex;
  gap: var(--spacing-sm);
}

.auth-form__role-btn {
  flex: 1;
  padding: var(--spacing-sm) var(--spacing-md);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-family: var(--font-family-base);
  cursor: pointer;
  transition: border-color var(--transition-base), background-color var(--transition-base), color var(--transition-base);
}

.auth-form__role-btn:hover:not(:disabled) {
  border-color: var(--color-primary-text);
}

.auth-form__role-btn--active {
  background: var(--color-primary-text);
  border-color: var(--color-primary-text);
  color: var(--color-white);
}

.auth-form__role-btn:focus-visible {
  outline: 2px solid var(--color-primary-text);
  outline-offset: 2px;
}

.auth-form__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
}

.auth-form__submit {
  width: 100%;
  margin-top: var(--spacing-md);
}

@media (max-width: 480px) {
  .auth-form__row {
    grid-template-columns: 1fr;
  }
}
</style>
