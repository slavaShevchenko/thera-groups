<script setup lang="ts">
interface Organizer {
  name: string
  avatarUrl?: string | null
}

const props = defineProps<{
  organizers?: Organizer[]
  organizer?: Organizer
  label?: string
}>()

const list = computed<Organizer[]>(() =>
  props.organizers ?? (props.organizer ? [props.organizer] : []),
)

const isSingle = computed(() => list.value.length === 1)
</script>

<template>
  <div
    v-if="isSingle"
    class="organizer-card"
  >
    <div class="organizer-card__avatar">
      <img
        v-if="list[0].avatarUrl"
        :src="list[0].avatarUrl"
        :alt="list[0].name"
      />
      <UiIcon
        v-else
        name="user-round"
        class="organizer-card__silhouette"
      />
    </div>
    <div class="organizer-card__info">
      <div class="organizer-card__name">
        {{ list[0].name }}
      </div>
      <div
        v-if="label"
        class="organizer-card__label"
      >
        {{ label }}
      </div>
    </div>
  </div>

  <div
    v-else-if="list.length > 1"
    class="organizer-card organizer-card--multiple"
  >
    <div class="organizer-card__stack">
      <div
        v-for="(org, index) in list"
        :key="index"
        class="organizer-card__stack-avatar"
        :style="{ zIndex: list.length - index }"
      >
        <img
          v-if="org.avatarUrl"
          :src="org.avatarUrl"
          :alt="org.name"
        />
        <UiIcon
          v-else
          name="user-round"
          class="organizer-card__stack-silhouette"
        />
      </div>
    </div>
    <div class="organizer-card__names">
      <div
        v-for="(org, index) in list"
        :key="index"
        class="organizer-card__name organizer-card__name--small"
      >
        ∘ {{ org.name }}
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

.organizer-card__info {
  min-width: 0;
}

.organizer-card__name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
}

.organizer-card__name--small {
  font-size: var(--font-size-sm);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--color-text-muted);
}

.organizer-card__label {
  margin-top: var(--spacing-xs);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

/* Multiple organizers: stacked avatars + names column */
.organizer-card--multiple {
  align-items: center;
}

.organizer-card__stack {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.organizer-card__stack-avatar {
  position: relative;
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 2px solid var(--color-surface);
}

.organizer-card__stack-avatar + .organizer-card__stack-avatar {
  margin-left: -0.6rem;
}

.organizer-card__stack-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.organizer-card__stack-silhouette {
  width: 1rem;
  height: 1rem;
}

.organizer-card__names {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
</style>
