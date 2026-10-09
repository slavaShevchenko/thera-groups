<script setup lang="ts">
const { t } = useLocale()

useSeoPage({
  title: () => t('seo.privacyTitle'),
  description: () => t('seo.privacyDescription'),
  // Placeholder copy awaiting legal review (TODO at the bottom of the template), so it
  // stays out of the index and the sitemap. Not Disallowed in robots.txt: that would hide
  // this very tag from the crawler.
  robots: 'noindex, nofollow',
})
</script>

<template>
  <InfoPageLayout>
    <template #title>
      {{ t('privacy.title') }}
    </template>

    <h2>{{ t('privacy.dataCollection.title') }}</h2>
    <p>{{ t('privacy.dataCollection.text1') }}</p>
    <ul>
      <li>{{ t('privacy.dataCollection.item1') }}</li>
      <li>{{ t('privacy.dataCollection.item2') }}</li>
      <li>{{ t('privacy.dataCollection.item3') }}</li>
      <li>{{ t('privacy.dataCollection.item4') }}</li>
    </ul>

    <h2>{{ t('privacy.dataUsage.title') }}</h2>
    <p>{{ t('privacy.dataUsage.text1') }}</p>
    <ul>
      <li>{{ t('privacy.dataUsage.item1') }}</li>
      <li>{{ t('privacy.dataUsage.item2') }}</li>
      <li>{{ t('privacy.dataUsage.item3') }}</li>
    </ul>

    <h2>{{ t('privacy.dataStorage.title') }}</h2>
    <p>{{ t('privacy.dataStorage.text1') }}</p>
    <p>{{ t('privacy.dataStorage.text2') }}</p>

    <h2>{{ t('privacy.cookies.title') }}</h2>
    <p>{{ t('privacy.cookies.text1') }}</p>

    <h2>{{ t('privacy.userRights.title') }}</h2>
    <p>{{ t('privacy.userRights.text1') }}</p>
    <ul>
      <li>{{ t('privacy.userRights.item1') }}</li>
      <li>{{ t('privacy.userRights.item2') }}</li>
      <li>{{ t('privacy.userRights.item3') }}</li>
      <li>{{ t('privacy.userRights.item4') }}</li>
    </ul>

    <h2>{{ t('privacy.contacts.title') }}</h2>
    <p>{{ t('privacy.contacts.text1') }}</p>
    <p>
      <a :href="`mailto:${t('privacy.email')}`">{{ t('privacy.email') }}</a>
    </p>

    <!-- TODO: review with lawyer before production -->
  </InfoPageLayout>
</template>
