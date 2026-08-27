<script setup lang="ts">
const { t, locale } = useLocale()
const { user, isLoading: isUserLoading } = useUser()
const { startLoading, finishLoading, forceHide } = usePageLoading()

const isCreating = ref(false)

// Guard: только ORGANIZER + VERIFIED
watch(isUserLoading, async (loading) => {
  if (loading || isCreating.value) return

  if (!user.value || user.value.role !== 'ORGANIZER') {
    forceHide()
    navigateTo(`/${locale.value}/`)
    return
  }

  // Создаём пустую группу и редиректим на edit
  startLoading()
  try {
    await createGroup()
  }
  finally {
    finishLoading()
  }
}, { immediate: true })

async function createGroup() {
  if (isCreating.value) return
  isCreating.value = true

  try {
    const response = await $fetch<{ group: { slug: string } }>('/api/groups', {
      method: 'POST',
    })

    navigateTo(`/${locale.value}/groups/edit/${response.group.slug}`)
  }
  catch {
    navigateTo(`/${locale.value}/`)
  }
}

useHead({
  title: () => t('groups.new.title'),
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
  ],
})
</script>

<template>
  <div class="group-new-page">
    <p>{{ t('common.loading') }}</p>
  </div>
</template>

<style scoped>
.group-new-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 60vh;
  padding: var(--spacing-2xl);
}
</style>
