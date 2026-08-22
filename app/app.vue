<script setup lang="ts">
import { useLocaleHead } from '~/composables/useLocaleHead'

const head = useLocaleHead()
useHead(head)
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
