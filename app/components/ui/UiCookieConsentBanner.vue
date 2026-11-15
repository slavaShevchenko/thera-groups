<script setup lang="ts">
const { t, locale } = useLocale()

const COOKIE_NAME = 'cookie_consent'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

const isVisible = ref(false)

function getConsentCookie(): string | null {
  if (import.meta.server) return null
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`))
  return match ? match[1] : null
}

function setConsentCookie(value: string) {
  document.cookie = `${COOKIE_NAME}=${value}; max-age=${COOKIE_MAX_AGE}; path=/; SameSite=Lax`
}

onMounted(() => {
  if (!getConsentCookie()) {
    isVisible.value = true
  }
})

function accept() {
  setConsentCookie('accepted')
  isVisible.value = false
}

function decline() {
  setConsentCookie('declined')
  isVisible.value = false
}
</script>

<template>
  <Transition name="cookie-banner">
    <div
      v-if="isVisible"
      class="cookie-banner"
      role="dialog"
      aria-label="Cookie consent"
    >
      <div class="cookie-banner__content">
        <p class="cookie-banner__text">
          {{ t('layout.cookieConsent.text', { privacyLink: '' }) }}
          <NuxtLink
            :to="`/${locale}/privacy`"
            class="cookie-banner__link"
          >{{ t('layout.cookieConsent.privacyLink') }}</NuxtLink>
        </p>
        <div class="cookie-banner__actions">
          <UiButton
            :label="t('layout.cookieConsent.accept')"
            class="cookie-banner__btn cookie-banner__btn--accept"
            @click="accept"
          />
          <UiButton
            :label="t('layout.cookieConsent.decline')"
            class="cookie-banner__btn cookie-banner__btn--decline"
            @click="decline"
          />
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.cookie-banner {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background: var(--color-surface);
  border-top: var(--border-width) solid var(--color-border);
  box-shadow: 0 -4px 12px rgba(23, 58, 58, 0.08);
  padding: var(--spacing-md) var(--spacing-lg);
}

.cookie-banner__content {
  max-width: var(--container-width);
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-lg);
}

.cookie-banner__text {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text);
  line-height: var(--line-height-normal);
  flex: 1;
}

.cookie-banner__link {
  color: var(--color-primary-text);
  text-decoration: underline;
}

.cookie-banner__link:hover {
  color: var(--color-primary-hover);
}

.cookie-banner__actions {
  display: flex;
  gap: var(--spacing-sm);
  flex-shrink: 0;
}

.cookie-banner__btn {
  white-space: nowrap;
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--font-size-sm);
  border-radius: var(--radius-md);
  border: var(--border-width) solid transparent;
  cursor: pointer;
  font-family: var(--font-family-base);
  font-weight: var(--font-weight-medium);
  transition: background var(--transition-base), border-color var(--transition-base), color var(--transition-base);
}

.cookie-banner__btn--accept {
  background: var(--color-primary-text);
  color: var(--color-white);
}

.cookie-banner__btn--accept:hover {
  background: var(--color-primary-hover);
}

.cookie-banner__btn--decline {
  background: transparent;
  border-color: var(--color-border);
  color: var(--color-text-muted);
}

.cookie-banner__btn--decline:hover {
  border-color: var(--color-text-muted);
  color: var(--color-text);
}

.cookie-banner-enter-active,
.cookie-banner-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.cookie-banner-enter-from,
.cookie-banner-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

@media (max-width: 640px) {
  .cookie-banner__content {
    flex-direction: column;
    align-items: stretch;
    gap: var(--spacing-md);
  }

  .cookie-banner__actions {
    justify-content: stretch;
  }

  .cookie-banner__btn {
    flex: 1;
    text-align: center;
  }
}
</style>
