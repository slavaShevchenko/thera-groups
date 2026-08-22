<script setup lang="ts">
const { t } = useLocale()
const { user, isAuthenticated } = useUser()

const dismissed = ref(false)

const isVisible = computed(() => {
  if (dismissed.value) return false

  return isAuthenticated.value
    && user.value?.role === 'THERAPIST'
    && user.value?.therapistProfile?.verificationStatus === 'PENDING'
})

function dismiss() {
  dismissed.value = true
}
</script>

<template>
  <div
    v-if="isVisible"
    class="moderation-banner"
    role="status"
  >
    <span class="moderation-banner__text">{{ t('auth.moderation.message') }}</span>
    <button
      class="moderation-banner__close"
      type="button"
      :aria-label="t('common.actions.cancel')"
      @click="dismiss"
    >
      &times;
    </button>
  </div>
</template>

<style scoped>
.moderation-banner {
  position: sticky;
  top: var(--header-height);
  z-index: 99;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-success);
  color: #ffffff;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.moderation-banner__text {
  text-align: center;
}

.moderation-banner__close {
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: #ffffff;
  font-size: var(--font-size-xl);
  line-height: 1;
  cursor: pointer;
  padding: 0 var(--spacing-xs);
  opacity: 0.8;
  transition: opacity var(--transition-base);
}

.moderation-banner__close:hover {
  opacity: 1;
}
</style>
