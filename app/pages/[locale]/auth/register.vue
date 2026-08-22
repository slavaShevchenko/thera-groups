<script setup lang="ts">
const { t, locale } = useLocale()
const { register, error } = useUser()

const selectedRole = ref<'VISITOR' | 'THERAPIST'>('VISITOR')
const email = ref('')
const password = ref('')
const passwordConfirm = ref('')
const firstName = ref('')
const lastName = ref('')
const bio = ref('')
const qualification = ref('')
const fieldErrors = ref<Record<string, string>>({})
const moderationMessage = ref('')
const isSubmitting = ref(false)

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
  else if (password.value.length < 8) {
    errors.password = t('auth.errors.passwordMin')
  }

  if (password.value !== passwordConfirm.value) {
    errors.passwordConfirm = t('auth.errors.passwordMismatch')
  }

  if (selectedRole.value === 'THERAPIST') {
    if (!firstName.value.trim()) {
      errors.firstName = t('auth.errors.required')
    }
    if (!lastName.value.trim()) {
      errors.lastName = t('auth.errors.required')
    }
  }

  fieldErrors.value = errors
  return Object.keys(errors).length === 0
}

async function handleSubmit() {
  if (!validate()) return

  isSubmitting.value = true

  const payload: Record<string, unknown> = {
    email: email.value,
    password: password.value,
    role: selectedRole.value,
    preferredLocale: locale.value,
  }

  if (selectedRole.value === 'THERAPIST') {
    payload.therapistData = {
      firstName: firstName.value,
      lastName: lastName.value,
      bio: bio.value || undefined,
      qualification: qualification.value || undefined,
    }
  }

  const result = await register(payload)
  isSubmitting.value = false

  if (result) {
    if (selectedRole.value === 'THERAPIST') {
      moderationMessage.value = t('auth.moderation.message')
      setTimeout(() => {
        navigateTo(`/${locale.value}/`)
      }, 3000)
    }
    else {
      await navigateTo(`/${locale.value}/`)
    }
  }
}

useHead({ title: () => t('auth.register.title') })
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
              :disabled="isSubmitting"
              @click="selectedRole = 'VISITOR'"
            >
              {{ t('auth.register.role.participant') }}
            </button>
            <button
              type="button"
              class="auth-form__role-btn"
              :class="{ 'auth-form__role-btn--active': selectedRole === 'THERAPIST' }"
              role="radio"
              :aria-checked="selectedRole === 'THERAPIST'"
              :disabled="isSubmitting"
              @click="selectedRole = 'THERAPIST'"
            >
              {{ t('auth.register.role.therapist') }}
            </button>
          </div>
        </div>

        <div class="auth-form__field">
          <label
            for="register-email"
            class="auth-form__label"
          >
            {{ t('auth.login.email') }}
          </label>
          <input
            id="register-email"
            v-model="email"
            type="email"
            class="auth-form__input"
            :class="{ 'auth-form__input--error': fieldErrors.email }"
            autocomplete="email"
            :disabled="isSubmitting"
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
          </label>
          <input
            id="register-password"
            v-model="password"
            type="password"
            class="auth-form__input"
            :class="{ 'auth-form__input--error': fieldErrors.password }"
            autocomplete="new-password"
            :disabled="isSubmitting"
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
          </label>
          <input
            id="register-password-confirm"
            v-model="passwordConfirm"
            type="password"
            class="auth-form__input"
            :class="{ 'auth-form__input--error': fieldErrors.passwordConfirm }"
            autocomplete="new-password"
            :disabled="isSubmitting"
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

        <template v-if="selectedRole === 'THERAPIST'">
          <div class="auth-form__row">
            <div class="auth-form__field">
              <label
                for="register-firstName"
                class="auth-form__label"
              >
                {{ t('auth.register.firstName') }}
              </label>
              <input
                id="register-firstName"
                v-model="firstName"
                type="text"
                class="auth-form__input"
                :class="{ 'auth-form__input--error': fieldErrors.firstName }"
                autocomplete="given-name"
                :disabled="isSubmitting"
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
                {{ t('auth.register.lastName') }}
              </label>
              <input
                id="register-lastName"
                v-model="lastName"
                type="text"
                class="auth-form__input"
                :class="{ 'auth-form__input--error': fieldErrors.lastName }"
                autocomplete="family-name"
                :disabled="isSubmitting"
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
              {{ t('auth.register.qualification') }}
            </label>
            <input
              id="register-qualification"
              v-model="qualification"
              type="text"
              class="auth-form__input"
              :disabled="isSubmitting"
            />
          </div>

          <div class="auth-form__field">
            <label
              for="register-bio"
              class="auth-form__label"
            >
              {{ t('auth.register.bio') }}
            </label>
            <textarea
              id="register-bio"
              v-model="bio"
              class="auth-form__input auth-form__input--textarea"
              rows="3"
              :disabled="isSubmitting"
            ></textarea>
          </div>
        </template>

        <UiButton
          :label="t('auth.register.submit')"
          type="submit"
          :disabled="isSubmitting"
          class="auth-form__submit"
        />
      </form>

      <p class="auth-card__footer">
        {{ t('auth.register.haveAccount') }}
        <NuxtLink :to="`/${locale}/auth/login`">
          {{ t('auth.register.loginLink') }}
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
  background: rgba(217, 83, 79, 0.1);
  color: var(--color-error);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-sm);
  margin-bottom: var(--spacing-lg);
  font-size: var(--font-size-sm);
}

.auth-card__success {
  background: rgba(92, 184, 92, 0.1);
  color: var(--color-success);
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

.auth-form__label {
  display: block;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  margin-bottom: var(--spacing-xs);
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
  border-color: var(--color-primary);
  outline: none;
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
  color: var(--color-error);
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
  transition: all var(--transition-base);
}

.auth-form__role-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
}

.auth-form__role-btn--active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-surface);
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
