<script setup lang="ts">
const { t, locale } = useLocale()
const { user, isLoading: isUserLoading } = useUser()
const { startLoading, finishLoading, forceHide } = usePageLoading()

interface UserProfile {
  id: string
  email: string
  role: string
  preferredLocale: string
  createdAt: string
  organizerProfile: {
    id: string
    slug: string
    firstName: string
    lastName: string
    avatarUrl: string | null
    bio: string | null
    qualification: string | null
    verificationStatus: string
  } | null
}

const profile = ref<UserProfile | null>(null)

watch(isUserLoading, async (loading) => {
  if (loading) return

  if (!user.value) {
    forceHide()
    navigateTo(`/${locale.value}/auth/login`)
    return
  }

  startLoading()
  try {
    profile.value = await $fetch<UserProfile>('/api/user/profile')
  }
  catch {
    // Profile load failed
  }
  finally {
    finishLoading()
  }
}, { immediate: true })

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(
    locale.value === 'ua' ? 'uk-UA' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' },
  )
}

useHead({
  title: () => t('profile.title'),
  meta: [{ name: 'robots', content: 'noindex' }],
})
</script>

<template>
  <div class="profile-page">
    <div class="profile-page__card">
      <h1 class="profile-page__title">
        {{ t('profile.title') }}
      </h1>

      <div
        v-if="!profile"
        class="profile-page__loading"
      >
        {{ t('common.loading') }}
      </div>

      <template v-else>
        <dl class="profile-page__info">
          <div class="profile-page__row">
            <dt>{{ t('profile.email') }}</dt>
            <dd>{{ profile.email }}</dd>
          </div>
          <div class="profile-page__row">
            <dt>{{ t('profile.role') }}</dt>
            <dd>
              <span
                class="profile-page__badge"
                :class="`profile-page__badge--${profile.role.toLowerCase()}`"
              >
                {{ t(`users.roles.${profile.role}`) }}
              </span>
            </dd>
          </div>
          <div class="profile-page__row">
            <dt>{{ t('profile.memberSince') }}</dt>
            <dd>{{ formatDate(profile.createdAt) }}</dd>
          </div>
        </dl>

        <!-- Organizer profile section -->
        <div
          v-if="profile.role === 'ORGANIZER' && profile.organizerProfile"
          class="profile-page__organizer"
        >
          <h2 class="profile-page__subtitle">
            {{ t('profile.organizerProfile') }}
          </h2>
          <div class="profile-page__organizer-info">
            <span>{{ profile.organizerProfile.firstName }} {{ profile.organizerProfile.lastName }}</span>
            <span
              v-if="profile.organizerProfile.qualification"
              class="profile-page__qualification"
            >
              {{ profile.organizerProfile.qualification }}
            </span>
            <span
              class="profile-page__verification"
              :class="`profile-page__verification--${profile.organizerProfile.verificationStatus.toLowerCase()}`"
            >
              {{ t(`profile.verification.${profile.organizerProfile.verificationStatus}`) }}
            </span>
          </div>
          <NuxtLink
            :to="`/${locale}/profile/edit`"
            class="profile-page__edit-btn"
          >
            {{ t('profile.editOrganizerProfile') }}
          </NuxtLink>
        </div>

        <!-- Admin with organizer profile -->
        <div
          v-if="profile.role === 'ADMIN' && profile.organizerProfile"
          class="profile-page__organizer"
        >
          <h2 class="profile-page__subtitle">
            {{ t('profile.organizerProfile') }}
          </h2>
          <div class="profile-page__organizer-info">
            <span>{{ profile.organizerProfile.firstName }} {{ profile.organizerProfile.lastName }}</span>
          </div>
          <NuxtLink
            :to="`/${locale}/profile/edit`"
            class="profile-page__edit-btn"
          >
            {{ t('profile.editOrganizerProfile') }}
          </NuxtLink>
        </div>

        <!-- Admin without organizer profile -->
        <div
          v-if="profile.role === 'ADMIN' && !profile.organizerProfile"
          class="profile-page__hint"
        >
          {{ t('profile.adminNoOrganizerProfile') }}
        </div>

        <!-- Visitor message -->
        <div
          v-if="profile.role === 'VISITOR'"
          class="profile-page__hint"
        >
          {{ t('profile.visitorMessage') }}
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.profile-page {
  padding: var(--spacing-2xl) var(--spacing-lg);
  max-width: 640px;
  margin: 0 auto;
}

.profile-page__card {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: var(--spacing-2xl);
  box-shadow: var(--shadow-md);
}

.profile-page__title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  margin: 0 0 var(--spacing-xl);
}

.profile-page__subtitle {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  margin: var(--spacing-xl) 0 var(--spacing-md);
  padding-top: var(--spacing-lg);
  border-top: var(--border-width) solid var(--color-border);
}

.profile-page__loading {
  color: var(--color-text-muted);
  text-align: center;
  padding: var(--spacing-xl);
}

.profile-page__info {
  margin: 0;
}

.profile-page__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm) 0;
  border-bottom: var(--border-width) solid var(--color-border);
}

.profile-page__row dt {
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
}

.profile-page__row dd {
  margin: 0;
  font-weight: var(--font-weight-medium);
}

.profile-page__badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.profile-page__badge--admin { background: #ede9fe; color: #5b21b6; }
.profile-page__badge--organizer { background: #dbeafe; color: #1d4ed8; }
.profile-page__badge--visitor { background: #e5e7eb; color: #374151; }

.profile-page__organizer-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-md);
}

.profile-page__qualification {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.profile-page__verification {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}

.profile-page__verification--verified { color: #047857; }
.profile-page__verification--pending { color: #b45309; }
.profile-page__verification--unverified { color: var(--color-text-muted); }

.profile-page__edit-btn {
  display: inline-block;
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-primary);
  color: white;
  border-radius: var(--radius-md);
  text-decoration: none;
  font-weight: var(--font-weight-medium);
  transition: opacity var(--transition-base);
}

.profile-page__edit-btn:hover {
  opacity: 0.9;
}

.profile-page__hint {
  margin-top: var(--spacing-lg);
  padding: var(--spacing-md);
  background: var(--color-background);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
</style>
