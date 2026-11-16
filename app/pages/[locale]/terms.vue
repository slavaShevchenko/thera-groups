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

    <p>{{ t('terms.intro') }}</p>

    <h2>{{ t('terms.general.title') }}</h2>
    <p>{{ t('terms.general.text1') }}</p>
    <p>{{ t('terms.general.text2') }}</p>
    <p>{{ t('terms.general.text3') }}</p>

    <h2>{{ t('terms.access.title') }}</h2>
    <p>{{ t('terms.access.text1') }}</p>
    <ul>
      <li>{{ t('terms.access.item1') }}</li>
      <li>{{ t('terms.access.item2') }}</li>
      <li>{{ t('terms.access.item3') }}</li>
    </ul>

    <h2>{{ t('terms.organizers.title') }}</h2>
    <p>{{ t('terms.organizers.text1') }}</p>
    <ul>
      <li>{{ t('terms.organizers.item1') }}</li>
      <li>{{ t('terms.organizers.item2') }}</li>
      <li>{{ t('terms.organizers.item3') }}</li>
      <li>{{ t('terms.organizers.item4') }}</li>
      <li>{{ t('terms.organizers.item5') }}</li>
      <li>{{ t('terms.organizers.item6') }}</li>
    </ul>

    <h2>{{ t('terms.applications.title') }}</h2>
    <p>{{ t('terms.applications.text1') }}</p>
    <ul>
      <li>{{ t('terms.applications.item1') }}</li>
      <li>{{ t('terms.applications.item2') }}</li>
      <li>{{ t('terms.applications.item3') }}</li>
    </ul>
    <p>{{ t('terms.applications.text2') }}</p>

    <h2>{{ t('terms.moderation.title') }}</h2>
    <p>{{ t('terms.moderation.text1') }}</p>
    <ul>
      <li>{{ t('terms.moderation.item1') }}</li>
      <li>{{ t('terms.moderation.item2') }}</li>
      <li>{{ t('terms.moderation.item3') }}</li>
    </ul>
    <p>{{ t('terms.moderation.text2') }}</p>

    <h2>{{ t('terms.intellectualProperty.title') }}</h2>
    <p>{{ t('terms.intellectualProperty.text1') }}</p>
    <p>{{ t('terms.intellectualProperty.text2') }}</p>

    <h2>{{ t('terms.liability.title') }}</h2>
    <p>{{ t('terms.liability.text1') }}</p>
    <ul>
      <li>{{ t('terms.liability.item1') }}</li>
      <li>{{ t('terms.liability.item2') }}</li>
      <li>{{ t('terms.liability.item3') }}</li>
    </ul>
    <p>{{ t('terms.liability.text2') }}</p>

    <h2>{{ t('terms.disputes.title') }}</h2>
    <p>{{ t('terms.disputes.text1') }}</p>
    <p>{{ t('terms.disputes.text2') }}</p>

    <h2>{{ t('terms.changes.title') }}</h2>
    <p>{{ t('terms.changes.text1') }}</p>
    <p>{{ t('terms.changes.text2') }}</p>

    <h2>{{ t('terms.contacts.title') }}</h2>
    <p>{{ t('terms.contacts.text1') }}</p>
    <p>
      <a :href="`mailto:${t('terms.email')}`">{{ t('terms.email') }}</a>
    </p>
  </InfoPageLayout>
</template>
