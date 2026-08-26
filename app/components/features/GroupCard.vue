<script setup lang="ts">
const { t, locale } = useLocale()

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
  category: {
    name: string
  }
}

defineProps<{
  group: Group
}>()

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

const organizerName = (group: Group) =>
  `${group.organizer.firstName} ${group.organizer.lastName}`
</script>

<template>
  <NuxtLink
    :to="`/${locale}/groups/${group.slug}`"
    class="group-card"
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
      <div class="group-card__favorite">
        <FavoriteButton
          :slug="group.slug"
          size="sm"
          readonly
        />
      </div>
      <div class="group-card__pills">
        <UiPill
          class="group-card__format-pill"
          :label="formatLabel(group.format)"
        />
        <UiPill
          class="group-card__type-pill"
          :label="t(`groupTypes.${group.type}`)"
        />
      </div>
    </div>

    <header class="group-card__header">
      <h2 class="group-card__title">
        {{ group.title }}
      </h2>
      <span class="group-card__category">
        {{ group.category.name }}
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

        <div class="group-card__meta-item">
          <span class="group-card__meta-label">
            {{ t('groups.price') }}
          </span>
          <span class="group-card__meta-value">
            {{ formatPrice(group.price, group.currency) }}
          </span>
        </div>

        <div class="group-card__meta-item group-card__meta-item--wide">
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
        :organizer="{
          name: organizerName(group),
          avatarUrl: group.organizer.avatarUrl,
        }"
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

.group-card__favorite {
  position: absolute;
  top: var(--spacing-sm);
  right: var(--spacing-sm);
  z-index: 1;
}

.group-card__pills {
  position: absolute;
  top: var(--spacing-sm);
  left: var(--spacing-sm);
  display: flex;
  gap: var(--spacing-xs);
  flex-wrap: wrap;
}

.group-card__format-pill {
  /* positioned by parent */
}

.group-card__type-pill {
  /* positioned by parent */
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
}

.group-card__category {
  font-size: var(--font-size-xs);
  color: var(--color-primary);
  font-weight: var(--font-weight-medium);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.group-card__content {
  padding: var(--spacing-md);
  flex: 1;
}

.group-card__meta {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-sm);
}

.group-card__meta-item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.group-card__meta-item--wide {
  grid-column: 1 / -1;
}

.group-card__meta-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.group-card__meta-value {
  font-size: var(--font-size-md);
  color: var(--color-text);
  font-weight: var(--font-weight-medium);
}

.group-card__footer {
  padding: var(--spacing-md);
  border-top: var(--border-width) solid var(--color-border);
}
</style>
