<script setup lang="ts">
defineProps<{
  organizer: {
    name: string
    avatar?: string | null
  }
  label: string
}>()
</script>

<template>
  <div class="organizer-card">
    <div class="organizer-card__avatar">
      <img
        v-if="organizer.avatar"
        :src="organizer.avatar"
        :alt="organizer.name"
      />
      <UiIcon
        v-else
        name="user-round"
        class="organizer-card__silhouette"
      />
    </div>
    <div class="organizer-card__info">
      <div class="organizer-card__name">
        {{ organizer.name }}
      </div>
      <div class="organizer-card__label">
        {{ label }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.organizer-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.organizer-card__avatar {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.organizer-card__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.organizer-card__silhouette {
  width: 1.5rem;
  height: 1.5rem;
}

.organizer-card__name {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.organizer-card__label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}
</style>
