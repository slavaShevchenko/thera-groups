<script setup lang="ts">
const { t, locale } = useLocale()

const year = new Date().getFullYear()

// TODO: заменить '#' на реальные маршруты по мере создания страниц
const footerColumns = computed(() => [
  {
    titleKey: 'layout.footer.navigation',
    links: [
      { key: 'layout.header.nav.findGroup', to: `/${locale.value}/groups` },
      { key: 'layout.header.nav.organizers', to: '#' },
      { key: 'layout.header.nav.blog', to: '#' },
      { key: 'layout.header.nav.about', to: '#' },
      { key: 'layout.footer.faq', to: '#' },
    ],
  },
  {
    titleKey: 'layout.footer.organizers',
    links: [
      { key: 'layout.footer.createGroup', to: '#' },
      { key: 'layout.footer.cabinet', to: '#' },
      { key: 'layout.footer.guides', to: '#' },
      { key: 'layout.footer.rules', to: '#' },
    ],
  },
  {
    titleKey: 'layout.footer.support',
    links: [
      { key: 'layout.footer.contacts', to: '#' },
      { key: 'layout.footer.privacy', to: '#' },
      { key: 'layout.footer.terms', to: '#' },
    ],
  },
])

const onSubscribe = () => {
  // TODO: подключить подписку к API
}
</script>

<template>
  <footer class="app-footer">
    <div class="app-footer__container">
      <div class="app-footer__grid">
        <div class="app-footer__brand">
          <NuxtLink
            :to="`/${locale}`"
            class="app-footer__logo"
          >
            <UiIcon
              name="sprout"
              class="app-footer__logo-icon"
            />
            <span class="app-footer__logo-title">TheraGroups</span>
          </NuxtLink>
          <p class="app-footer__description">
            {{ t('layout.footer.description') }}
          </p>
        </div>

        <nav
          v-for="column in footerColumns"
          :key="column.titleKey"
          class="app-footer__column"
          :aria-label="t(column.titleKey)"
        >
          <h2 class="app-footer__column-title">
            {{ t(column.titleKey) }}
          </h2>
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

        <div class="app-footer__subscribe">
          <h2 class="app-footer__column-title">
            {{ t('layout.footer.subscribeTitle') }}
          </h2>
          <p class="app-footer__subscribe-text">
            {{ t('layout.footer.subscribeText') }}
          </p>
          <form
            class="app-footer__form"
            @submit.prevent="onSubscribe"
          >
            <input
              class="app-footer__input"
              type="email"
              required
              :placeholder="t('layout.footer.subscribePlaceholder')"
              :aria-label="t('layout.footer.subscribePlaceholder')"
            />
            <button
              class="app-footer__submit"
              type="submit"
              :aria-label="t('layout.footer.subscribeSubmit')"
            >
              <UiIcon
                name="arrow-right"
                class="app-footer__submit-icon"
              />
            </button>
          </form>
        </div>
      </div>

      <div class="app-footer__bottom">
        <p class="app-footer__copyright">
          © {{ year }} TheraGroups. {{ t('layout.footer.rights') }}
        </p>
        <p class="app-footer__made-with">
          {{ t('layout.footer.madeWith') }} 💚
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
  grid-template-columns: 1.3fr 0.8fr 0.9fr 0.9fr 1.3fr;
  gap: var(--spacing-xl);
}

.app-footer__logo {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  color: var(--color-text);
}

.app-footer__logo:hover {
  color: var(--color-text);
  text-decoration: none;
}

.app-footer__logo-icon {
  width: 2rem;
  height: 2rem;
  color: var(--color-primary);
}

.app-footer__logo-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}

.app-footer__description {
  margin: var(--spacing-sm) 0 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  line-height: var(--line-height-normal);
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
}

.app-footer__link:hover {
  color: var(--color-primary);
}

.app-footer__subscribe-text {
  margin: 0 0 var(--spacing-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  line-height: var(--line-height-normal);
}

.app-footer__form {
  display: flex;
  gap: var(--spacing-sm);
}

.app-footer__input {
  flex: 1;
  padding: var(--spacing-sm) var(--spacing-md);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-background);
  font-family: var(--font-family-base);
  font-size: var(--font-size-sm);
  color: var(--color-text);
}

.app-footer__input::placeholder {
  color: var(--color-text-muted);
}

.app-footer__submit {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  flex-shrink: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  color: #ffffff;
  cursor: pointer;
  transition: background-color var(--transition-base);
}

.app-footer__submit:hover {
  background: var(--color-primary-hover);
}

.app-footer__submit-icon {
  width: 1.25rem;
  height: 1.25rem;
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
