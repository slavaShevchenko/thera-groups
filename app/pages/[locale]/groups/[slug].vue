<script setup lang="ts">
const { t, locale } = useLocale()
const route = useRoute()

const slug = route.params.slug as string

const { data: group, pending, error } = await useFetch(`/api/groups/${slug}`, {
  key: `group-${slug}`,
})

useHead({
  title: computed(() => group.value?.title ?? 'TheraGroups'),
})

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
        </div>
        <button
          class="group-page__favorite"
          type="button"
          :aria-label="t('groupPage.favorite')"
        >
          <UiIcon name="heart" />
        </button>
      </header>

      <div
        v-if="group.tags.length"
        class="group-page__tags"
      >
        <span
          v-for="tag in group.tags"
          :key="tag.id"
          class="group-page__tag"
        >
          {{ tag.name }}
        </span>
      </div>

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
          {{ t('groupPage.aboutTherapist') }}
        </h2>
        <div class="group-page__therapist">
          <div class="group-page__therapist-avatar">
            <img
              v-if="group.therapist.avatar"
              :src="group.therapist.avatar"
              :alt="`${group.therapist.firstName} ${group.therapist.lastName}`"
            />
            <span v-else>
              {{ group.therapist.firstName[0] }}{{ group.therapist.lastName[0] }}
            </span>
          </div>
          <div class="group-page__therapist-info">
            <div class="group-page__therapist-name">
              {{ group.therapist.firstName }} {{ group.therapist.lastName }}
            </div>
            <div
              v-if="group.therapist.qualification"
              class="group-page__therapist-qualification"
            >
              {{ group.therapist.qualification }}
            </div>
            <p
              v-if="group.therapist.bio"
              class="group-page__therapist-bio"
            >
              {{ group.therapist.bio }}
            </p>
          </div>
        </div>
      </section>

      <footer class="group-page__footer">
        <UiButton :label="t('groupPage.apply')" />
      </footer>
    </article>
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

.group-page__favorite {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  flex-shrink: 0;
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-surface);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: color var(--transition-base), border-color var(--transition-base);
}

.group-page__favorite:hover {
  color: var(--color-error);
  border-color: var(--color-error);
}

.group-page__tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-lg);
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

.group-page__therapist {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
}

.group-page__therapist-avatar {
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

.group-page__therapist-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.group-page__therapist-name {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
}

.group-page__therapist-qualification {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin-top: var(--spacing-xs);
}

.group-page__therapist-bio {
  font-size: var(--font-size-sm);
  color: var(--color-text);
  line-height: var(--line-height-normal);
  margin: var(--spacing-sm) 0 0;
}

.group-page__footer {
  padding-top: var(--spacing-lg);
  border-top: var(--border-width) solid var(--color-border);
}

@media (max-width: 768px) {
  .group-page__meta {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
