<script setup lang="ts">
const { t } = useLocale()

const faqItems = computed(() => [
  { id: 'q1', question: t('faq.items.q1'), answer: t('faq.items.a1') },
  { id: 'q2', question: t('faq.items.q2'), answer: t('faq.items.a2') },
  { id: 'q3', question: t('faq.items.q3'), answer: t('faq.items.a3') },
  { id: 'q4', question: t('faq.items.q4'), answer: t('faq.items.a4') },
  { id: 'q5', question: t('faq.items.q5'), answer: t('faq.items.a5') },
  { id: 'q6', question: t('faq.items.q6'), answer: t('faq.items.a6') },
  { id: 'q7', question: t('faq.items.q7'), answer: t('faq.items.a7') },
  { id: 'q8', question: t('faq.items.q8'), answer: t('faq.items.a8') },
])

useSeoPage({
  title: () => t('seo.faqTitle'),
  description: () => t('seo.faqDescription'),
  jsonLd: () => JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': faqItems.value.map(item => ({
      '@type': 'Question',
      'name': item.question,
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': item.answer,
      },
    })),
  }),
})
</script>

<template>
  <InfoPageLayout>
    <template #title>
      {{ t('faq.title') }}
    </template>

    <p>{{ t('faq.intro') }}</p>

    <UiAccordion :items="faqItems" />
  </InfoPageLayout>
</template>
