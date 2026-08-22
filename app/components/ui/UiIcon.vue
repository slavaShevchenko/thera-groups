<script setup lang="ts">
withDefaults(
  defineProps<{
    name: string
    size?: number | string
    color?: string
    decorative?: boolean
  }>(),
  {
    size: 24,
    color: 'currentColor',
    decorative: true,
  },
)
</script>

<template>
  <Icon
    :name="`lucide:${name}`"
    :size="size"
    :color="color"
    :aria-hidden="decorative ? true : undefined"
  />
</template>
