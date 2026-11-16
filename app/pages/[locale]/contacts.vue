<script setup lang="ts">
const { t } = useLocale()

useSeoPage({
  title: () => t('seo.contactsTitle'),
  description: () => t('seo.contactsDescription'),
})
</script>

<template>
  <InfoPageLayout>
    <template #title>
      {{ t('contacts.title') }}
    </template>

    <p>{{ t('contacts.intro') }}</p>

    <h2>{{ t('contacts.general.title') }}</h2>
    <p>{{ t('contacts.general.text') }}</p>
    <ul>
      <li>{{ t('contacts.general.item1') }}</li>
      <li>{{ t('contacts.general.item2') }}</li>
      <li>{{ t('contacts.general.item3') }}</li>
      <li>{{ t('contacts.general.item4') }}</li>
    </ul>

    <h2>{{ t('contacts.organizers.title') }}</h2>
    <p>{{ t('contacts.organizers.text') }}</p>
    <ul>
      <li>{{ t('contacts.organizers.item1') }}</li>
      <li>{{ t('contacts.organizers.item2') }}</li>
      <li>{{ t('contacts.organizers.item3') }}</li>
      <li>{{ t('contacts.organizers.item4') }}</li>
      <li>{{ t('contacts.organizers.item5') }}</li>
    </ul>

    <h2>{{ t('contacts.privacy.title') }}</h2>
    <p>{{ t('contacts.privacy.text') }}</p>
    <ul>
      <li>{{ t('contacts.privacy.item1') }}</li>
      <li>{{ t('contacts.privacy.item2') }}</li>
      <li>{{ t('contacts.privacy.item3') }}</li>
    </ul>

    <h2>{{ t('contacts.email.title') }}</h2>
    <p>{{ t('contacts.email.text') }}</p>
    <p>
      <a :href="`mailto:${t('contacts.email.address')}`">{{ t('contacts.email.address') }}</a>
    </p>

    <h2>{{ t('contacts.responseTime.title') }}</h2>
    <p>{{ t('contacts.responseTime.text') }}</p>
  </InfoPageLayout>
</template>
