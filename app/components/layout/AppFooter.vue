<script setup lang="ts">
const { t, locale } = useLocale()

const year = new Date().getFullYear()

// Info pages routes
const footerColumns = computed(() => [
  {
    titleKey: 'common.navigation',
    links: [
      { key: 'layout.header.nav.findGroup', to: `/${locale.value}/catalog` },
      { key: 'common.organizers', to: `/${locale.value}/organizers` },
      { key: 'layout.header.nav.about', to: `/${locale.value}/about` },
      { key: 'layout.footer.faq', to: `/${locale.value}/faq` },
    ],
  },
  {
    titleKey: 'layout.footer.support',
    links: [
      { key: 'layout.footer.contacts', to: `/${locale.value}/contacts` },
      { key: 'layout.footer.privacy', to: `/${locale.value}/privacy` },
      { key: 'layout.footer.terms', to: `/${locale.value}/terms` },
    ],
  },
])
</script>

<template>
  <footer class="app-footer">
    <div class="app-footer__container">
      <div class="app-footer__grid">
        <div class="app-footer__brand">
          <UiLogo />
        </div>

        <nav
          v-for="column in footerColumns"
          :key="column.titleKey"
          class="app-footer__column"
          :aria-label="t(column.titleKey)"
        >
          <p class="app-footer__column-title">
            {{ t(column.titleKey) }}
          </p>
          <ul class="app-footer__list">
            <li
              v-for="link in column.links"
              :key="link.key"
              class="app-footer__item"
            >
              <NuxtLink
                :to="link.to"
                class="app-footer__link"
              >
                {{ t(link.key) }}
              </NuxtLink>
            </li>
          </ul>
        </nav>
      </div>

      <div class="app-footer__bottom">
        <p class="app-footer__copyright">
          © {{ year }} {{ t('seo.siteName') }}. {{ t('layout.footer.rights') }}
        </p>
        <p class="app-footer__made-with">
          {{ t('layout.footer.madeWith') }} <span aria-hidden="true">💚</span>
        </p>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.app-footer {
  background: var(--color-surface);
  border-top: var(--border-width) solid var(--color-border);
  margin-top: var(--spacing-2xl);
}

.app-footer__container {
  max-width: var(--container-width);
  margin: 0 auto;
  padding: var(--spacing-2xl) var(--spacing-lg) var(--spacing-lg);
}

.app-footer__grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr 1fr;
  gap: var(--spacing-xl);
}

.app-footer__column-title {
  margin: 0 0 var(--spacing-md);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
}

.app-footer__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.app-footer__link {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  text-decoration: none;
}

.app-footer__link:hover {
  color: var(--color-primary);
}

.app-footer__bottom {
  display: flex;
  justify-content: space-between;
  gap: var(--spacing-md);
  margin-top: var(--spacing-2xl);
  padding-top: var(--spacing-md);
  border-top: var(--border-width) solid var(--color-border);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.app-footer__copyright,
.app-footer__made-with {
  margin: 0;
}

@media (max-width: 1024px) {
  .app-footer__grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .app-footer__grid {
    grid-template-columns: 1fr;
  }

  .app-footer__bottom {
    flex-direction: column;
  }
}
</style>
