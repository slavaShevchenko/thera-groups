<script setup lang="ts">
import { useLocaleHead } from '~/composables/useLocaleHead'

const head = useLocaleHead()
useHead({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  htmlAttrs: head.htmlAttrs as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  link: head.link as any,
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
    <NuxtRouteAnnouncer />
  </NuxtLayout>
</template>
