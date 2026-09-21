<script setup lang="ts">
const { t, locale } = useLocale()
const { user, isLoading: isUserLoading } = useUser()
const { can } = usePermissions()
const { startLoading, finishLoading, forceHide } = usePageLoading()

const isCreating = ref(false)
const createError = ref('')

const isUnverifiedOrganizer = computed(() => {
  if (!user.value || user.value.role !== 'ORGANIZER') return false
  return user.value.organizerProfile?.verificationStatus !== 'VERIFIED'
})

watch(isUserLoading, async (loading) => {
  if (loading) return

  if (!user.value) {
    forceHide()
    navigateTo(`/${locale.value}/`)
    return
  }

  if (isUnverifiedOrganizer.value) {
    forceHide()
    return
  }

  if (!can('group.create')) {
    forceHide()
    navigateTo(`/${locale.value}/`)
    return
  }
}, { immediate: true })

async function createGroup() {
  if (isCreating.value) return
  isCreating.value = true
  createError.value = ''

  startLoading()
  try {
    const response = await $fetch<{ group: { slug: string } }>('/api/groups', {
      method: 'POST',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    navigateTo(`/${locale.value}/groups/edit/${response.group.slug}`)
  }
  catch {
    createError.value = t('errors.saveFailed')
  }
  finally {
    finishLoading()
    isCreating.value = false
  }
}

useHead({
  title: () => t('groups.new.title'),
  meta: [
    { name: 'robots', content: 'noindex, nofollow' }],
})
</script>

<template>
  <div class="group-new-page">
    <div
      v-if="isUnverifiedOrganizer"
      class="group-new-page__card"
    >
      <h1 class="group-new-page__title">
        {{ t('groups.new.verificationRequired') }}
      </h1>
      <p class="group-new-page__description">
        {{ t('groups.new.verificationRequiredDescription') }}
      </p>
      <UiButton :to="`/${locale}/profile/edit`">
        {{ t('groups.new.completeProfile') }}
      </UiButton>
    </div>

    <div
      v-else
      class="group-new-page__card"
    >
      <h1 class="group-new-page__title">
        {{ t('groups.new.title') }}
      </h1>
      <p class="group-new-page__description">
        {{ t('groups.new.description') }}
      </p>

      <p
        v-if="createError"
        class="group-new-page__error"
        role="alert"
      >
        {{ createError }}
      </p>

      <UiButton
        :disabled="isCreating"
        @click="createGroup"
      >
        {{ t('common.createGroup') }}
      </UiButton>
    </div>
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

.group-new-page__card {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: var(--spacing-2xl);
  box-shadow: var(--shadow-md);
  max-width: 480px;
  width: 100%;
  text-align: center;
}

.group-new-page__title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  margin: 0 0 var(--spacing-md);
}

.group-new-page__description {
  color: var(--color-text-muted);
  margin: 0 0 var(--spacing-xl);
  font-size: var(--font-size-md);
}

.group-new-page__error {
  color: var(--color-error-text);
  font-size: var(--font-size-sm);
  margin-bottom: var(--spacing-md);
}
</style>
