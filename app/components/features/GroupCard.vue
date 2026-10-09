<script setup lang="ts">
import type { Group, BackToSource } from '~~/types'
import { groupAcceptsApplications, isPastGroup } from '~~/shared/utils/groupVisibility'

const { t, locale } = useLocale()

const props = defineProps<{
  group: Group
  backSource?: BackToSource
}>()

function onClick() {
  if (props.backSource) {
    setBackTo(props.backSource)
  }
}

const formatLabel = (format: string | null) => formatGroupFormat(format, t)

const formatImage = (format: string | null) =>
  `/images/card/${(format ?? 'online').toLowerCase()}.webp`

/**
 * Why this card cannot be applied to. `FULL` and `COMPLETED` are listed in the catalog
 * now, and so is a group whose dates have passed while its row still says `PUBLISHED` —
 * without a label all three look identical to an open group and the visitor only finds out
 * on the detail page.
 */
const closedLabelKey = computed(() => {
  if (groupAcceptsApplications(props.group)) return null
  if (props.group.status === 'FULL') return 'groups.card.full'
  if (props.group.status === 'COMPLETED') return 'groups.card.completed'
  if (isPastGroup(props.group)) return 'groups.card.past'

  return null
})

const closedLabelVariant = computed(() =>
  props.group.status === 'FULL' ? 'info' : 'neutral',
)

const allOrganizers = computed(() => {
  const organizer = props.group.organizer
  const main = organizer
    ? [{ name: `${organizer.firstName} ${organizer.lastName}`.trim(), avatarUrl: organizer.avatarUrl }]
    : []

  // Flattened by the response mapper: no nested user record and no user id to read.
  const coOrgs = (props.group.coOrganizers ?? [])
    .map(co => ({
      name: `${co.firstName} ${co.lastName}`.trim(),
      avatarUrl: co.avatarUrl,
    }))
    .filter(co => co.name.length > 0)

  return [...main, ...coOrgs]
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
          v-if="group.format"
          class="group-card__format-pill"
          :label="formatLabel(group.format)"
          variant="neutral"
        />
        <UiPill
          v-if="closedLabelKey"
          :label="t(closedLabelKey)"
          :variant="closedLabelVariant"
        />
      </div>
    </div>

    <header class="group-card__header">
      <h3 class="group-card__title">
        {{ group.title }}
      </h3>
      <span
        v-if="group.type"
        class="group-card__sub-title"
      >
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
            {{ formatPrice(group.priceAmount, group.currency, t('groups.free')) }}
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
