<script setup lang="ts">
interface Organizer {
  firstName: string
  lastName: string
  slug: string
  avatarUrl: string | null
  city: string | null
  experienceYears: number | null
  specializations: string[]
  groupsCount: number
}

const props = defineProps<{
  organizer: Organizer
}>()

const { t, locale } = useLocale()

const fullName = computed(() =>
  `${props.organizer.firstName} ${props.organizer.lastName}`,
)

const initials = computed(() => {
  const first = props.organizer.firstName.charAt(0)
  const last = props.organizer.lastName.charAt(0)
  return `${first}${last}`.toUpperCase()
})

const visibleSpecializations = computed(() =>
  props.organizer.specializations.slice(0, 3),
)

const extraSpecializationsCount = computed(() => {
  const total = props.organizer.specializations.length
  return total > 3 ? total - 3 : 0
})

const metaText = computed(() => {
  const parts: string[] = []

  if (props.organizer.city) {
    parts.push(props.organizer.city)
  }

  if (props.organizer.experienceYears) {
    parts.push(
      t('organizers.experience', { count: String(props.organizer.experienceYears) }),
    )
  }

  return parts.join(' · ')
})

const groupsLabel = computed(() =>
  t('organizers.groups', { count: String(props.organizer.groupsCount) }),
)
</script>

<template>
  <NuxtLink
    :to="`/${locale}/organizers/${organizer.slug}`"
    class="organizer-catalog-card"
  >
    <div class="organizer-catalog-card__avatar-wrapper">
      <img
        v-if="organizer.avatarUrl"
        :src="organizer.avatarUrl"
        :alt="fullName"
        class="organizer-catalog-card__avatar organizer-catalog-card__avatar--image"
        width="80"
        height="80"
        loading="lazy"
      />
      <span
        v-else
        class="organizer-catalog-card__avatar organizer-catalog-card__avatar--placeholder"
        aria-hidden="true"
      >
        {{ initials }}
      </span>
    </div>

    <h3 class="organizer-catalog-card__name">
      {{ fullName }}
    </h3>

    <p
      v-if="metaText"
      class="organizer-catalog-card__meta"
    >
      {{ metaText }}
    </p>

    <div
      v-if="organizer.specializations.length > 0"
      class="organizer-catalog-card__specializations"
    >
      <UiPill
        v-for="spec in visibleSpecializations"
        :key="spec"
        :label="spec"
        background="var(--color-background-accent)"
        color="var(--color-primary)"
        class="organizer-catalog-card__pill"
      />
      <UiPill
        v-if="extraSpecializationsCount > 0"
        :label="`+${extraSpecializationsCount}`"
        background="var(--color-border)"
        color="var(--color-text-muted)"
        class="organizer-catalog-card__pill"
      />
    </div>

    <span class="organizer-catalog-card__groups-count">
      {{ groupsLabel }}
    </span>
  </NuxtLink>
</template>

<style scoped>
.organizer-catalog-card {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  border: var(--border-width) solid var(--color-border);
  box-shadow: var(--shadow-sm);
  padding: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--spacing-sm);
  text-decoration: none;
  color: var(--color-text);
  transition:
    box-shadow var(--transition-base),
    transform var(--transition-base);
}

.organizer-catalog-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
  color: var(--color-text);
  text-decoration: none;
}

.organizer-catalog-card__avatar-wrapper {
  flex-shrink: 0;
}

.organizer-catalog-card__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: var(--radius-full);
  overflow: hidden;
}

.organizer-catalog-card__avatar--image {
  object-fit: cover;
}

.organizer-catalog-card__avatar--placeholder {
  background: var(--color-primary);
  color: var(--color-surface);
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  line-height: 1;
}

.organizer-catalog-card__name {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  margin: 0;
  line-height: var(--line-height-tight);
}

.organizer-catalog-card__meta {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin: 0;
  line-height: var(--line-height-normal);
}

.organizer-catalog-card__specializations {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--spacing-xs);
}

.organizer-catalog-card__pill {
  /* styled via UiPill props */
}

.organizer-catalog-card__groups-count {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  font-weight: var(--font-weight-medium);
}
</style>
