<script setup lang="ts">
const { t, locale } = useLocale()
const { login, isLoading, error } = useUser()

const email = ref('')
const password = ref('')
const fieldErrors = ref<Record<string, string>>({})

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

  fieldErrors.value = errors
  return Object.keys(errors).length === 0
}

async function handleSubmit() {
  if (!validate()) return
  await login({ email: email.value, password: password.value })
}

useHead({ title: () => t('auth.login.title') })
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <h1 class="auth-card__title">
        {{ t('auth.login.title') }}
      </h1>

      <div
        v-if="error"
        class="auth-card__error"
        role="alert"
      >
        {{ error }}
      </div>

      <form
        class="auth-form"
        novalidate
        @submit.prevent="handleSubmit"
      >
        <div class="auth-form__field">
          <label
            for="login-email"
            class="auth-form__label"
          >
            {{ t('auth.login.email') }}
          </label>
          <input
            id="login-email"
            v-model="email"
            type="email"
            class="auth-form__input"
            :class="{ 'auth-form__input--error': fieldErrors.email }"
            autocomplete="email"
            :disabled="isLoading"
            aria-describedby="login-email-error"
          />
          <span
            v-if="fieldErrors.email"
            id="login-email-error"
            class="auth-form__field-error"
            role="alert"
          >
            {{ fieldErrors.email }}
          </span>
        </div>

        <div class="auth-form__field">
          <label
            for="login-password"
            class="auth-form__label"
          >
            {{ t('auth.login.password') }}
          </label>
          <input
            id="login-password"
            v-model="password"
            type="password"
            class="auth-form__input"
            :class="{ 'auth-form__input--error': fieldErrors.password }"
            autocomplete="current-password"
            :disabled="isLoading"
            aria-describedby="login-password-error"
          />
          <span
            v-if="fieldErrors.password"
            id="login-password-error"
            class="auth-form__field-error"
            role="alert"
          >
            {{ fieldErrors.password }}
          </span>
        </div>

        <UiButton
          :label="t('auth.login.submit')"
          type="submit"
          :disabled="isLoading"
          class="auth-form__submit"
        />
      </form>

      <p class="auth-card__footer">
        {{ t('auth.login.noAccount') }}
        <NuxtLink :to="`/${locale}/auth/register`">
          {{ t('auth.login.registerLink') }}
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
  max-width: 420px;
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

.auth-form__field-error {
  display: block;
  color: var(--color-error);
  font-size: var(--font-size-xs);
  margin-top: var(--spacing-xs);
}

.auth-form__submit {
  width: 100%;
  margin-top: var(--spacing-md);
}
</style>
