# SEO

## Rendering

Public catalog pages should use Nuxt SSR.

Do not turn public catalog pages into client-only applications without an explicit reason.

## URLs

All public URLs use path-based locale prefixes:

```text
/[locale]/groups/:slug
```

Examples:

```text
/ua/groups/stress-management-group
/en/groups/stress-management-group
/ua/therapists/john-doe
/en/therapists/john-doe
```

Groups use stable slugs that are language-independent. The same group slug works for both language versions.

Therapists may have public profile URLs.

## Localization SEO

Every public page must include hreflang tags to help search engines understand language alternatives.

Use the `useLocaleHead()` composable in every public page:

```vue
<script setup lang="ts">
const head = useLocaleHead()
useHead(head)
</script>
```

This generates the required tags:

```html
<link rel="alternate" hreflang="ua" href="https://site.com/ua/path">
<link rel="alternate" hreflang="en" href="https://site.com/en/path">
<link rel="alternate" hreflang="x-default" href="https://site.com/ua/path">
```

The default locale (`ua`) is marked as `x-default` for users without a language preference.

### Why this matters

- Search engines index each language version separately
- Users are served the correct language based on their region
- Duplicate content penalties are avoided
- International users can find the appropriate language version

## Metadata

Public pages should provide:

- title (localized)
- meta description (localized)
- canonical URL (must include locale prefix)
- Open Graph metadata (localized title, description, locale tag)
- appropriate structured data

### Canonical URLs

Every page must have a canonical URL that includes the locale prefix:

```html
<link rel="canonical" href="https://site.com/ua/groups/stress-management">
```

Never use a canonical URL without the locale prefix, as this creates ambiguity for search engines.

### Open Graph

Open Graph tags should include the locale:

```html
<meta property="og:locale" content="uk_UA">
<meta property="og:title" content="[localized title]">
<meta property="og:description" content="[localized description]">
<meta property="og:url" content="https://site.com/ua/groups/stress-management">
```

## Group pages

A group page should contain meaningful crawlable content:

- title
- description
- therapist
- format
- schedule
- location
- price
- availability
- application information

All text content must be localized using the `useLocale()` composable.

## Search/filter pages

Filter URLs should be shareable and include the locale prefix:

```text
/ua/groups?format=online&language=ua
/en/groups?format=online&language=en
```

Do not create uncontrolled URL combinations that generate infinite crawlable duplicates.

Canonical/indexing strategy should be defined for filtered catalog pages.

Consider using `noindex` for pages with many filter combinations that add little unique value.

## Sitemap

Public indexable entities should be represented in the sitemap where appropriate.

The sitemap should include all language versions of public pages:

```xml
<url>
  <loc>https://site.com/ua/groups/stress-management</loc>
  <xhtml:link rel="alternate" hreflang="ua" href="https://site.com/ua/groups/stress-management"/>
  <xhtml:link rel="alternate" hreflang="en" href="https://site.com/en/groups/stress-management"/>
</url>
<url>
  <loc>https://site.com/en/groups/stress-management</loc>
  <xhtml:link rel="alternate" hreflang="ua" href="https://site.com/ua/groups/stress-management"/>
  <xhtml:link rel="alternate" hreflang="en" href="https://site.com/en/groups/stress-management"/>
</url>
```

## 404

Nonexistent public entities should produce proper HTTP semantics and a useful 404 page.

The 404 page should:

- Respect the locale from the URL (e.g., `/ua/nonexistent` shows Ukrainian 404)
- Provide navigation to the home page in the same language
- Include localized error messages

## Structured data

Use schema.org structured data only where it accurately represents the page.

Never add misleading structured data simply for SEO.

For group pages, consider using:

- `Event` schema for group sessions
- `Organization` schema for therapist practices
- `BreadcrumbList` for navigation hierarchy

All structured data text should be localized.

## Language switching and SEO

When a user switches languages via the UI:

- The URL changes to reflect the new locale
- The page re-renders with localized content
- No full page reload is required (for UX)
- Search engines see each language version as a separate page

The middleware ensures that:

- Shared links to `/ua/...` redirect to `/en/...` if the user's cookie preference is `en`
- This behavior does not affect search engine crawlers (they don't have cookies)
- SEO bots always see the correct canonical version of each language

---