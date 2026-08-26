<script setup lang="ts">
import { Icon } from '@iconify/vue'

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
    :icon="`lucide:${name}`"
    :width="size"
    :height="size"
    :color="color"
    :aria-hidden="decorative ? true : undefined"
  />
</template>
