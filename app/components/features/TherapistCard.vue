<script setup lang="ts">
defineProps<{
  therapist: {
    name: string
    avatar?: string | null
  }
  label: string
}>()
</script>

<template>
  <div class="therapist-card">
    <div class="therapist-card__avatar">
      <img
        v-if="therapist.avatar"
        :src="therapist.avatar"
        :alt="therapist.name"
      />
      <UiIcon
        v-else
        name="user-round"
        class="therapist-card__silhouette"
      />
    </div>
    <div class="therapist-card__info">
      <div class="therapist-card__name">
        {{ therapist.name }}
      </div>
      <div class="therapist-card__label">
        {{ label }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.therapist-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.therapist-card__avatar {
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

.therapist-card__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.therapist-card__silhouette {
  width: 1.5rem;
  height: 1.5rem;
}

.therapist-card__name {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.therapist-card__label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}
</style>
