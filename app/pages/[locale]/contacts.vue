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

    <h2>{{ t('contacts.support.title') }}</h2>
    <p>{{ t('contacts.support.text') }}</p>
    <p>
      <a :href="`mailto:${t('contacts.emailSupport')}`">{{ t('contacts.emailSupport') }}</a>
    </p>

    <h2>{{ t('contacts.organizers.title') }}</h2>
    <p>{{ t('contacts.organizers.text') }}</p>
    <p>
      <a :href="`mailto:${t('contacts.emailOrganizers')}`">{{ t('contacts.emailOrganizers') }}</a>
    </p>

    <h2>{{ t('contacts.responseTime.title') }}</h2>
    <p>{{ t('contacts.responseTime.text') }}</p>
  </InfoPageLayout>
</template>
