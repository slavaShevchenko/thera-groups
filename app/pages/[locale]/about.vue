<script setup lang="ts">
const { t } = useLocale()

useSeoPage({
  title: () => t('seo.aboutTitle'),
  description: () => t('seo.aboutDescription'),
})
</script>

<template>
  <InfoPageLayout>
    <template #title>
      {{ t('about.title') }}
    </template>

    <h2>{{ t('about.mission.title') }}</h2>
    <p>{{ t('about.mission.text1') }}</p>
    <p>{{ t('about.mission.text2') }}</p>

    <h2>{{ t('about.whatIs.title') }}</h2>
    <p>{{ t('about.whatIs.text1') }}</p>
    <p>{{ t('about.whatIs.text2') }}</p>
    <p>{{ t('about.whatIs.text3') }}</p>

    <h2>{{ t('about.verification.title') }}</h2>
    <p>{{ t('about.verification.text1') }}</p>
    <ul>
      <li>{{ t('about.verification.item1') }}</li>
      <li>{{ t('about.verification.item2') }}</li>
      <li>{{ t('about.verification.item3') }}</li>
    </ul>
    <p>{{ t('about.verification.text2') }}</p>

    <h2>{{ t('about.forOrganizers.title') }}</h2>
    <p>{{ t('about.forOrganizers.text1') }}</p>
    <ul>
      <li>{{ t('about.forOrganizers.item1') }}</li>
      <li>{{ t('about.forOrganizers.item2') }}</li>
      <li>{{ t('about.forOrganizers.item3') }}</li>
    </ul>
    <p>{{ t('about.forOrganizers.text2') }}</p>
  </InfoPageLayout>
</template>
