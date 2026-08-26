<script setup lang="ts">
interface Question {
  id: string
  question: string
  type: 'TEXT' | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE'
  required: boolean
  options: string[]
}

const { t, locale } = useLocale()
const route = useRoute()

const slug = route.params.slug as string

const { data: group, pending, error } = await useFetch(`/api/groups/${slug}`, {
  key: `group-${slug}`,
})

const isModalOpen = ref(false)
const questions = ref<Question[]>([])
const questionsLoaded = ref(false)
const isFavorited = ref(false)

// Initialize favorite state from API response
watch(() => group.value, (g) => {
  if (g && 'isFavorited' in g) {
    isFavorited.value = (g as Record<string, unknown>).isFavorited as boolean
  }
}, { immediate: true })

function onFavoriteToggled(favorited: boolean) {
  isFavorited.value = favorited
}

async function openApplyModal() {
  isModalOpen.value = true
  if (!questionsLoaded.value) {
    try {
      questions.value = await $fetch<Question[]>(`/api/groups/${slug}/questions`)
    }
    catch {
      questions.value = []
    }
    questionsLoaded.value = true
  }
}

function onSubmitted() {
  // Keep modal open to show success state
}

function onClosed() {
  isModalOpen.value = false
}

const requestURL = useRequestURL()

const canonicalUrl = computed(() =>
  group.value ? `${requestURL.origin}/${locale.value}/groups/${slug}` : '',
)

const seoDescription = computed(() => {
  if (!group.value?.description) return ''
  return group.value.description.length > 160
    ? group.value.description.slice(0, 160)
    : group.value.description
})

const jsonLd = computed(() => {
  if (!group.value) return ''
  const g = group.value
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Event',
    'name': g.title,
    'description': g.description?.slice(0, 200),
    'startDate': g.startsAt,
    'endDate': g.endsAt,
    'eventStatus': 'https://schema.org/EventScheduled',
    'eventAttendanceMode': g.format === 'ONLINE'
      ? 'https://schema.org/OnlineEventAttendanceMode'
      : g.format === 'HYBRID'
        ? 'https://schema.org/MixedEventAttendanceMode'
        : 'https://schema.org/OfflineEventAttendanceMode',
    'location': g.format === 'ONLINE'
      ? { '@type': 'VirtualLocation', 'url': requestURL.origin }
      : { '@type': 'Place', 'name': g.location || 'Online' },
    'organizer': {
      '@type': 'Person',
      'name': `${g.organizer.firstName} ${g.organizer.lastName}`,
      'url': `${requestURL.origin}/${locale.value}/organizers/${g.organizer.slug || ''}`,
    },
    'offers': {
      '@type': 'Offer',
      'price': g.price,
      'priceCurrency': g.currency || 'UAH',
      'availability': 'https://schema.org/InStock',
    },
  })
})

useHead({
  title: computed(() => group.value ? `${group.value.title} | TheraGroups` : 'TheraGroups'),
  link: [
    { rel: 'canonical', href: canonicalUrl.value },
  ],
  meta: [
    { name: 'description', content: seoDescription.value },
    { name: 'robots', content: 'index, follow' },
    { property: 'og:title', content: computed(() => group.value?.title ?? 'TheraGroups') },
    { property: 'og:description', content: seoDescription.value },
    { property: 'og:url', content: canonicalUrl.value },
    { property: 'og:type', content: 'article' },
  ],
  script: [
    { type: 'application/ld+json', innerHTML: () => jsonLd.value },
  ],
})

const localeHead = useLocaleHead()
useHead(localeHead)

const formatLabel = (format: string) => {
  const labels: Record<string, string> = {
    ONLINE: t('common.formats.online'),
    OFFLINE: t('common.formats.offline'),
    HYBRID: t('common.formats.hybrid'),
  }

  return labels[format] ?? format
}
</script>

<template>
  <div class="group-page">
    <div
      v-if="pending"
      class="group-page__loading"
    >
      {{ t('common.loading') }}
    </div>

    <div
      v-else-if="error || !group"
      class="group-page__not-found"
    >
      <h1 class="group-page__not-found-title">
        {{ t('groupPage.notFoundTitle') }}
      </h1>
      <p class="group-page__not-found-text">
        {{ t('groupPage.notFoundText') }}
      </p>
      <NuxtLink
        :to="`/${locale}`"
        class="group-page__back-link"
      >
        {{ t('groupPage.backToCatalog') }}
      </NuxtLink>
    </div>

    <article
      v-else
      class="group-page__content"
    >
      <NuxtLink
        :to="`/${locale}`"
        class="group-page__back-link"
      >
        <UiIcon
          name="arrow-left"
          class="group-page__back-icon"
        />
        {{ t('groupPage.backToCatalog') }}
      </NuxtLink>

      <header class="group-page__header">
        <div class="group-page__header-info">
          <span class="group-page__category">{{ group.category.name }}</span>
          <h1 class="group-page__title">
            {{ group.title }}
          </h1>
          <UiPill
            class="group-page__type-pill"
            :label="t(`groupTypes.${group.type}`)"
          />
        </div>
        <FavoriteButton
          :slug="slug"
          :initial-favorited="isFavorited"
          size="lg"
          @toggled="onFavoriteToggled"
        />
      </header>

      <section class="group-page__meta">
        <div class="group-page__meta-item">
          <span class="group-page__meta-label">{{ t('groups.format') }}</span>
          <span class="group-page__meta-value">{{ formatLabel(group.format) }}</span>
        </div>
        <div
          v-if="group.location"
          class="group-page__meta-item"
        >
          <span class="group-page__meta-label">{{ t('groupPage.location') }}</span>
          <span class="group-page__meta-value">{{ group.location }}</span>
        </div>
        <div class="group-page__meta-item">
          <span class="group-page__meta-label">{{ t('groups.startDate') }}</span>
          <span class="group-page__meta-value">{{ formatDate(group.startsAt, locale) }}</span>
        </div>
        <div class="group-page__meta-item">
          <span class="group-page__meta-label">{{ t('groupPage.endDate') }}</span>
          <span class="group-page__meta-value">{{ formatDate(group.endsAt, locale) }}</span>
        </div>
        <div class="group-page__meta-item">
          <span class="group-page__meta-label">{{ t('groups.capacity') }}</span>
          <span class="group-page__meta-value">{{ group.capacity }}</span>
        </div>
        <div class="group-page__meta-item">
          <span class="group-page__meta-label">{{ t('groups.price') }}</span>
          <span class="group-page__meta-value">{{ formatPrice(group.price, group.currency) }}</span>
        </div>
      </section>

      <section class="group-page__section">
        <h2 class="group-page__section-title">
          {{ t('groupPage.description') }}
        </h2>
        <p class="group-page__text">
          {{ group.description }}
        </p>
      </section>

      <section class="group-page__section">
        <h2 class="group-page__section-title">
          {{ t('groupPage.aboutOrganizer') }}
        </h2>
        <div class="group-page__organizer">
          <div class="group-page__organizer-avatar">
            <img
              v-if="group.organizer.avatar"
              :src="group.organizer.avatar"
              :alt="`${group.organizer.firstName} ${group.organizer.lastName}`"
            />
            <span v-else>
              {{ group.organizer.firstName[0] }}{{ group.organizer.lastName[0] }}
            </span>
          </div>
          <div class="group-page__organizer-info">
            <div class="group-page__organizer-name">
              {{ group.organizer.firstName }} {{ group.organizer.lastName }}
            </div>
            <div
              v-if="group.organizer.qualification"
              class="group-page__organizer-qualification"
            >
              {{ group.organizer.qualification }}
            </div>
            <p
              v-if="group.organizer.bio"
              class="group-page__organizer-bio"
            >
              {{ group.organizer.bio }}
            </p>
          </div>
        </div>
      </section>

      <footer class="group-page__footer">
        <UiButton
          class="group-page__apply-btn"
          @click="openApplyModal"
        >
          {{ t('groupPage.apply') }}
        </UiButton>
      </footer>
    </article>

    <div class="group-page__sticky-cta">
      <UiButton
        class="group-page__apply-btn group-page__apply-btn--sticky"
        @click="openApplyModal"
      >
        {{ t('groupPage.apply') }}
      </UiButton>
    </div>

    <UiModal
      v-model="isModalOpen"
      :title="t('applicationForm.title')"
      max-width="560px"
    >
      <ApplicationForm
        :slug="slug"
        :questions="questions"
        @submitted="onSubmitted"
        @closed="onClosed"
      />
    </UiModal>
  </div>
</template>

<style scoped>
.group-page {
  padding: var(--spacing-xl) var(--spacing-lg);
  max-width: var(--container-width);
  margin: 0 auto;
}

.group-page__loading {
  text-align: center;
  padding: var(--spacing-2xl);
  font-size: var(--font-size-lg);
  color: var(--color-text-muted);
}

.group-page__not-found {
  text-align: center;
  padding: var(--spacing-2xl);
}

.group-page__not-found-title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  margin: 0 0 var(--spacing-sm);
}

.group-page__not-found-text {
  font-size: var(--font-size-md);
  color: var(--color-text-muted);
  margin: 0 0 var(--spacing-lg);
}

.group-page__back-link {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  margin-bottom: var(--spacing-lg);
}

.group-page__back-link:hover {
  color: var(--color-primary);
  text-decoration: none;
}

.group-page__back-icon {
  width: 1rem;
  height: 1rem;
}

.group-page__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
}

.group-page__category {
  font-size: var(--font-size-xs);
  color: var(--color-primary);
  font-weight: var(--font-weight-medium);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.group-page__title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  margin: var(--spacing-xs) 0 0;
  line-height: var(--line-height-tight);
}

.group-page__type-pill {
  margin-top: var(--spacing-sm);
}

.group-page__tag {
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-full);
  background: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.group-page__meta {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-xl);
}

.group-page__meta-item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.group-page__meta-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.group-page__meta-value {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.group-page__section {
  margin-bottom: var(--spacing-xl);
}

.group-page__section-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  margin: 0 0 var(--spacing-md);
}

.group-page__text {
  font-size: var(--font-size-md);
  color: var(--color-text);
  line-height: var(--line-height-relaxed);
  margin: 0;
}

.group-page__organizer {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
}

.group-page__organizer-avatar {
  width: 4rem;
  height: 4rem;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  overflow: hidden;
  flex-shrink: 0;
}

.group-page__organizer-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.group-page__organizer-name {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
}

.group-page__organizer-qualification {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin-top: var(--spacing-xs);
}

.group-page__organizer-bio {
  font-size: var(--font-size-sm);
  color: var(--color-text);
  line-height: var(--line-height-normal);
  margin: var(--spacing-sm) 0 0;
}

.group-page__footer {
  padding-top: var(--spacing-lg);
  border-top: var(--border-width) solid var(--color-border);
}

.group-page__apply-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: var(--spacing-md) var(--spacing-xl);
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  font-family: var(--font-family-base);
  cursor: pointer;
  transition: background var(--transition-base);
}

.group-page__apply-btn:hover {
  background: var(--color-primary-hover);
}

.group-page__sticky-cta {
  display: none;
}

@media (max-width: 768px) {
  .group-page__meta {
    grid-template-columns: repeat(2, 1fr);
  }

  .group-page__sticky-cta {
    display: block;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 50;
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--color-surface);
    border-top: var(--border-width) solid var(--color-border);
    box-shadow: 0 -2px 8px rgba(23, 58, 58, 0.1);
  }

  .group-page__apply-btn--sticky {
    font-size: var(--font-size-md);
    padding: var(--spacing-sm) var(--spacing-lg);
  }

  .group-page__footer {
    display: none;
  }
}
</style>
