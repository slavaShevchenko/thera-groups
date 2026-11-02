<script setup lang="ts">
import type { QuestionInput } from '~~/types'
import { GROUP_LIMITS, LIMITS } from '~~/shared/constants/limits'

const props = defineProps<{
  modelValue: QuestionInput[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: QuestionInput[]]
}>()

const { t } = useLocale()

const questions = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

const isAdding = ref(false)
const inlineError = ref('')
const newQuestion = ref<QuestionInput>({
  question: '',
  type: 'TEXT',
  required: false,
  options: [],
})

const newOption = ref('')

const questionTextTooLong = computed(
  () => newQuestion.value.question.trim().length > GROUP_LIMITS.QUESTION_TEXT_MAX,
)

const questionTextError = computed(() =>
  questionTextTooLong.value
    ? t('errors.fieldTooLong', { max: GROUP_LIMITS.QUESTION_TEXT_MAX })
    : '',
)

function addQuestion() {
  if (!newQuestion.value.question.trim()) return
  if (questionTextTooLong.value) return

  if ((newQuestion.value.type === 'SINGLE_CHOICE' || newQuestion.value.type === 'MULTIPLE_CHOICE') && newQuestion.value.options.length < 2) {
    inlineError.value = t('groups.edit.questions.needOptions')
    return
  }

  inlineError.value = ''
  questions.value = [...questions.value, { ...newQuestion.value }]
  resetNewQuestion()
  isAdding.value = false
}

function resetNewQuestion() {
  newQuestion.value = {
    question: '',
    type: 'TEXT',
    required: false,
    options: [],
  }
  newOption.value = ''
}

function addOption() {
  if (!newOption.value.trim()) return
  newQuestion.value.options = [...newQuestion.value.options, newOption.value.trim()]
  newOption.value = ''
}

function removeOption(index: number) {
  newQuestion.value.options = newQuestion.value.options.filter((_, i) => i !== index)
}

const removeIndex = ref<number | null>(null)

function requestRemoveQuestion(index: number) {
  removeIndex.value = index
}

function confirmRemoveQuestion() {
  if (removeIndex.value !== null) {
    questions.value = questions.value.filter((_, i) => i !== removeIndex.value)
  }
  removeIndex.value = null
}

function moveQuestion(index: number, direction: 'up' | 'down') {
  const newIndex = direction === 'up' ? index - 1 : index + 1
  if (newIndex < 0 || newIndex >= questions.value.length) return

  const updated = [...questions.value]
  const temp = updated[index]
  const swap = updated[newIndex]
  if (temp && swap) {
    updated[index] = swap
    updated[newIndex] = temp
    questions.value = updated
  }
}
</script>

<template>
  <div class="questions-builder">
    <div
      v-if="questions.length"
      class="questions-builder__list"
    >
      <div
        v-for="(q, index) in questions"
        :key="index"
        class="questions-builder__item"
      >
        <div class="questions-builder__item-header">
          <div class="questions-builder__item-controls">
            <button
              type="button"
              class="questions-builder__move-btn"
              :disabled="index === 0 || disabled"
              :aria-label="t('groups.edit.questions.moveUp')"
              @click="moveQuestion(index, 'up')"
            >
              <span aria-hidden="true">↑</span>
            </button>
            <button
              type="button"
              class="questions-builder__move-btn"
              :disabled="index === questions.length - 1 || disabled"
              :aria-label="t('groups.edit.questions.moveDown')"
              @click="moveQuestion(index, 'down')"
            >
              <span aria-hidden="true">↓</span>
            </button>
          </div>

          <div class="questions-builder__item-content">
            <div class="questions-builder__item-text">
              {{ q.question }}
            </div>
            <div class="questions-builder__item-meta">
              <span class="questions-builder__badge">
                {{ q.type === 'TEXT' ? t('groups.edit.questions.typeText') : t('groups.edit.questions.typeMultiple') }}
              </span>
              <span
                v-if="q.required"
                class="questions-builder__badge questions-builder__badge--required"
              >
                {{ t('groups.edit.questions.required') }}
              </span>
              <span
                v-if="q.options.length"
                class="questions-builder__options-count"
              >
                {{ q.options.length }} {{ t('groups.edit.questions.options') }}
              </span>
            </div>
          </div>

          <UiButton
            variant="danger"
            class="questions-builder__remove-btn"
            :disabled="disabled"
            :aria-label="t('groups.edit.questions.delete')"
            @click="requestRemoveQuestion(index)"
          >
            <span aria-hidden="true">×</span>
          </UiButton>
        </div>

        <div
          v-if="q.options.length"
          class="questions-builder__options"
        >
          <div
            v-for="(opt, optIdx) in q.options"
            :key="optIdx"
            class="questions-builder__option"
          >
            {{ optIdx + 1 }}. {{ opt }}
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="isAdding"
      class="questions-builder__form"
    >
      <UiInput
        v-model="newQuestion.question"
        :label="t('groups.edit.questions.questionText')"
        :placeholder="t('groups.edit.questions.questionPlaceholder')"
        :max-chars="GROUP_LIMITS.QUESTION_TEXT_MAX"
        :error="questionTextError"
        :disabled="disabled"
      />

      <div class="questions-builder__form-row">
        <UiSelect
          v-model="newQuestion.type"
          :label="t('groups.edit.questions.type')"
          :disabled="disabled"
          :options="[
            { value: 'TEXT', label: t('groups.edit.questions.typeText') },
            { value: 'MULTIPLE_CHOICE', label: t('groups.edit.questions.typeMultiple') },
          ]"
        />

        <UiCheckbox
          v-model="newQuestion.required"
          :label="t('groups.edit.questions.required')"
          :disabled="disabled"
        />
      </div>

      <div
        v-if="newQuestion.type !== 'TEXT'"
        class="questions-builder__options-form"
      >
        <div class="questions-builder__options-label">
          {{ t('groups.edit.questions.optionsMin') }}
        </div>

        <div
          v-for="(opt, idx) in newQuestion.options"
          :key="idx"
          class="questions-builder__option-input"
        >
          <span>{{ idx + 1 }}.</span>
          <UiInput
            :model-value="opt"
            disabled
          />
          <UiButton
            variant="danger"
            size="sm"
            class="questions-builder__remove-option"
            :disabled="disabled"
            :aria-label="t('groups.edit.questions.deleteOption')"
            @click="removeOption(idx)"
          >
            <span aria-hidden="true">×</span>
          </UiButton>
        </div>

        <div class="questions-builder__add-option">
          <UiInput
            v-model="newOption"
            :placeholder="t('groups.edit.questions.optionPlaceholder')"
            :aria-label="t('groups.edit.questions.optionPlaceholder')"
            :disabled="disabled"
            @keydown.enter.prevent="addOption"
          />
          <UiButton
            variant="secondary"
            size="sm"
            class="questions-builder__add-option-btn"
            :disabled="disabled || !newOption.trim()"
            :aria-label="t('groups.edit.questions.addOption')"
            @click="addOption"
          >
            <span aria-hidden="true">+</span>
          </UiButton>
        </div>
      </div>

      <div class="questions-builder__form-actions">
        <UiButton
          variant="secondary"
          :disabled="disabled"
          @click="resetNewQuestion(); isAdding = false"
        >
          {{ t('common.cancel') }}
        </UiButton>
        <UiButton
          :disabled="disabled || !newQuestion.question.trim() || questionTextTooLong"
          @click="addQuestion"
        >
          {{ t('common.add') }}
        </UiButton>
      </div>
    </div>

    <div
      v-if="inlineError"
      class="questions-builder__error"
      role="alert"
    >
      {{ inlineError }}
    </div>

    <UiButton
      v-if="!isAdding && questions.length < LIMITS.MAX_QUESTIONS_PER_GROUP"
      variant="secondary"
      class="questions-builder__add-btn"
      :disabled="disabled"
      @click="isAdding = true"
    >
      + {{ t('groups.edit.questions.addQuestion') }}
    </UiButton>

    <p
      v-if="!isAdding && questions.length >= LIMITS.MAX_QUESTIONS_PER_GROUP"
      class="questions-builder__limit"
    >
      {{ t('groups.edit.questions.maxReached') }}
    </p>

    <UiConfirmModal
      :model-value="removeIndex !== null"
      :title="t('groups.edit.questions.confirmDeleteTitle')"
      :message="t('groups.edit.questions.confirmDeleteMessage')"
      @update:model-value="v => { if (!v) removeIndex = null }"
      @confirm="confirmRemoveQuestion"
    />
  </div>
</template>

<style scoped>
.questions-builder__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.questions-builder__item {
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm);
}

.questions-builder__item-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.questions-builder__item-controls {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.questions-builder__move-btn {
  padding: 2px 6px;
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-background);
  color: var(--color-text);
  font-size: var(--font-size-xs);
  cursor: pointer;
}

.questions-builder__move-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.questions-builder__item-content {
  flex: 1;
}

.questions-builder__item-text {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
  margin-bottom: var(--spacing-xs);
}

.questions-builder__item-meta {
  display: flex;
  gap: var(--spacing-xs);
  font-size: var(--font-size-xs);
}

.questions-builder__badge {
  padding: 2px 6px;
  background: var(--color-surface);
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
}

.questions-builder__badge--required {
  background: var(--color-primary);
  color: var(--color-white);
}

.questions-builder__options-count {
  color: var(--color-text-muted);
}

.questions-builder__remove-btn {
  padding: 4px 8px;
  border: none;
  background: transparent;
  color: var(--color-error);
  font-size: var(--font-size-lg);
  cursor: pointer;
  opacity: 0.6;
}

.questions-builder__remove-btn:hover:not(:disabled) {
  opacity: 1;
}

.questions-builder__remove-btn:disabled {
  cursor: not-allowed;
}

.questions-builder__options {
  margin-top: var(--spacing-sm);
  padding-left: var(--spacing-xl);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.questions-builder__option {
  padding: var(--spacing-xs) 0;
}

.questions-builder__form {
  border: var(--border-width) solid var(--color-primary);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-md);
  background: var(--color-surface);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.questions-builder__form-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--spacing-sm);
  align-items: end;
}

.questions-builder__options-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  margin-bottom: var(--spacing-xs);
}

.questions-builder__options-form {
  margin-top: var(--spacing-sm);
  padding: var(--spacing-md);
  background: var(--color-background);
  border-radius: var(--radius-md);
}

.questions-builder__option-input {
  display: grid;
  grid-template-columns: 20px 1fr auto;
  gap: var(--spacing-xs);
  align-items: center;
  margin-bottom: var(--spacing-xs);
}

.questions-builder__add-option {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--spacing-xs);
  margin-top: var(--spacing-xs);
}

.questions-builder__add-option-btn,
.questions-builder__remove-option {
  flex-shrink: 0;
}

.questions-builder__form-actions {
  display: flex;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-md);
  justify-content: flex-end;
}

.questions-builder__add-btn {
  width: 100%;
  padding: var(--spacing-md);
  border: var(--border-width) dashed var(--color-border);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-muted);
  font-size: var(--font-size-md);
  font-family: var(--font-family-base);
  cursor: pointer;
}

.questions-builder__add-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.questions-builder__add-btn:disabled {
  cursor: not-allowed;
}

.questions-builder__error {
  color: var(--color-error-text);
  background: var(--color-error-bg-soft);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  margin-bottom: var(--spacing-sm);
}

.questions-builder__limit {
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  margin: var(--spacing-sm) 0 0;
}
</style>
