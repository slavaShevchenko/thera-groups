<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()
const { t } = useLocale()

const LOCALES = ['ua', 'en']
const DEFAULT_LOCALE = 'ua'

const statusCode = computed(() => props.error.statusCode ?? 500)

/**
 * Error codes this page has its own copy for.
 *
 * `data.code` is the one part of an error that survives sanitizing intact, and it is the part
 * the server guarantees: `sanitizeError` whitelists exactly these names. The map is
 * deliberately short — the codes missing here (`GROUP_FULL`, `HAS_APPLICATIONS`, `CONFLICT`)
 * belong to API flows a page handles inline, so wording for them would be guesswork about a
 * case that never reaches a full-page error.
 *
 * `ORGANIZER_NOT_FOUND` is not a server code: it is how `organizers/[slug].vue` says "I know
 * what is missing, so do not show the generic 404 copy". A page that wants specific wording
 * names it here rather than putting text in `statusMessage`, for the reasons below.
 */
const MESSAGE_KEY_BY_CODE: Record<string, string> = {
  NOT_FOUND: 'errors.notFound',
  FORBIDDEN: 'errors.forbidden',
  UNAUTHORIZED: 'errors.unauthorized',
  RATE_LIMITED: 'errors.rateLimited',
  DATABASE_UNAVAILABLE: 'errors.unavailable',
  SERVICE_BUSY: 'errors.unavailable',
  ORGANIZER_NOT_FOUND: 'organizer.profile.notFound',
}

const MESSAGE_KEY_BY_STATUS: Record<number, string> = {
  401: 'errors.unauthorized',
  403: 'errors.forbidden',
  404: 'errors.notFound',
}

/**
 * Copy from this bundle and nothing else.
 *
 * `error.statusMessage` is deliberately **not** rendered, whatever it contains:
 *
 * - Nuxt's router fills it with its own English `Page not found: <path>` for an unmatched
 *   route, so a Ukrainian 404 would show English and echo the requested path back at the
 *   reader — a path this page did not choose and cannot sanitize;
 * - from the API it is never localized either: `toDomainHttpError()` substitutes a fixed
 *   English phrase per code and `sanitizeError()` blanks `INTERNAL`'s outright, precisely so
 *   that no internal sentence reaches a browser;
 * - of the three pages that throw one, two hardcode English (`'Group not found'`,
 *   `'Group type not found'`), which would render untranslated on `/ua/*`.
 *
 * There is no way to tell "a page chose this wording" from "the framework or the server did"
 * by looking at the string, so the page renders its own bundles and a caller that wants
 * specific copy says so with `data.code`.
 */
const message = computed(() => {
  const code = (props.error.data as { code?: unknown } | undefined)?.code
  if (typeof code === 'string' && MESSAGE_KEY_BY_CODE[code]) {
    return t(MESSAGE_KEY_BY_CODE[code])
  }

  return t(MESSAGE_KEY_BY_STATUS[statusCode.value] ?? 'errors.generic')
})

// error.vue replaces the whole app tree, so the `useLocaleHead()` call in app.vue never
// runs and `<html lang>` would stay on the nuxt.config default for an English error page.
// The locale is the first path segment. `useRequestURL()` is read once rather than inside
// a computed: it needs the Nuxt request context, which a lazily-evaluated getter can
// outlive once the error page is mounted client-side.
const HTML_LANG: Record<string, string> = { ua: 'uk', en: 'en' }
const localeSegment = useRequestURL().pathname.split('/').filter(Boolean)[0] ?? ''
const htmlLang = HTML_LANG[localeSegment] ?? 'uk'

// "Go home" used to point at `/`, whose route rule redirects to `/ua`, so an English reader
// who hit an error on an English page was handed back the Ukrainian site. The segment this
// page is already rendered in wins — it is what `t()` used — and the cookie covers an error
// page whose URL carries no locale, matching the priority `locale.global.ts` applies.
const localeCookie = useCookie<string>('locale')
const homeLocale = LOCALES.includes(localeSegment)
  ? localeSegment
  : (LOCALES.includes(localeCookie.value ?? '') ? localeCookie.value : DEFAULT_LOCALE)

// A bare "PsyGroup" tab on a 404 says nothing about what happened; the status is the one
// thing the page is certain of, so it leads the title.
useHead({
  htmlAttrs: { lang: htmlLang },
  title: () => t('seo.errorTitle', {
    code: String(statusCode.value),
    message: message.value,
  }),
})

function handleError() {
  clearError({ redirect: `/${homeLocale}` })
}
</script>

<template>
  <div class="error-page">
    <div class="error-page__content">
      <h1 class="error-page__code">
        {{ statusCode }}
      </h1>
      <p class="error-page__message">
        {{ message }}
      </p>
      <UiButton
        size="lg"
        @click="handleError"
      >
        {{ t('common.goHome') }}
      </UiButton>
    </div>
  </div>
</template>

<style scoped>
.error-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: var(--spacing-lg);
  text-align: center;
}

.error-page__content {
  max-width: 480px;
}

.error-page__code {
  font-size: 5rem;
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
  color: var(--color-text);
  margin: 0 0 var(--spacing-md);
}

.error-page__message {
  font-size: 1.25rem;
  color: var(--color-text-muted);
  margin: 0 0 var(--spacing-xl);
}
</style>
