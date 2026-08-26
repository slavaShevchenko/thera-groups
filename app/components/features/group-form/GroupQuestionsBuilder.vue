<script setup lang="ts">
import type { GroupQuestion } from '~/composables/useGroupForm'

const props = defineProps<{
  modelValue: GroupQuestion[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: GroupQuestion[]]
}>()

const { t } = useLocale()

const questions = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

const isAdding = ref(false)
const newQuestion = ref<GroupQuestion>({
  question: '',
  type: 'TEXT',
  required: false,
  options: [],
})

const newOption = ref('')

function addQuestion() {
  if (!newQuestion.value.question.trim()) return

  if ((newQuestion.value.type === 'SINGLE_CHOICE' || newQuestion.value.type === 'MULTIPLE_CHOICE') && newQuestion.value.options.length < 2) {
    alert(t('groups.edit.questions.needOptions'))
    return
  }

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
  updated[index] = updated[newIndex]
  updated[newIndex] = temp
  questions.value = updated
}

const presets = computed(() => [
  { question: t('groups.edit.questions.presets.aboutYourself'), type: 'TEXT', required: true, options: [] },
  { question: t('groups.edit.questions.presets.whyJoin'), type: 'TEXT', required: true, options: [] },
  { question: t('groups.edit.questions.presets.experience'), type: 'TEXT', required: false, options: [] },
])

function addPreset(preset: GroupQuestion) {
  questions.value = [...questions.value, { ...preset }]
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
              @click="moveQuestion(index, 'up')"
            >
              ↑
            </button>
            <button
              type="button"
              class="questions-builder__move-btn"
              :disabled="index === questions.length - 1 || disabled"
              @click="moveQuestion(index, 'down')"
            >
              ↓
            </button>
          </div>

          <div class="questions-builder__item-content">
            <div class="questions-builder__item-text">
              {{ q.question }}
            </div>
            <div class="questions-builder__item-meta">
              <span class="questions-builder__badge">
                {{ q.type }}
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
            @click="requestRemoveQuestion(index)"
          >
            ×
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
      v-if="!isAdding && questions.length < 10"
      class="questions-builder__presets"
    >
      <UiButton
        v-for="(preset, idx) in presets"
        :key="idx"
        variant="secondary"
        class="questions-builder__preset-btn"
        :disabled="disabled"
        @click="addPreset(preset)"
      >
        + {{ preset.question }}
      </UiButton>
    </div>

    <div
      v-if="isAdding"
      class="questions-builder__form"
    >
      <UiInput
        v-model="newQuestion.question"
        :label="t('groups.edit.questions.questionText')"
        :placeholder="t('groups.edit.questions.questionPlaceholder')"
        :disabled="disabled"
      />

      <div class="questions-builder__form-row">
        <UiSelect
          v-model="newQuestion.type"
          :label="t('groups.edit.questions.type')"
          :disabled="disabled"
          :options="[
            { value: 'TEXT', label: t('groups.edit.questions.typeText') },
            { value: 'SINGLE_CHOICE', label: t('groups.edit.questions.typeSingle') },
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
          {{ t('groups.edit.questions.options') }} (мін 2)
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
          <button
            type="button"
            class="questions-builder__remove-option"
            :disabled="disabled"
            @click="removeOption(idx)"
          >
            ×
          </button>
        </div>

        <div class="questions-builder__add-option">
          <UiInput
            v-model="newOption"
            :placeholder="t('groups.edit.questions.optionPlaceholder')"
            :disabled="disabled"
            @keydown.enter.prevent="addOption"
          />
          <button
            type="button"
            class="questions-builder__add-option-btn"
            :disabled="disabled || !newOption.trim()"
            @click="addOption"
          >
            +
          </button>
        </div>
      </div>

      <div class="questions-builder__form-actions">
        <UiButton
          variant="secondary"
          class="questions-builder__btn"
          :disabled="disabled"
          @click="resetNewQuestion(); isAdding = false"
        >
          {{ t('common.cancel') }}
        </UiButton>
        <UiButton
          class="questions-builder__btn questions-builder__btn--primary"
          :disabled="disabled || !newQuestion.question.trim()"
          @click="addQuestion"
        >
          {{ t('groups.edit.questions.add') }}
        </UiButton>
      </div>
    </div>

    <UiButton
      v-if="!isAdding && questions.length < 10"
      variant="secondary"
      class="questions-builder__add-btn"
      :disabled="disabled"
      @click="isAdding = true"
    >
      + {{ t('groups.edit.questions.addQuestion') }}
    </UiButton>

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
  color: #fff;
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

.questions-builder__presets {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-md);
}

.questions-builder__preset-btn {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: var(--border-width) dashed var(--color-border);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.questions-builder__preset-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.questions-builder__preset-btn:disabled {
  cursor: not-allowed;
}

.questions-builder__form {
  border: var(--border-width) solid var(--color-primary);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-md);
  background: var(--color-surface);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
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
  padding: var(--spacing-sm);
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
  padding: var(--spacing-sm);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  color: var(--color-text);
  cursor: pointer;
}

.questions-builder__add-option-btn:disabled,
.questions-builder__remove-option:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.questions-builder__form-actions {
  display: flex;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-md);
  justify-content: flex-end;
}

.questions-builder__btn {
  padding: var(--spacing-sm) var(--spacing-md);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-family: var(--font-family-base);
  cursor: pointer;
}

.questions-builder__btn--primary {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}

.questions-builder__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
</style>
