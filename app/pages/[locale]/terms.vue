<script setup lang="ts">
const { t } = useLocale()

useSeoPage({
  title: () => t('seo.termsTitle'),
  description: () => t('seo.termsDescription'),
})
</script>

<template>
  <InfoPageLayout>
    <template #title>
      {{ t('terms.title') }}
    </template>

    <h2>{{ t('terms.subject.title') }}</h2>
    <p>{{ t('terms.subject.text1') }}</p>
    <p>{{ t('terms.subject.text2') }}</p>

    <h2>{{ t('terms.registration.title') }}</h2>
    <p>{{ t('terms.registration.text1') }}</p>
    <p>{{ t('terms.registration.text2') }}</p>

    <h2>{{ t('terms.organizers.title') }}</h2>
    <p>{{ t('terms.organizers.text1') }}</p>
    <ul>
      <li>{{ t('terms.organizers.item1') }}</li>
      <li>{{ t('terms.organizers.item2') }}</li>
      <li>{{ t('terms.organizers.item3') }}</li>
    </ul>

    <h2>{{ t('terms.participants.title') }}</h2>
    <p>{{ t('terms.participants.text1') }}</p>
    <ul>
      <li>{{ t('terms.participants.item1') }}</li>
      <li>{{ t('terms.participants.item2') }}</li>
      <li>{{ t('terms.participants.item3') }}</li>
    </ul>

    <h2>{{ t('terms.moderation.title') }}</h2>
    <p>{{ t('terms.moderation.text1') }}</p>
    <p>{{ t('terms.moderation.text2') }}</p>

    <h2>{{ t('terms.liability.title') }}</h2>
    <p>{{ t('terms.liability.text1') }}</p>
    <p>{{ t('terms.liability.text2') }}</p>

    <h2>{{ t('terms.changes.title') }}</h2>
    <p>{{ t('terms.changes.text1') }}</p>

    <!-- TODO: review with lawyer before production -->
  </InfoPageLayout>
</template>
