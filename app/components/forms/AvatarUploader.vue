<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    uploadUrl: string
    currentAvatarUrl?: string | null
    label?: string
    disabled?: boolean
  }>(),
  {
    currentAvatarUrl: null,
    label: '',
    disabled: false,
  },
)

const emit = defineEmits<{
  uploaded: [url: string]
}>()

const { t } = useLocale()

const isUploading = ref(false)
const isDragOver = ref(false)
const previewUrl = ref<string | null>(props.currentAvatarUrl)
const error = ref('')

watch(() => props.currentAvatarUrl, (val) => {
  previewUrl.value = val
})

let fileInput: HTMLInputElement | null = null

function setFileInput(el: HTMLInputElement | null) {
  fileInput = el
}

function triggerFileInput() {
  fileInput?.click()
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = true
}

function onDragLeave() {
  isDragOver.value = false
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = false
  const file = e.dataTransfer?.files[0]
  if (file) uploadFile(file)
}

function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) uploadFile(file)
  target.value = ''
}

async function uploadFile(file: File) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowed.includes(file.type)) {
    error.value = 'Unsupported file type'
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    error.value = 'File too large (max 5MB)'
    return
  }

  error.value = ''
  isUploading.value = true

  try {
    const formData = new FormData()
    formData.append('file', file)

    const response = await $fetch<{ avatarUrl: string }>(props.uploadUrl, {
      method: 'POST',
      body: formData,
    })

    previewUrl.value = response.avatarUrl
    emit('uploaded', response.avatarUrl)
  }
  catch {
    error.value = t('common.errors.fetchFailed')
  }
  finally {
    isUploading.value = false
  }
}
</script>

<template>
  <div class="forms-avatar-uploader">
    <label
      v-if="label"
      class="forms-avatar-uploader__label"
    >
      {{ label }}
    </label>
    <div
      class="forms-avatar-uploader__dropzone"
      :class="{
        'forms-avatar-uploader__dropzone--dragover': isDragOver,
        'forms-avatar-uploader__dropzone--disabled': disabled,
      }"
      role="button"
      tabindex="0"
      :aria-label="t('profile.edit.avatarUpload')"
      @click="triggerFileInput"
      @keydown.enter="triggerFileInput"
      @keydown.space.prevent="triggerFileInput"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <img
        v-if="previewUrl"
        :src="previewUrl"
        :alt="t('profile.edit.avatar')"
        class="forms-avatar-uploader__preview"
      />
      <div
        v-else
        class="forms-avatar-uploader__placeholder"
      >
        <span class="forms-avatar-uploader__placeholder-icon">📷</span>
        <span class="forms-avatar-uploader__placeholder-text">
          {{ t('profile.edit.avatarDrop') }}
        </span>
      </div>
      <div
        v-if="isUploading"
        class="forms-avatar-uploader__loading"
        :aria-label="t('common.loading')"
      ></div>
      <input
        :ref="setFileInput"
        type="file"
        class="forms-avatar-uploader__input"
        accept="image/jpeg,image/png,image/webp"
        :disabled="disabled || isUploading"
        @change="onFileChange"
      />
    </div>
    <span
      v-if="error"
      class="forms-avatar-uploader__error"
      role="alert"
    >
      {{ error }}
    </span>
  </div>
</template>

<style scoped>
.forms-avatar-uploader__label {
  display: block;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  margin-bottom: var(--spacing-xs);
}

.forms-avatar-uploader__dropzone {
  position: relative;
  width: 120px;
  height: 120px;
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-full);
  overflow: hidden;
  cursor: pointer;
  transition: border-color var(--transition-base);
  display: flex;
  align-items: center;
  justify-content: center;
}

.forms-avatar-uploader__dropzone:hover:not(.forms-avatar-uploader__dropzone--disabled),
.forms-avatar-uploader__dropzone:focus-visible:not(.forms-avatar-uploader__dropzone--disabled) {
  border-color: var(--color-primary);
}

.forms-avatar-uploader__dropzone--dragover {
  border-color: var(--color-primary);
  background: rgba(111, 163, 155, 0.05);
}

.forms-avatar-uploader__dropzone--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.forms-avatar-uploader__preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.forms-avatar-uploader__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm);
  text-align: center;
}

.forms-avatar-uploader__placeholder-icon {
  font-size: var(--font-size-xl);
}

.forms-avatar-uploader__placeholder-text {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  line-height: var(--line-height-tight);
}

.forms-avatar-uploader__input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.forms-avatar-uploader__loading {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.forms-avatar-uploader__loading::after {
  content: '';
  width: 24px;
  height: 24px;
  border: 2px solid #fff;
  border-top-color: transparent;
  border-radius: 50%;
  animation: forms-avatar-spin 0.6s linear infinite;
}

@keyframes forms-avatar-spin {
  to { transform: rotate(360deg); }
}

.forms-avatar-uploader__error {
  display: block;
  color: var(--color-error);
  font-size: var(--font-size-xs);
  margin-top: var(--spacing-xs);
}
</style>
