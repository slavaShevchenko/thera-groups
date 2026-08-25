<script setup lang="ts">
const { t, locale } = useLocale()
const { user, isLoading: isUserLoading } = useUser()

const isCreating = ref(false)

// Guard: только ORGANIZER + VERIFIED
watch(isUserLoading, async (loading) => {
  if (loading || isCreating.value) return

  if (!user.value || user.value.role !== 'ORGANIZER') {
    navigateTo(`/${locale.value}/`)
    return
  }

  // Создаём пустую группу и редиректим на edit
  await createGroup()
}, { immediate: true })

async function createGroup() {
  if (isCreating.value) return
  isCreating.value = true

  try {
    const response = await $fetch<{ group: { slug: string } }>('/api/groups', {
      method: 'POST',
      body: {
        type: 'THERAPEUTIC',
        format: 'ONLINE',
      },
    })

    navigateTo(`/${locale.value}/groups/edit/${response.group.slug}`)
  }
  catch (error) {
    console.error('Failed to create group:', error)
    navigateTo(`/${locale.value}/`)
  }
}

useHead({ title: () => t('groups.new.title') })
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
