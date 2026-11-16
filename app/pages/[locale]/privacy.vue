<script setup lang="ts">
const { t } = useLocale()

useSeoPage({
  title: () => t('seo.privacyTitle'),
  description: () => t('seo.privacyDescription'),
})
</script>

<template>
  <InfoPageLayout>
    <template #title>
      {{ t('privacy.title') }}
    </template>

    <p>{{ t('privacy.intro') }}</p>

    <h2>{{ t('privacy.controller.title') }}</h2>
    <p>{{ t('privacy.controller.text1') }}</p>
    <p>{{ t('privacy.controller.text2') }}</p>

    <h2>{{ t('privacy.dataCollection.title') }}</h2>
    <p>{{ t('privacy.dataCollection.intro') }}</p>

    <h3>{{ t('privacy.dataCollection.applicants.title') }}</h3>
    <p>{{ t('privacy.dataCollection.applicants.text1') }}</p>
    <ul>
      <li>{{ t('privacy.dataCollection.applicants.item1') }}</li>
      <li>{{ t('privacy.dataCollection.applicants.item2') }}</li>
      <li>{{ t('privacy.dataCollection.applicants.item3') }}</li>
      <li>{{ t('privacy.dataCollection.applicants.item4') }}</li>
    </ul>

    <h3>{{ t('privacy.dataCollection.organizers.title') }}</h3>
    <p>{{ t('privacy.dataCollection.organizers.text1') }}</p>
    <ul>
      <li>{{ t('privacy.dataCollection.organizers.item1') }}</li>
      <li>{{ t('privacy.dataCollection.organizers.item2') }}</li>
      <li>{{ t('privacy.dataCollection.organizers.item3') }}</li>
      <li>{{ t('privacy.dataCollection.organizers.item4') }}</li>
      <li>{{ t('privacy.dataCollection.organizers.item5') }}</li>
    </ul>

    <h3>{{ t('privacy.dataCollection.technical.title') }}</h3>
    <p>{{ t('privacy.dataCollection.technical.text1') }}</p>
    <ul>
      <li>{{ t('privacy.dataCollection.technical.item1') }}</li>
      <li>{{ t('privacy.dataCollection.technical.item2') }}</li>
      <li>{{ t('privacy.dataCollection.technical.item3') }}</li>
    </ul>

    <h2>{{ t('privacy.legalBasis.title') }}</h2>
    <p>{{ t('privacy.legalBasis.text1') }}</p>
    <ul>
      <li>{{ t('privacy.legalBasis.item1') }}</li>
      <li>{{ t('privacy.legalBasis.item2') }}</li>
      <li>{{ t('privacy.legalBasis.item3') }}</li>
      <li>{{ t('privacy.legalBasis.item4') }}</li>
    </ul>

    <h2>{{ t('privacy.dataUsage.title') }}</h2>
    <p>{{ t('privacy.dataUsage.text1') }}</p>
    <ul>
      <li>{{ t('privacy.dataUsage.item1') }}</li>
      <li>{{ t('privacy.dataUsage.item2') }}</li>
      <li>{{ t('privacy.dataUsage.item3') }}</li>
      <li>{{ t('privacy.dataUsage.item4') }}</li>
      <li>{{ t('privacy.dataUsage.item5') }}</li>
    </ul>

    <h2>{{ t('privacy.dataSharing.title') }}</h2>
    <p>{{ t('privacy.dataSharing.text1') }}</p>
    <ul>
      <li>{{ t('privacy.dataSharing.item1') }}</li>
      <li>{{ t('privacy.dataSharing.item2') }}</li>
      <li>{{ t('privacy.dataSharing.item3') }}</li>
    </ul>
    <p>{{ t('privacy.dataSharing.text2') }}</p>

    <h2>{{ t('privacy.internationalTransfers.title') }}</h2>
    <p>{{ t('privacy.internationalTransfers.text1') }}</p>
    <p>{{ t('privacy.internationalTransfers.text2') }}</p>

    <h2>{{ t('privacy.cookies.title') }}</h2>
    <p>{{ t('privacy.cookies.text1') }}</p>
    <p>{{ t('privacy.cookies.text2') }}</p>
    <ul>
      <li>{{ t('privacy.cookies.item1') }}</li>
      <li>{{ t('privacy.cookies.item2') }}</li>
      <li>{{ t('privacy.cookies.item3') }}</li>
    </ul>
    <p>{{ t('privacy.cookies.text3') }}</p>

    <h2>{{ t('privacy.dataRetention.title') }}</h2>
    <p>{{ t('privacy.dataRetention.text1') }}</p>
    <ul>
      <li>{{ t('privacy.dataRetention.item1') }}</li>
      <li>{{ t('privacy.dataRetention.item2') }}</li>
      <li>{{ t('privacy.dataRetention.item3') }}</li>
    </ul>

    <h2>{{ t('privacy.userRights.title') }}</h2>
    <p>{{ t('privacy.userRights.text1') }}</p>
    <ul>
      <li>{{ t('privacy.userRights.item1') }}</li>
      <li>{{ t('privacy.userRights.item2') }}</li>
      <li>{{ t('privacy.userRights.item3') }}</li>
      <li>{{ t('privacy.userRights.item4') }}</li>
      <li>{{ t('privacy.userRights.item5') }}</li>
      <li>{{ t('privacy.userRights.item6') }}</li>
      <li>{{ t('privacy.userRights.item7') }}</li>
    </ul>
    <p>{{ t('privacy.userRights.text2') }}</p>

    <h2>{{ t('privacy.children.title') }}</h2>
    <p>{{ t('privacy.children.text1') }}</p>

    <h2>{{ t('privacy.changes.title') }}</h2>
    <p>{{ t('privacy.changes.text1') }}</p>

    <h2>{{ t('privacy.contacts.title') }}</h2>
    <p>{{ t('privacy.contacts.text1') }}</p>
    <p>
      <a :href="`mailto:${t('privacy.email')}`">{{ t('privacy.email') }}</a>
    </p>
  </InfoPageLayout>
</template>
