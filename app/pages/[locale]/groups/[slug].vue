<script setup lang="ts">
import type { Question, GroupData } from '~~/types'
import { groupAcceptsApplications, isPastGroup } from '~~/shared/utils/groupVisibility'
import { NuxtLink } from '#components'

const { t, locale } = useLocale()
const route = useRoute()

const slug = computed(() => route.params.slug as string)

const backTo = ref<{ to: string, label: string } | null>(null)

const { data: group, pending, error } = await useFetch<GroupData>(`/api/groups/${slug.value}`, {
  key: computed(() => `group-${slug.value}`),
  // breadcrumbEntity.global.ts already fetched this under the same key before render.
  // Nuxt's default getCachedData reads static.data on a server render, which is empty
  // for a dynamic route, so without this the handler would run a second time.
  getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] as GroupData | undefined,
})

if (!group.value && !pending.value) {
  throw createError({ statusCode: 404, statusMessage: 'Group not found' })
}

onMounted(() => {
  const source = takeBackTo()
  if (!source) {
    backTo.value = null
    return
  }
  const map: Record<string, { to: string, labelKey: string }> = {
    catalog: { to: `/${locale.value}/catalog`, labelKey: 'groupPage.backToCatalog' },
    my: { to: `/${locale.value}/groups/my`, labelKey: 'groupPage.backToMyGroups' },
    admin: { to: `/${locale.value}/admin`, labelKey: 'groupPage.backToAdmin' },
    favorites: { to: `/${locale.value}/favorites`, labelKey: 'groupPage.backToFavorites' },
  }
  // organizers/[slug].vue sends its visitors here with source 'organizer'. Where to go
  // back to is only known from the loaded group, and a profile without a slug has no
  // public page — so the link is dropped instead of pointing at /organizers/.
  const organizerSlug = group.value?.organizer?.slug
  if (organizerSlug) {
    map.organizer = { to: `/${locale.value}/organizers/${organizerSlug}`, labelKey: 'groupPage.backToOrganizer' }
  }
  const cfg = map[source]
  if (cfg) {
    backTo.value = { to: cfg.to, label: t(cfg.labelKey) }
  }
})

const isModalOpen = ref(false)
const questions = ref<Question[]>([])
const questionsLoaded = ref(false)
const isFavorited = ref(false)

watch(() => group.value, (g) => {
  if (g && 'isFavorited' in g) {
    isFavorited.value = g.isFavorited
  }
}, { immediate: true })

function onFavoriteToggled(favorited: boolean) {
  isFavorited.value = favorited
}

const loadError = ref<string | null>(null)

async function openApplyModal() {
  if (!questionsLoaded.value) {
    try {
      questions.value = await $fetch<Question[]>(`/api/groups/${slug.value}/questions`)
      questionsLoaded.value = true
      loadError.value = null
      isModalOpen.value = true
    }
    catch (error) {
      console.error('Failed to load questions:', error)
      loadError.value = t('common.errors.failedToLoadQuestions')
      isModalOpen.value = true
    }
  }
  else {
    loadError.value = null
    isModalOpen.value = true
  }
}

function onSubmitted() {
  // Keep modal open to show success state
}

function onClosed() {
  isModalOpen.value = false
}

const siteUrl = useRuntimeConfig().public.siteUrl as string

const canonicalUrl = computed(() =>
  group.value ? `${siteUrl}/${locale.value}/groups/${slug.value}` : '',
)

const seoDescription = computed(() => {
  if (!group.value?.description) return ''
  return group.value.description.length > 160
    ? group.value.description.slice(0, 160)
    : group.value.description
})

/**
 * The apply gate, and it is not just `status === 'PUBLISHED'`: nothing moves a group to
 * COMPLETED automatically, so an event that finished last week still says PUBLISHED. The
 * server refuses it either way — this only decides whether to render the button.
 */
const canApply = computed(() => groupAcceptsApplications(group.value))

const isPast = computed(() => isPastGroup(group.value))

// Both decided server-side and sent as booleans. The payload no longer carries the user ids
// these two used to be recomputed from, which is the point: an anonymous visitor was being
// handed `organizer.userId` and every co-organizer's id purely so the client could re-run
// `can()` itself.
const canEditGroup = computed(() => group.value?.viewer?.canEdit ?? false)
const canViewUnpublished = computed(() => group.value?.viewer?.canViewUnpublished ?? false)

const jsonLd = computed(() => {
  if (!group.value) return ''
  return buildGroupEventJsonLd({
    group: group.value,
    siteUrl,
    canonicalUrl: canonicalUrl.value,
    locale: locale.value,
    acceptsApplications: canApply.value,
  })
})

useSeoPage({
  title: () => group.value ? `${group.value.title} | ${t('seo.siteName')}` : t('seo.siteName'),
  description: () => seoDescription.value,
  canonicalUrl: canonicalUrl.value,
  ogType: 'article',
  jsonLd: () => jsonLd.value,
})

const formatLabel = (format: string | null) => formatGroupFormat(format, t)

/**
 * Native names joined for the sidebar, the same way the organizer profile lists them.
 *
 * Native rather than translated on purpose: somebody reading this page in the language the
 * group runs in recognises its own name, and there is no Ukrainian or English wording for
 * most of the ~180 codes the picker offers.
 */
const languagesLabel = computed(() =>
  (group.value?.languages ?? []).map(languageLabel).join(', '),
)

const allOrganizers = computed(() => {
  const organizer = group.value?.organizer
  if (!group.value || !organizer) return []

  const main = {
    id: 'main',
    firstName: organizer.firstName,
    lastName: organizer.lastName,
    avatarUrl: organizer.avatarUrl,
    qualification: organizer.qualification,
    bio: organizer.bio,
    subtitle: organizer.qualification || '',
    slug: organizer.slug || null,
  }

  // The payload arrives already flattened: a co-organizer without a profile has a null slug
  // and empty names, and there is no user id to key on, so the position is the key.
  const coOrgs = (group.value.coOrganizers ?? []).map((co, index) => ({
    id: co.slug ?? `co-${index}`,
    firstName: co.firstName,
    lastName: co.lastName,
    avatarUrl: co.avatarUrl,
    qualification: null,
    bio: null,
    subtitle: co.role?.trim() || t('groups.coOrganizer'),
    slug: co.slug,
  }))

  return [main, ...coOrgs]
})

const leadsTitle = computed(() =>
  allOrganizers.value.length > 1
    ? t('groupPage.leads')
    : t('groupPage.aboutOrganizer'),
)

const gridCols = computed(() => Math.min(allOrganizers.value.length, 3))

/**
 * Why this group cannot be applied to.
 *
 * `FULL`, `COMPLETED` and a past `PUBLISHED` are all publicly visible, so an anonymous
 * visitor lands here and needs the reason rather than a page with no button and no
 * explanation — which is what FULL and COMPLETED rendered as before. The DRAFT,
 * PENDING_REVIEW and REJECTED rows are only reachable by a privileged viewer and stay
 * behind `canViewUnpublished` in the template.
 */
const closedReasonKey = computed(() => {
  const g = group.value
  if (!g || canApply.value) return null

  if (g.status === 'FULL') return 'groupPage.banner.full'
  if (g.status === 'COMPLETED') return 'groupPage.banner.completed'
  if (isPast.value) return 'groupPage.banner.ended'

  const map: Record<string, string> = {
    DRAFT: 'groupPage.banner.draft',
    PENDING_REVIEW: 'groupPage.banner.pendingReview',
    REJECTED: 'groupPage.banner.rejected',
    CANCELLED: 'groupPage.banner.cancelled',
  }
  return map[g.status] ?? null
})

/**
 * Whether the reason is public. `FULL`, `COMPLETED` and a past event are listed in the
 * catalog, so anyone can land here and must be told why there is no apply button; the
 * moderation states are only rendered for an owner, co-organizer or admin.
 */
const closedReasonIsPublic = computed(() => {
  const status = group.value?.status
  if (status === 'FULL' || status === 'COMPLETED') return true

  return status === 'PUBLISHED' && isPast.value
})

/**
 * Banner colour, grouped by meaning rather than by status: "not decided yet", "closed for
 * good" and "did not go ahead" cover all seven states, so a new status picks a tone
 * instead of needing its own CSS block.
 */
const bannerTone = computed(() => {
  const status = group.value?.status
  if (status === 'REJECTED' || status === 'CANCELLED') return 'alert'
  if (status === 'FULL' || status === 'COMPLETED' || isPast.value) return 'closed'
  return status === 'PENDING_REVIEW' ? 'review' : 'draft'
})

/**
 * Short label beside the title — "no places left", "completed", "past event". Only for the
 * states a visitor can actually reach: the moderation statuses are already covered by the
 * banner, and repeating them here would show an owner two labels for one fact.
 */
const statusPillKey = computed(() => {
  const status = group.value?.status
  if (!closedReasonIsPublic.value) return null
  if (status === 'FULL') return 'groupPage.status.full'
  if (status === 'COMPLETED') return 'groupPage.status.completed'

  return 'groupPage.status.past'
})

const statusPillVariant = computed(() =>
  group.value?.status === 'FULL' ? 'info' : 'neutral',
)
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
        v-if="backTo"
        :to="backTo.to"
        class="group-page__back-link"
      >
        {{ backTo.label }}
      </NuxtLink>
    </div>

    <article
      v-else
      class="group-page__content"
    >
      <NuxtLink
        v-if="backTo"
        :to="backTo.to"
        class="group-page__back-link"
      >
        <UiIcon
          name="arrow-left"
          class="group-page__back-icon"
        />
        {{ backTo.label }}
      </NuxtLink>

      <header class="group-page__header">
        <div class="group-page__header-info">
          <h1 class="group-page__title">
            {{ group.title }}
          </h1>
          <div class="group-page__pills">
            <UiPill
              v-if="group.type"
              :label="t(`groupTypes.${group.type}`)"
              variant="primary"
            />
            <UiPill
              v-if="statusPillKey"
              :label="t(statusPillKey)"
              :variant="statusPillVariant"
            />
          </div>
        </div>
        <FavoriteButton
          :slug="slug"
          :initial-favorited="isFavorited"
          size="lg"
          @toggled="onFavoriteToggled"
        />
      </header>

      <div
        v-if="closedReasonKey && (closedReasonIsPublic || canViewUnpublished)"
        class="group-page__status-banner"
        :class="`group-page__status-banner--${bannerTone}`"
      >
        <span class="group-page__status-banner-text">
          {{ t(closedReasonKey) }}
        </span>
        <NuxtLink
          v-if="canEditGroup"
          :to="`/${locale}/groups/edit/${slug}`"
          class="group-page__status-banner-link"
        >
          {{ t('common.edit') }}
        </NuxtLink>
      </div>

      <div class="group-page__layout">
        <div class="group-page__main">
          <section class="group-page__section">
            <h2 class="group-page__section-title">
              {{ t('groupPage.description') }}
            </h2>
            <p class="group-page__text">
              {{ group.description }}
            </p>
          </section>

          <section
            v-if="group.program"
            class="group-page__section"
          >
            <h2 class="group-page__section-title">
              {{ t('groupPage.program') }}
            </h2>
            <p class="group-page__text">
              {{ group.program }}
            </p>
          </section>
        </div>

        <aside class="group-page__sidebar">
          <section class="group-page__meta">
            <div
              v-if="group.format"
              class="group-page__meta-item"
            >
              <span class="group-page__meta-label">{{ t('common.format') }}</span>
              <span class="group-page__meta-value">{{ formatLabel(group.format) }}</span>
            </div>
            <div
              v-if="group.location"
              class="group-page__meta-item"
            >
              <span class="group-page__meta-label">{{ t('common.location') }}</span>
              <span class="group-page__meta-value">{{ group.location }}</span>
            </div>
            <div
              v-if="languagesLabel"
              class="group-page__meta-item"
            >
              <span class="group-page__meta-label">{{ t('common.languages') }}</span>
              <span class="group-page__meta-value">{{ languagesLabel }}</span>
            </div>
            <div class="group-page__meta-item">
              <span class="group-page__meta-label">{{ t('groups.startDate') }}</span>
              <span class="group-page__meta-value">{{ formatDate(group.startsAt, locale) }}</span>
            </div>
            <div
              v-if="group.endsAt"
              class="group-page__meta-item"
            >
              <span class="group-page__meta-label">{{ t('common.endDate') }}</span>
              <span class="group-page__meta-value">{{ formatDate(group.endsAt, locale) }}</span>
            </div>
            <div
              v-if="group.capacity != null"
              class="group-page__meta-item"
            >
              <span class="group-page__meta-label">{{ t('groups.capacity') }}</span>
              <span class="group-page__meta-value">{{ group.capacity }}</span>
            </div>
            <div
              v-if="group.minParticipants != null"
              class="group-page__meta-item"
            >
              <span class="group-page__meta-label">{{ t('groups.minParticipants') }}</span>
              <span class="group-page__meta-value">{{ group.minParticipants }}</span>
            </div>
            <div
              v-if="group.durationHours != null"
              class="group-page__meta-item"
            >
              <span class="group-page__meta-label">{{ t('groups.durationHours') }}</span>
              <span class="group-page__meta-value">{{ group.durationHours }}</span>
            </div>
            <div class="group-page__meta-item">
              <span class="group-page__meta-label">{{ t('groups.price') }}</span>
              <span class="group-page__meta-value">{{ formatPrice(group.priceAmount, group.currency, t('groups.free')) }}</span>
            </div>
            <div
              v-if="group.certificateIssued != null"
              class="group-page__meta-item"
            >
              <span class="group-page__meta-value">
                {{ group.certificateIssued ? t('groupPage.certificateIssued') : t('groupPage.certificateNotIssued') }}
              </span>
            </div>
          </section>
        </aside>
      </div>

      <section class="group-page__section">
        <h2 class="group-page__section-title">
          {{ leadsTitle }}
        </h2>
        <div
          class="group-page__organizers"
          :class="`group-page__organizers--${gridCols}`"
        >
          <component
            :is="org.slug ? NuxtLink : 'div'"
            v-for="org in allOrganizers"
            :key="org.id"
            :to="org.slug ? `/${locale}/organizers/${org.slug}` : undefined"
            class="group-page__organizer-card"
            :class="{ 'group-page__organizer-card--link': org.slug }"
          >
            <div class="group-page__organizer-avatar">
              <img
                v-if="org.avatarUrl"
                :src="org.avatarUrl"
                :alt="`${org.firstName} ${org.lastName}`"
              />
              <span
                v-else
                aria-hidden="true"
              >{{ getInitials(org.firstName, org.lastName) }}</span>
            </div>
            <div class="group-page__organizer-info">
              <div class="group-page__organizer-name">
                {{ org.firstName }} {{ org.lastName }}
              </div>
              <div
                v-if="org.subtitle"
                class="group-page__organizer-qualification"
              >
                {{ org.subtitle }}
              </div>
            </div>
          </component>
        </div>
      </section>

      <footer
        v-if="canApply"
        class="group-page__footer"
      >
        <UiButton
          class="group-page__apply-btn"
          @click="openApplyModal"
        >
          {{ t('groupPage.apply') }}
        </UiButton>
      </footer>
    </article>

    <div
      v-if="canApply"
      class="group-page__sticky-cta"
    >
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
      <div
        v-if="loadError"
        class="group-page__modal-error"
      >
        <p>{{ loadError }}</p>
        <UiButton
          variant="secondary"
          @click="openApplyModal"
        >
          {{ t('common.actions.confirm') }}
        </UiButton>
      </div>
      <ApplicationForm
        v-else-if="questionsLoaded"
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

.group-page__status-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-xl);
}

.group-page__status-banner--draft {
  background: var(--color-warning-bg);
  border: var(--border-width) solid var(--color-warning-border);
  color: var(--color-warning-text);
}

.group-page__status-banner--review {
  background: var(--color-info-bg);
  border: var(--border-width) solid var(--color-info-border);
  color: var(--color-info-text);
}

/* A group that is closed but still public: full, completed, or simply past its dates. */
.group-page__status-banner--closed {
  background: var(--color-status-pending-bg);
  border: var(--border-width) solid var(--color-border);
  color: var(--color-status-pending-text);
}

.group-page__status-banner--alert {
  background: var(--color-error-bg);
  border: var(--border-width) solid var(--color-error-border);
  color: var(--color-error-text);
}

.group-page__status-banner-text {
  font-weight: var(--font-weight-medium);
}

.group-page__status-banner-link {
  font-weight: var(--font-weight-bold);
  text-decoration: underline;
  white-space: nowrap;
}

.group-page__status-banner-link:hover {
  text-decoration: none;
}

.group-page__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-xl);
}

.group-page__title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  margin: var(--spacing-xs) 0 0;
  line-height: var(--line-height-tight);
}

/* Type and status pills share a row; a long localized label wraps rather than overflows. */
.group-page__pills {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  margin-top: var(--spacing-sm);
}

.group-page__layout {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: var(--spacing-xl);
  margin-bottom: var(--spacing-xl);
}

.group-page__main {
  min-width: 0;
}

.group-page__sidebar {
  min-width: 0;
}

.group-page__meta {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  position: sticky;
  top: var(--spacing-lg);
  align-self: start;
}

.group-page__meta-item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding-bottom: var(--spacing-md);
  border-bottom: var(--border-width) solid var(--color-border);
}

.group-page__meta-item:last-child {
  padding-bottom: 0;
  border-bottom: none;
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
  white-space: pre-wrap;
}

.group-page__organizers {
  display: grid;
  gap: var(--spacing-md);
}

.group-page__organizers--1 {
  grid-template-columns: 1fr;
}

.group-page__organizers--2 {
  grid-template-columns: repeat(2, 1fr);
}

.group-page__organizers--3 {
  grid-template-columns: repeat(3, 1fr);
}

.group-page__organizer-card {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
}

.group-page__organizer-card--link {
  text-decoration: none;
  color: inherit;
  transition: box-shadow var(--transition-base), border-color var(--transition-base);
}

.group-page__organizer-card--link:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-sm);
}

.group-page__organizer-avatar {
  width: 4rem;
  height: 4rem;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: var(--color-white);
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
  color: var(--color-white);
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

.group-page__modal-error {
  text-align: center;
  padding: var(--spacing-lg);
}

.group-page__modal-error p {
  color: var(--color-error-text);
  margin: 0 0 var(--spacing-md);
}

.group-page__sticky-cta {
  display: none;
}

@media (max-width: 900px) {
  .group-page__layout {
    grid-template-columns: 1fr;
  }

  .group-page__meta {
    position: static;
    order: -1;
  }
}

@media (max-width: 768px) {
  .group-page__organizers--2,
  .group-page__organizers--3 {
    grid-template-columns: 1fr;
  }

  .group-page__layout {
    padding-bottom: calc(var(--spacing-3xl) + 72px);
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
    box-shadow: var(--shadow-md);
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
