<script setup lang="ts">
const { t, locale } = useLocale()
const { user } = useUser()
const { can } = usePermissions()
const { startLoading, finishLoading, forceHide } = usePageLoading()

const isCreating = ref(false)
const createError = ref('')

const isUnverifiedOrganizer = computed(() => {
  if (!user.value || user.value.role !== 'ORGANIZER') return false
  return user.value.organizerProfile?.verificationStatus !== 'VERIFIED'
})

// An admin creates on behalf of somebody, and POST /api/groups refuses to guess who:
// the owner has to be picked here. Everyone else creates on their own verified profile.
const isAdmin = computed(() => user.value?.role === 'ADMIN')
const selectedOrganizerId = ref('')

const { data: verifiedOrganizers } = await useFetch<{
  organizers: Array<{ id: string, firstName: string, lastName: string }>
}>('/api/organizers', {
  query: { limit: 100 },
  key: 'admin-organizer-options',
  server: false,
  immediate: isAdmin.value,
})

// Authentication is enforced by app/middleware/auth.global.ts. What is left is
// authorisation: an unverified ORGANIZER stays and sees the verification card rendered
// below, while anyone without group.create has no way to use this page.
if (!isUnverifiedOrganizer.value && !can('group.create')) {
  forceHide()
  navigateTo(`/${locale.value}/`)
}

async function createGroup() {
  if (isCreating.value) return
  if (isAdmin.value && !selectedOrganizerId.value) return

  isCreating.value = true
  createError.value = ''

  startLoading()
  try {
    const response = await $fetch<{ group: { slug: string } }>('/api/groups', {
      method: 'POST',
      ...(isAdmin.value ? { body: { organizerId: selectedOrganizerId.value } } : {}),
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

      <div
        v-if="isAdmin"
        class="group-new-page__field"
      >
        <label
          for="group-new-organizer"
          class="group-new-page__label"
        >
          {{ t('groups.new.organizerLabel') }}
        </label>
        <select
          id="group-new-organizer"
          v-model="selectedOrganizerId"
          class="group-new-page__select"
          :disabled="isCreating"
        >
          <option value="">
            {{ t('groups.new.organizerPlaceholder') }}
          </option>
          <option
            v-for="organizer in verifiedOrganizers?.organizers ?? []"
            :key="organizer.id"
            :value="organizer.id"
          >
            {{ organizer.firstName }} {{ organizer.lastName }}
          </option>
        </select>
      </div>

      <UiButton
        :disabled="isCreating || (isAdmin && !selectedOrganizerId)"
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

.group-new-page__field {
  margin-bottom: var(--spacing-lg);
  text-align: left;
}

.group-new-page__label {
  display: block;
  margin-bottom: var(--spacing-sm);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.group-new-page__select {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
  font-family: var(--font-family-base);
  color: var(--color-text);
  background: var(--color-background);
  box-sizing: border-box;
}

.group-new-page__select:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
</style>
