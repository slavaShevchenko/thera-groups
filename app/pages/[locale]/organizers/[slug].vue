<script setup lang="ts">
const { t, locale } = useLocale()
const route = useRoute()
const slug = route.params.slug as string

const { data: organizer } = await useAsyncData(
  `organizer-${slug}`,
  () => $fetch(`/api/organizers/${slug}`),
)

if (!organizer.value) {
  throw createError({
    statusCode: 404,
    statusMessage: t('organizer.profile.notFound'),
  })
}

const fullName = computed(() =>
  organizer.value ? `${organizer.value.firstName} ${organizer.value.lastName}` : '',
)

const bioDescription = computed(() => {
  if (!organizer.value?.bio) return ''
  return organizer.value.bio.length > 160
    ? organizer.value.bio.slice(0, 160)
    : organizer.value.bio
})

const requestURL = useRequestURL()

const canonicalUrl = computed(() =>
  organizer.value ? `${requestURL.origin}/${locale.value}/organizers/${slug}` : '',
)

const jsonLd = computed(() => {
  if (!organizer.value) return ''
  const o = organizer.value
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Person',
    'name': `${o.firstName} ${o.lastName}`,
    'description': o.bio?.slice(0, 200),
    'image': o.avatarUrl,
    'jobTitle': o.qualification,
    'url': canonicalUrl.value,
    'sameAs': [o.telegramUrl, o.instagramUrl, o.linkedinUrl].filter(Boolean),
  })
})

const localeHead = useLocaleHead()

useHead({
  title: computed(() =>
    organizer.value
      ? `${organizer.value.firstName} ${organizer.value.lastName} — ${locale.value === 'ua' ? 'Організатор' : 'Organizer'}`
      : 'TheraGroups',
  ),
  meta: computed(() => {
    const meta: { name?: string, property?: string, content: string }[] = []

    if (bioDescription.value) {
      meta.push({ name: 'description', content: bioDescription.value })
      meta.push({ property: 'og:description', content: bioDescription.value })
    }

    if (organizer.value?.avatarUrl) {
      meta.push({ property: 'og:image', content: organizer.value.avatarUrl })
    }

    meta.push({ property: 'og:title', content: fullName.value })
    meta.push({ property: 'og:url', content: canonicalUrl.value })
    meta.push({ property: 'og:type', content: 'profile' })
    meta.push({ name: 'twitter:card', content: 'summary' })

    return meta
  }),
  link: [
    { rel: 'canonical', href: canonicalUrl.value },
    ...localeHead.link,
  ],
  script: [
    { type: 'application/ld+json', innerHTML: () => jsonLd.value },
  ],
})

const formatLabel = (format: string) => {
  const labels: Record<string, string> = {
    ONLINE: t('common.formats.online'),
    OFFLINE: t('common.formats.offline'),
    MIXED: t('profile.edit.formatsMixed'),
    HYBRID: t('common.formats.hybrid'),
  }

  return labels[format] ?? format
}

const specializationName = (spec: { nameUa: string, nameEn: string }) =>
  locale.value === 'ua' ? spec.nameUa : spec.nameEn

interface OrganizerGroup {
  id: string
  slug: string
  title: string
  description: string
  format: string
  type: string
  location: string | null
  price: number
  currency: string
  capacity: number
  startsAt: string
  therapist: {
    firstName: string
    lastName: string
    avatar: string | null
  } | null
}

const mapGroupForCard = (group: OrganizerGroup) => ({
  ...group,
  organizer: {
    firstName: group.therapist?.firstName ?? '',
    lastName: group.therapist?.lastName ?? '',
    avatar: group.therapist?.avatar ?? null,
  },
})
</script>

<template>
  <div class="organizer-page">
    <div
      v-if="!organizer"
      class="organizer-page__loading"
    >
      {{ t('common.loading') }}
    </div>

    <template v-else>
      <header class="organizer-page__header">
        <div class="organizer-page__avatar">
          <img
            v-if="organizer.avatarUrl"
            :src="organizer.avatarUrl"
            :alt="fullName"
            class="organizer-page__avatar-image"
            width="200"
            height="200"
          />
          <UiIcon
            v-else
            name="user-round"
            :size="80"
            class="organizer-page__avatar-placeholder"
          />
        </div>

        <h1 class="organizer-page__name">
          {{ fullName }}
        </h1>

        <span class="organizer-page__verified">
          <UiIcon
            name="badge-check"
            :size="16"
            class="organizer-page__verified-icon"
          />
          {{ t('organizer.profile.verified') }}
        </span>

        <p
          v-if="organizer.experienceYears"
          class="organizer-page__experience"
        >
          {{ t('organizer.profile.experience', { years: organizer.experienceYears }) }}
        </p>
      </header>

      <section
        v-if="organizer.bio || organizer.qualification"
        class="organizer-page__section"
      >
        <h2 class="organizer-page__section-title">
          {{ t('organizer.profile.about') }}
        </h2>
        <p
          v-if="organizer.bio"
          class="organizer-page__text"
        >
          {{ organizer.bio }}
        </p>
        <p
          v-if="organizer.qualification"
          class="organizer-page__text organizer-page__text--muted"
        >
          {{ organizer.qualification }}
        </p>
      </section>

      <section
        v-if="organizer.specializations?.length || organizer.customSpecializations?.length"
        class="organizer-page__section"
      >
        <h2 class="organizer-page__section-title">
          {{ t('organizer.profile.specializations') }}
        </h2>
        <div class="organizer-page__pills">
          <span
            v-for="spec in organizer.specializations"
            :key="spec.id"
            class="organizer-page__pill organizer-page__pill--system"
          >
            {{ specializationName(spec) }}
          </span>
          <span
            v-for="(custom, index) in organizer.customSpecializations"
            :key="`custom-${index}`"
            class="organizer-page__pill organizer-page__pill--custom"
          >
            {{ custom }}
          </span>
        </div>
      </section>

      <section
        v-if="organizer.workFormats?.length"
        class="organizer-page__section"
      >
        <h2 class="organizer-page__section-title">
          {{ t('organizer.profile.formats') }}
        </h2>
        <div class="organizer-page__badges">
          <span
            v-for="format in organizer.workFormats"
            :key="format"
            class="organizer-page__badge"
          >
            {{ formatLabel(format) }}
          </span>
        </div>
      </section>

      <section
        v-if="organizer.languages?.length"
        class="organizer-page__section"
      >
        <h2 class="organizer-page__section-title">
          {{ t('organizer.profile.languages') }}
        </h2>
        <div class="organizer-page__badges">
          <span
            v-for="lang in organizer.languages"
            :key="lang"
            class="organizer-page__badge"
          >
            {{ lang }}
          </span>
        </div>
      </section>

      <section
        v-if="organizer.city"
        class="organizer-page__section"
      >
        <h2 class="organizer-page__section-title">
          {{ t('organizer.profile.city') }}
        </h2>
        <p class="organizer-page__text">
          {{ organizer.city }}
        </p>
      </section>

      <section
        v-if="organizer.education"
        class="organizer-page__section"
      >
        <h2 class="organizer-page__section-title">
          {{ t('organizer.profile.education') }}
        </h2>
        <p class="organizer-page__text">
          {{ organizer.education }}
        </p>
      </section>

      <section
        v-if="organizer.telegramUrl || organizer.instagramUrl || organizer.linkedinUrl"
        class="organizer-page__section"
      >
        <h2 class="organizer-page__section-title">
          {{ t('organizer.profile.social') }}
        </h2>
        <div class="organizer-page__social-links">
          <a
            v-if="organizer.telegramUrl"
            :href="organizer.telegramUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="organizer-page__social-link"
            :aria-label="'Telegram'"
          >
            <UiIcon
              name="send"
              :size="20"
            />
          </a>
          <a
            v-if="organizer.instagramUrl"
            :href="organizer.instagramUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="organizer-page__social-link"
            :aria-label="'Instagram'"
          >
            <UiIcon
              name="instagram"
              :size="20"
            />
          </a>
          <a
            v-if="organizer.linkedinUrl"
            :href="organizer.linkedinUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="organizer-page__social-link"
            :aria-label="'LinkedIn'"
          >
            <UiIcon
              name="linkedin"
              :size="20"
            />
          </a>
        </div>
      </section>

      <section class="organizer-page__section">
        <h2 class="organizer-page__section-title">
          {{ t('organizer.profile.groupsCount', { count: organizer.groups?.length ?? 0 }) }}
        </h2>

        <div
          v-if="organizer.groups?.length"
          class="organizer-page__groups-grid"
        >
          <GroupCard
            v-for="group in organizer.groups"
            :key="group.id"
            :group="mapGroupForCard(group)"
          />
        </div>

        <p
          v-else
          class="organizer-page__text organizer-page__text--muted"
        >
          {{ t('organizer.profile.groupsEmpty') }}
        </p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.organizer-page {
  max-width: var(--container-width);
  margin: 0 auto;
  padding: var(--spacing-xl) var(--spacing-lg);
}

.organizer-page__loading {
  text-align: center;
  padding: var(--spacing-2xl);
  font-size: var(--font-size-lg);
  color: var(--color-text-muted);
}

.organizer-page__header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-bottom: var(--spacing-2xl);
}

.organizer-page__avatar {
  width: 200px;
  height: 200px;
  border-radius: var(--radius-full);
  overflow: hidden;
  background: var(--color-background-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--spacing-lg);
  flex-shrink: 0;
}

.organizer-page__avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.organizer-page__avatar-placeholder {
  color: var(--color-text-muted);
}

.organizer-page__name {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  margin: 0 0 var(--spacing-sm);
  line-height: var(--line-height-tight);
}

.organizer-page__verified {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-full);
  background: var(--color-success);
  color: #ffffff;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  margin-bottom: var(--spacing-sm);
}

.organizer-page__verified-icon {
  flex-shrink: 0;
}

.organizer-page__experience {
  font-size: var(--font-size-md);
  color: var(--color-text-muted);
  margin: 0;
}

.organizer-page__section {
  margin-bottom: var(--spacing-xl);
}

.organizer-page__section-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  margin: 0 0 var(--spacing-md);
}

.organizer-page__text {
  font-size: var(--font-size-md);
  color: var(--color-text);
  line-height: var(--line-height-relaxed);
  margin: 0;
}

.organizer-page__text--muted {
  color: var(--color-text-muted);
  margin-top: var(--spacing-sm);
}

.organizer-page__pills {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.organizer-page__pill {
  display: inline-block;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-full);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.organizer-page__pill--system {
  background: var(--color-primary);
  color: #ffffff;
}

.organizer-page__pill--custom {
  background: var(--color-background-accent);
  color: var(--color-text-muted);
}

.organizer-page__badges {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.organizer-page__badge {
  display: inline-flex;
  align-items: center;
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-full);
  border: var(--border-width) solid var(--color-border);
  background: var(--color-surface);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.organizer-page__social-links {
  display: flex;
  gap: var(--spacing-md);
}

.organizer-page__social-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: var(--radius-full);
  border: var(--border-width) solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-muted);
  transition: color var(--transition-base), border-color var(--transition-base);
}

.organizer-page__social-link:hover {
  color: var(--color-primary);
  border-color: var(--color-primary);
  text-decoration: none;
}

.organizer-page__groups-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--spacing-lg);
}

@media (max-width: 768px) {
  .organizer-page__avatar {
    width: 120px;
    height: 120px;
  }

  .organizer-page__groups-grid {
    grid-template-columns: 1fr;
  }
}
</style>
