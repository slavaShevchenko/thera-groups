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

async function handleGoogleLogin() {
  const supabase = useSupabase()
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/${locale.value}/auth/callback`,
    },
  })
}

useHead({
  title: () => t('auth.login.title'),
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
  ],
})
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
            name="email"
            class="auth-form__input"
            :class="{ 'auth-form__input--error': fieldErrors.email }"
            autocomplete="username"
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
            name="password"
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

      <div class="auth-divider">
        <span class="auth-divider__text">{{ t('auth.or') }}</span>
      </div>

      <button
        type="button"
        class="auth-google-btn"
        :disabled="isLoading"
        @click="handleGoogleLogin"
      >
        <svg
          class="auth-google-btn__icon"
          viewBox="0 0 24 24"
          width="20"
          height="20"
        >
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        {{ t('auth.googleButton') }}
      </button>

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

.auth-divider {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin: var(--spacing-lg) 0;
}

.auth-divider::before,
.auth-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--color-border);
}

.auth-divider__text {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.auth-google-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-family: var(--font-family-base);
  cursor: pointer;
  transition: background var(--transition-base), border-color var(--transition-base);
}

.auth-google-btn:hover:not(:disabled) {
  background: var(--color-background);
  border-color: var(--color-text-muted);
}

.auth-google-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
