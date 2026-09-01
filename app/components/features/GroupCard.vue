<script setup lang="ts">
const { t, locale } = useLocale()

type BackToSource = 'catalog' | 'my' | 'admin' | 'favorites'

interface Group {
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
  organizer: {
    firstName: string
    lastName: string
    avatarUrl: string | null
  }
  coOrganizers?: Array<{
    userId: string
    role: string
    user: {
      id: string
      firstName?: string
      lastName?: string
      avatarUrl?: string | null
      organizerProfile?: {
        firstName: string
        lastName: string
        avatarUrl: string | null
        slug: string
      } | null
    }
  }>
}

const props = defineProps<{
  group: Group
  backSource?: BackToSource
}>()

function onClick() {
  if (props.backSource) {
    setBackTo(props.backSource)
  }
}

const formatLabel = (format: string) => {
  const labels: Record<string, string> = {
    ONLINE: t('common.formats.online'),
    OFFLINE: t('common.formats.offline'),
    HYBRID: t('common.formats.hybrid'),
  }

  return labels[format] ?? format
}

const formatImage = (format: string) =>
  `/images/card/${format.toLowerCase()}.webp`

const allOrganizers = computed(() => {
  const main = {
    name: `${props.group.organizer.firstName} ${props.group.organizer.lastName}`,
    avatarUrl: props.group.organizer.avatarUrl,
  }

  const coOrgs = (props.group.coOrganizers ?? []).map((co) => {
    const profile = co.user.organizerProfile
    const firstName = profile?.firstName ?? co.user.firstName ?? ''
    const lastName = profile?.lastName ?? co.user.lastName ?? ''

    return {
      name: `${firstName} ${lastName}`.trim(),
      avatarUrl: profile?.avatarUrl ?? co.user.avatarUrl ?? null,
    }
  })

  return [main, ...coOrgs]
})
</script>

<template>
  <NuxtLink
    :to="`/${locale}/groups/${group.slug}`"
    class="group-card"
    @click="onClick"
  >
    <div class="group-card__media">
      <img
        class="group-card__image"
        :src="formatImage(group.format)"
        alt=""
        width="400"
        height="300"
        loading="lazy"
      />
      <div class="group-card__pills">
        <UiPill
          class="group-card__format-pill"
          :label="formatLabel(group.format)"
        />
      </div>
    </div>

    <header class="group-card__header">
      <h2 class="group-card__title">
        {{ group.title }}
      </h2>
      <span class="group-card__sub-title">
        {{ t(`groupTypes.${group.type}`) }}
      </span>
    </header>

    <div class="group-card__content">
      <div class="group-card__meta">
        <div class="group-card__meta-item">
          <span class="group-card__meta-label">
            {{ t('groups.capacity') }}
          </span>
          <span class="group-card__meta-value">
            {{ group.capacity }}
          </span>
        </div>

        <div class="group-card__meta-item group-card__meta-item--wide">
          <span class="group-card__meta-label">
            {{ t('groups.price') }}
          </span>
          <span class="group-card__meta-value">
            {{ formatPrice(group.price, group.currency) }}
          </span>
        </div>

        <div class="group-card__meta-item">
          <span class="group-card__meta-label">
            {{ t('groups.startDate') }}
          </span>
          <span class="group-card__meta-value">
            {{ formatDate(group.startsAt, locale) }}
          </span>
        </div>
      </div>
    </div>

    <footer class="group-card__footer">
      <OrganizerCard
        :organizers="allOrganizers"
        :label="t('groups.organizer')"
      />
    </footer>
  </NuxtLink>
</template>

<style scoped>
.group-card {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  border: var(--border-width) solid var(--color-border);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--color-text);
  text-decoration: none;
  transition: box-shadow var(--transition-base);
}

.group-card:hover {
  box-shadow: var(--shadow-md);
  color: var(--color-text);
  text-decoration: none;
}

.group-card__media {
  height: 160px;
  position: relative;
}

.group-card__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.group-card__pills {
  position: absolute;
  top: var(--spacing-sm);
  right: var(--spacing-sm);
  display: flex;
  gap: var(--spacing-xs);
  flex-wrap: wrap;
}

.group-card__header {
  padding: var(--spacing-md);
  border-bottom: var(--border-width) solid var(--color-border);
}

.group-card__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  margin: 0 0 var(--spacing-xs) 0;
  line-height: var(--line-height-tight);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.group-card__sub-title {
  font-size: var(--font-size-sm);
  color: var(--color-primary);
  text-transform: uppercase;
}

.group-card__content {
  padding: var(--spacing-md);
  flex: 1;
}

.group-card__meta {
  display: flex;
  gap: var(--spacing-lg);
}

.group-card__meta-item {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.group-card__meta-item--wide {
  flex: 1 1 auto;
}

.group-card__meta-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.group-card__meta-value {
  font-size: var(--font-size-sm);
  color: var(--color-text);
  font-weight: var(--font-weight-medium);
}

.group-card__footer {
  padding: var(--spacing-md);
  padding-top: 0;
}
</style>
