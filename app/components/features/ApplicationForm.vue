<script setup lang="ts">
interface Question {
  id: string
  question: string
  type: 'TEXT' | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE'
  required: boolean
  options: string[]
}

const props = defineProps<{
  slug: string
  questions: Question[]
}>()

const emit = defineEmits<{
  submitted: []
  closed: []
}>()

const { t } = useLocale()

const name = ref('')
const email = ref('')
const phone = ref('')
const answers = ref<Record<string, string>>({})
const isSubmitting = ref(false)
const isSubmitted = ref(false)
const errorMessage = ref('')
const fieldErrors = ref<Record<string, string>>({})

function validate(): boolean {
  const errors: Record<string, string> = {}

  if (name.value.trim().length < 2) {
    errors.name = t('applicationForm.errors.nameRequired')
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
    errors.email = t('applicationForm.errors.emailInvalid')
  }

  for (const q of props.questions) {
    if (q.required) {
      const val = (answers.value[q.id] ?? '').trim()
      if (!val) {
        errors[q.id] = t('applicationForm.errors.required')
      }
    }
  }

  fieldErrors.value = errors
  return Object.keys(errors).length === 0
}

async function submit() {
  if (!validate()) return

  isSubmitting.value = true
  errorMessage.value = ''

  try {
    await $fetch(`/api/groups/${props.slug}/apply`, {
      method: 'POST',
      body: {
        name: name.value.trim(),
        email: email.value.trim(),
        phone: phone.value.trim() || undefined,
        answers: props.questions.map(q => ({
          questionId: q.id,
          value: answers.value[q.id] ?? '',
        })),
      },
    })

    isSubmitted.value = true
    emit('submitted')
  }
  catch (e: unknown) {
    const err = e as { statusCode?: number }
    if (err?.statusCode === 409) {
      errorMessage.value = t('applicationForm.duplicateError')
    }
    else {
      errorMessage.value = t('applicationForm.genericError')
    }
  }
  finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="application-form">
    <div
      v-if="isSubmitted"
      class="application-form__success"
    >
      <div class="application-form__success-icon">
        &#x2705;
      </div>
      <p class="application-form__success-text">
        {{ t('applicationForm.successMessage') }}
      </p>
      <UiButton
        class="application-form__success-btn"
        @click="emit('closed')"
      >
        {{ t('common.actions.close') }}
      </UiButton>
    </div>

    <form
      v-else
      class="application-form__form"
      @submit.prevent="submit"
    >
      <div
        v-if="errorMessage"
        class="application-form__error"
        role="alert"
      >
        {{ errorMessage }}
      </div>

      <UiInput
        v-model="name"
        :label="t('applicationForm.name')"
        type="text"
        autocomplete="name"
        :disabled="isSubmitting"
        :error="fieldErrors.name"
        required
      />

      <UiInput
        v-model="email"
        :label="t('applicationForm.email')"
        type="email"
        autocomplete="email"
        :disabled="isSubmitting"
        :error="fieldErrors.email"
        required
      />

      <UiInput
        v-model="phone"
        :label="t('applicationForm.phone')"
        type="tel"
        autocomplete="tel"
        :disabled="isSubmitting"
      />

      <template
        v-for="q in questions"
        :key="q.id"
      >
        <div class="application-form__field">
          <UiTextarea
            v-if="q.type === 'TEXT'"
            v-model="answers[q.id]"
            :label="q.question"
            rows="3"
            :disabled="isSubmitting"
            :error="fieldErrors[q.id]"
            :required="q.required"
          />

          <div
            v-else-if="q.type === 'SINGLE_CHOICE'"
            class="application-form__radio-group"
          >
            <div class="application-form__radio-label">
              {{ q.question }}
              <span v-if="q.required"> *</span>
            </div>
            <UiRadio
              v-for="opt in q.options"
              :key="opt"
              v-model="answers[q.id]"
              :value="opt"
              :label="opt"
              :name="`q-${q.id}`"
              :disabled="isSubmitting"
            />
            <span
              v-if="fieldErrors[q.id]"
              class="application-form__field-error"
            >{{ fieldErrors[q.id] }}</span>
          </div>

          <div
            v-else-if="q.type === 'MULTIPLE_CHOICE'"
            class="application-form__options"
          >
            <div class="application-form__checkbox-label">
              {{ q.question }}
              <span v-if="q.required"> *</span>
            </div>
            <label
              v-for="opt in q.options"
              :key="opt"
              class="application-form__option"
            >
              <input
                type="checkbox"
                :value="opt"
                :disabled="isSubmitting"
                @change="
                  (e: Event) => {
                    const checked = (e.target as HTMLInputElement).checked
                    const current = (answers[q.id] ?? '').split(',').filter(Boolean)
                    if (checked) current.push(opt)
                    else {
                      const idx = current.indexOf(opt)
                      if (idx >= 0) current.splice(idx, 1)
                    }
                    answers[q.id] = current.join(',')
                  }
                "
              />
              {{ opt }}
            </label>
            <span
              v-if="fieldErrors[q.id]"
              class="application-form__field-error"
            >{{ fieldErrors[q.id] }}</span>
          </div>
        </div>
      </template>

      <UiButton
        type="submit"
        class="application-form__submit"
        :disabled="isSubmitting"
      >
        {{ isSubmitting ? t('applicationForm.submitting') : t('applicationForm.submit') }}
      </UiButton>
    </form>
  </div>
</template>

<style scoped>
.application-form__form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.application-form__field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.application-form__radio-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.application-form__radio-label,
.application-form__checkbox-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.application-form__field-error {
  font-size: var(--font-size-xs);
  color: var(--color-error);
}

.application-form__options {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.application-form__option {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  cursor: pointer;
}

.application-form__error {
  padding: var(--spacing-sm) var(--spacing-md);
  background: #FEF2F2;
  color: var(--color-error);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
}

.application-form__success {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-xl) 0;
  text-align: center;
}

.application-form__success-icon {
  font-size: 3rem;
}

.application-form__success-text {
  font-size: var(--font-size-md);
  color: var(--color-text);
  margin: 0;
}
</style>
