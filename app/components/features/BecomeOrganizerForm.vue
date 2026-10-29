<script setup lang="ts">
import { PROFILE_LIMITS } from '~~/shared/constants/limits'

const { t } = useLocale()

const emit = defineEmits<{
  created: []
}>()

const firstName = ref('')
const lastName = ref('')
const qualification = ref('')
const fieldErrors = ref<Record<string, string>>({})
const submitError = ref('')
const isSubmitting = ref(false)

function validate(): boolean {
  const errors: Record<string, string> = {}

  // min(2) mirrors `createOrganizerProfileSchema`, so the server answer cannot name a
  // field this form already cleared.
  if (firstName.value.trim().length < 2) errors.firstName = t('errors.requiredField')
  if (lastName.value.trim().length < 2) errors.lastName = t('errors.requiredField')
  if (qualification.value.trim().length > PROFILE_LIMITS.QUALIFICATION_MAX) {
    errors.qualification = t('errors.fieldTooLong', { max: PROFILE_LIMITS.QUALIFICATION_MAX })
  }

  fieldErrors.value = errors
  return Object.keys(errors).length === 0
}

function mapServerIssues(issues: Array<{ path: string, message: string }>) {
  const errors: Record<string, string> = { ...fieldErrors.value }
  for (const issue of issues) {
    const field = issue.path.split('.')[0]
    if (field && !errors[field]) {
      errors[field] = issue.message
    }
  }
  fieldErrors.value = errors
}

async function handleSubmit() {
  if (!validate()) return

  isSubmitting.value = true
  submitError.value = ''
  fieldErrors.value = {}

  try {
    await $fetch('/api/organizers/me', {
      method: 'POST',
      body: {
        firstName: firstName.value.trim(),
        lastName: lastName.value.trim(),
        qualification: qualification.value.trim() || undefined,
      },
    })

    emit('created')
  }
  catch (error) {
    const err = error as {
      statusCode?: number
      data?: { code?: string, issues?: Array<{ path: string, message: string }> }
    }

    if (err?.statusCode === 400 && err.data?.issues) {
      mapServerIssues(err.data.issues)
    }

    // 409 means the profile appeared between render and submit — a second tab, or a role
    // the session had not refreshed yet. Retrying cannot help, so the message says so.
    submitError.value = err?.statusCode === 409
      ? t('profile.becomeOrganizer.conflict')
      : t('profile.becomeOrganizer.error')

    console.error('Become organizer failed:', error)
  }
  finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <section class="become-organizer">
    <h2 class="become-organizer__title">
      {{ t('profile.becomeOrganizer.title') }}
    </h2>
    <p class="become-organizer__text">
      {{ t('profile.becomeOrganizer.text') }}
    </p>

    <div
      v-if="submitError"
      class="become-organizer__error"
      role="alert"
    >
      {{ submitError }}
    </div>

    <form
      class="become-organizer__form"
      novalidate
      @submit.prevent="handleSubmit"
    >
      <div class="become-organizer__row">
        <UiInput
          v-model="firstName"
          :label="t('common.firstName')"
          autocomplete="given-name"
          required
          :max-chars="PROFILE_LIMITS.FIRST_NAME_MAX"
          :error="fieldErrors.firstName"
          :disabled="isSubmitting"
        />
        <UiInput
          v-model="lastName"
          :label="t('common.lastName')"
          autocomplete="family-name"
          required
          :max-chars="PROFILE_LIMITS.LAST_NAME_MAX"
          :error="fieldErrors.lastName"
          :disabled="isSubmitting"
        />
      </div>

      <UiInput
        v-model="qualification"
        :label="t('common.qualification')"
        :max-chars="PROFILE_LIMITS.QUALIFICATION_MAX"
        :error="fieldErrors.qualification"
        :disabled="isSubmitting"
      />

      <UiButton
        type="submit"
        :label="t('profile.becomeOrganizer.submit')"
        :loading="isSubmitting"
        :disabled="isSubmitting"
      />
    </form>
  </section>
</template>

<style scoped>
.become-organizer {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  margin-top: var(--spacing-lg);
  padding: var(--spacing-lg);
  background: var(--color-background);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-lg);
}

.become-organizer__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  margin: 0;
}

.become-organizer__text {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.become-organizer__error {
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-error-bg-soft);
  border: var(--border-width) solid var(--color-error-border-soft);
  border-radius: var(--radius-sm);
  color: var(--color-error-text);
  font-size: var(--font-size-sm);
}

.become-organizer__form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.become-organizer__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
}

@media (max-width: 480px) {
  .become-organizer__row {
    grid-template-columns: 1fr;
  }
}
</style>
