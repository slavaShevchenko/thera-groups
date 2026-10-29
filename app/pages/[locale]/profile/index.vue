<script setup lang="ts">
import type { UserProfile } from '~~/types'

const { t, locale } = useLocale()
const { fetchUser } = useUser()
const { startLoading, finishLoading, forceHide } = usePageLoading()

const profile = ref<UserProfile | null>(null)
const loadError = ref(false)

const organizerProfile = computed(() =>
  profile.value?.role === 'ORGANIZER' ? profile.value.organizerProfile : null,
)

const rejectionReason = computed(() => organizerProfile.value?.rejectionReason ?? null)

type VerificationTone = 'unverified' | 'pending' | 'rejected'

type OrganizerState = {
  tone: VerificationTone | null
  title: string | null
  text: string | null
  action: string
  variant: 'primary' | 'secondary'
}

/**
 * The three non-verified states ask for different things, so they get different copy and
 * a different call to action: an UNVERIFIED profile has to be filled in, a PENDING one has
 * nothing to do but wait, and a REJECTED one has to be fixed and resubmitted — which the
 * edit form's PATCH already does by resetting the status to PENDING.
 *
 * VERIFIED leaves `tone` null: there is nothing to explain, only the plain edit button.
 */
const organizerState = computed<OrganizerState>(() => {
  const status = organizerProfile.value?.verificationStatus

  const tone: VerificationTone | null = status === 'UNVERIFIED' || status === 'PENDING' || status === 'REJECTED'
    ? status.toLowerCase() as VerificationTone
    : null

  if (!tone) {
    return {
      tone: null,
      title: null,
      text: null,
      action: t('profile.editOrganizerProfile'),
      variant: 'primary',
    }
  }

  return {
    tone,
    title: t(`profile.verificationStatus.${tone}.title`),
    text: t(`profile.verificationStatus.${tone}.text`),
    // A PENDING profile has nothing to fix, so it keeps the plain edit link and a quiet
    // button — the notice, not the button, is what that state has to say.
    action: tone === 'pending'
      ? t('profile.editOrganizerProfile')
      : t(`profile.verificationStatus.${tone}.action`),
    variant: tone === 'pending' ? 'secondary' : 'primary',
  }
})

async function loadProfile() {
  loadError.value = false
  try {
    profile.value = await $fetch<UserProfile>('/api/user/profile')
  }
  catch {
    loadError.value = true
  }
}

/**
 * The role was just promoted server-side, and the header, the route guards and this page
 * all read the session user — so refresh it before entering a page whose own guard
 * (`can('organizer.profile.edit')`) would otherwise still see a VISITOR.
 */
async function onOrganizerCreated() {
  startLoading()
  await fetchUser(true)
  forceHide()
  await navigateTo(`/${locale.value}/profile/edit`)
}

// Authentication is enforced by app/middleware/auth.global.ts before this page renders.
onMounted(async () => {
  startLoading()
  try {
    await loadProfile()
  }
  finally {
    finishLoading()
  }
})

useHead({
  title: () => t('common.profile'),
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})
</script>

<template>
  <div class="profile-page">
    <div class="profile-page__card">
      <h1 class="profile-page__title">
        {{ t('common.profile') }}
      </h1>

      <div
        v-if="loadError"
        class="profile-page__error"
        role="alert"
      >
        <p>{{ t('errors.failedToLoad') }}</p>
        <UiButton
          variant="danger"
          @click="loadProfile"
        >
          {{ t('common.retry') }}
        </UiButton>
      </div>

      <div
        v-else-if="!profile"
        class="profile-page__loading"
        role="status"
      >
        {{ t('common.loading') }}
      </div>

      <template v-else>
        <dl class="profile-page__info">
          <div class="profile-page__row">
            <dt>{{ t('common.email') }}</dt>
            <dd>{{ profile.email }}</dd>
          </div>
          <div class="profile-page__row">
            <dt>{{ t('common.role') }}</dt>
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
            <dd>{{ formatDate(profile.createdAt, locale) }}</dd>
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

          <div
            v-if="organizerState.tone"
            class="profile-page__state"
            :class="`profile-page__state--${organizerState.tone}`"
            role="status"
          >
            <p class="profile-page__state-title">
              {{ organizerState.title }}
            </p>
            <p class="profile-page__state-text">
              {{ organizerState.text }}
            </p>
            <div
              v-if="organizerState.tone === 'rejected' && rejectionReason"
              class="profile-page__rejection"
            >
              <span class="profile-page__rejection-label">{{ t('common.rejectionReason') }}</span>
              <span class="profile-page__rejection-text">{{ rejectionReason }}</span>
            </div>
          </div>

          <UiButton
            :variant="organizerState.variant"
            :to="`/${locale}/profile/edit`"
          >
            {{ organizerState.action }}
          </UiButton>
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
          <UiButton
            :to="`/${locale}/profile/edit`"
          >
            {{ t('profile.editOrganizerProfile') }}
          </UiButton>
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

        <BecomeOrganizerForm
          v-if="profile.role === 'VISITOR'"
          @created="onOrganizerCreated"
        />
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

.profile-page__error {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--color-error-text);
}

.profile-page__retry-btn {
  margin-top: var(--spacing-sm);
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
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.profile-page__row dt {
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
}

.profile-page__row dd {
  margin: 0;
  font-weight: var(--font-weight-medium);
  min-width: 0;
  overflow-wrap: anywhere;
}

.profile-page__badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.profile-page__badge--admin { background: var(--color-role-admin-bg); color: var(--color-role-admin-text); }
.profile-page__badge--organizer { background: var(--color-role-organizer-bg); color: var(--color-role-organizer-text); }
.profile-page__badge--visitor { background: var(--color-role-visitor-bg); color: var(--color-role-visitor-text); }

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

.profile-page__verification--verified { color: var(--color-verified); }
.profile-page__verification--pending { color: var(--color-pending-verification); }
.profile-page__verification--unverified { color: var(--color-text-muted); }
.profile-page__verification--rejected { color: var(--color-error-text); }

.profile-page__state {
  margin: var(--spacing-md) 0;
  padding: var(--spacing-md);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
}

.profile-page__state--unverified {
  background: var(--color-info-bg);
  border-color: var(--color-info-border);
}

.profile-page__state--pending {
  background: var(--color-warning-bg);
  border-color: var(--color-warning-border);
}

.profile-page__state--rejected {
  background: var(--color-error-bg);
  border-color: var(--color-error-border);
}

.profile-page__state-title {
  margin: 0 0 var(--spacing-xs);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

.profile-page__state--unverified .profile-page__state-title { color: var(--color-info-text); }
.profile-page__state--pending .profile-page__state-title { color: var(--color-warning-text); }
.profile-page__state--rejected .profile-page__state-title { color: var(--color-error-text); }

.profile-page__state-text {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.profile-page__rejection {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  margin-top: var(--spacing-md);
  padding-top: var(--spacing-md);
  border-top: var(--border-width) solid var(--color-error-border);
}

.profile-page__rejection-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-error-text);
}

.profile-page__rejection-text {
  font-size: var(--font-size-sm);
  color: var(--color-text);
  overflow-wrap: anywhere;
  white-space: pre-line;
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
