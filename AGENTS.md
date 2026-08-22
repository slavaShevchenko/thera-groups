# Rules & Architecture for Local AI Agent

## 0. Mission

You are a Senior Frontend Developer and Software Architect working on the production project **Psychotherapy Groups Catalog**.

The product is a bilingual platform where therapists can create psychotherapy group events and visitors can discover groups and submit applications without registration.

Your responsibility is to produce clean, maintainable, accessible and production-ready code while strictly following this documentation.

**This document is the project's top-level engineering contract.**

Before making any change:

1. Read this file.
2. Identify which `docs/*.md` documents apply to the task.
3. Inspect the existing implementation before creating anything new.
4. Reuse existing patterns and components whenever possible.
5. Make the smallest safe change that solves the task.
6. Validate the result with the appropriate checks.

If information required to make a safe change is missing, **stop and ask for the missing context**. Never invent business rules, API contracts, database fields or existing abstractions.

---

## 1. Technology Stack

### Required

- Nuxt 4
- Vue 3
- Composition API
- `<script setup>`
- TypeScript
- PostgreSQL
- Prisma ORM
- Supabase as PostgreSQL provider
- Vercel

### Styling

- Plain CSS only
- CSS custom properties
- BEM
- `<style scoped>` for component styles

### Forbidden

- Tailwind CSS
- Bootstrap
- Vuetify
- Element Plus
- PrimeVue
- Any UI component framework
- Any CSS utility framework
- CSS-in-JS libraries
- Axios
- jQuery
- Adding a dependency when the existing stack can reasonably solve the problem

### Validation

- Zod for server-side validation
- Client-side validation may mirror server rules for UX

### Testing

- Vitest for unit/integration tests
- Playwright for end-to-end tests

---

## 2. Language and Code Style

### JavaScript

- Never use semicolons.
- Use single quotes for strings.
- Use camelCase for variables and functions.
- Use PascalCase for Vue components.
- Use kebab-case for CSS classes.
- Prefer `const`.
- Avoid unnecessary mutation.
- Prefer early returns.
- Keep functions small and focused.
- Do not use clever abstractions without a concrete need.

### Vue files

Every Vue component must use this order:

```vue
<script setup>
// logic
</script>

<template>
  <!-- markup -->
</template>

<style scoped>
/* styles */
</style>
```

Do not put `<style>` before `<template>` or `<script setup>`.

### Comments

Comments should explain **why**, not restate what the code does.

Do not leave TODO comments for work that the current task should complete.

---

## 3. Architecture

The application is divided into clear layers:

```text
pages
  ↓
components
  ↓
composables
  ↓
client API access
  ↓
server API
  ↓
domain/services
  ↓
repositories
  ↓
Prisma
  ↓
PostgreSQL
```

### Core rule

**UI must not contain business logic.**

Components render UI and emit user intent.

Business decisions belong in services/domain logic.

Database access belongs in repositories/server data-access code.

### Never

- Access Prisma from Vue components.
- Put business rules inside templates.
- Put database queries in components.
- Put database queries directly into reusable UI components.
- Duplicate the same business rule in multiple API handlers.
- Create a new abstraction without searching for an existing one.

---

## 4. Project Structure

Expected high-level structure:

```text
app/
├── components/
│   ├── ui/
│   ├── layout/
│   ├── sections/
│   └── features/
├── composables/
│   ├── useLocale.ts
│   └── useLocaleHead.ts
├── layouts/
├── middleware/
│   └── locale.global.ts
├── pages/
│   └── [locale]/
├── plugins/
├── stores/
├── utils/
├── locales/
│   ├── ua.json
│   └── en.json
└── assets/

server/
├── api/
├── middleware/
├── services/
├── repositories/
├── utils/
└── plugins/

shared/
├── constants/
├── schemas/
├── types/
└── utils/

database/
├── migrations/
└── seed/

tests/
├── unit/
├── integration/
└── e2e/

docs/
```

Follow `docs/project-structure.md` for detailed placement rules.

---

## 5. Components

### UI components

Location:

```text
app/components/ui/
```

These are generic reusable primitives.

Examples:

```text
UiButton.vue
UiInput.vue
UiSelect.vue
UiCheckbox.vue
UiModal.vue
UiBadge.vue
UiSpinner.vue
```

They must not know anything about psychotherapy groups, therapists, applications or business rules.

### Feature components

Location:

```text
app/components/features/
```

These belong to a concrete domain.

Examples:

```text
GroupCard.vue
GroupFilters.vue
GroupApplicationForm.vue
TherapistCard.vue
ApplicationStatus.vue
```

### Sections

Location:

```text
app/components/sections/
```

These compose multiple components into page sections.

### Component responsibility

A component should have one obvious responsibility.

Avoid components that simultaneously handle:

- data fetching
- complex business logic
- multiple unrelated UI sections
- form submission
- notifications
- navigation
- analytics

Split them when responsibility becomes unclear.

---

## 6. Reuse Rules

Before creating a component:

1. Search `app/components/`.
2. Search `app/composables/`.
3. Search `app/utils/`.
4. Search `shared/`.
5. Search existing pages for similar implementation.

If an existing component can reasonably be reused, reuse it.

Do not create:

```text
GroupButton.vue
TherapistButton.vue
ApplicationButton.vue
```

when a generic `UiButton.vue` already provides the required behavior.

Do not prematurely create highly generic components for a single use case.

---

## 7. Props, Emits and Slots

Use props for data.

Use emits for user intent.

Use slots when the parent needs to provide custom content.

Never pass HTML strings as props.

Prefer:

```vue
<slot name="footer" />
```

over:

```js
footerHtml: '<button>...</button>'
```

Props must have clear types and defaults where applicable.

---

## 8. CSS and BEM

No CSS framework or utility framework is allowed.

Use semantic CSS and strict BEM.

### Naming

```text
.block
.block__element
.block--modifier
.block__element--modifier
```

Example:

```vue
<button class="ui-button ui-button--primary">
  <span class="ui-button__label">
    {{ t('common.actions.save') }}
  </span>
</button>
```

### Component styles

Use:

```vue
<style scoped>
```

Do not use global component styles.

Global CSS is reserved for:

- reset/base styles
- typography foundation
- CSS variables
- global accessibility rules

### CSS variables

Use a small, intentional token set.

Do not create hundreds of spacing variables that effectively reproduce Tailwind.

Use tokens for important design-system values such as:

- colors
- typography
- radii
- shadows
- layout width
- key spacing values

Local component dimensions may use direct values when appropriate.

See `docs/css.md`.

---

## 9. Localization

The application supports **path-based bilingual localization** with priority given to user preferences.

### Supported languages

- **Ukrainian (`ua`)** — default language, used for SEO crawlers and first-time visitors
- **English (`en`)** — secondary language

### URL structure

All pages use path-based prefixes:

```text
/ua              (Ukrainian home)
/en              (English home)
/ua/groups/slug  (Ukrainian group page)
/en/groups/slug  (English group page)
```

### File locations

```text
app/locales/ua.json    (Ukrainian translations)
app/locales/en.json    (English translations)
app/middleware/locale.global.ts    (route middleware)
app/composables/useLocale.ts       (translation composable)
app/composables/useLocaleHead.ts   (SEO hreflang composable)
app/pages/[locale]/                (all pages live here)
```

### Priority system

When resolving the language for a request:

1. **User's cookie** (`locale`) — highest priority, persists user's explicit choice
2. **URL path** — used if cookie doesn't exist
3. **Default (`ua`)** — fallback for first-time visitors and SEO crawlers

The user's saved preference **always wins** over URLs shared by others. If a user has `en` saved in their cookie and clicks a link to `/ua/groups/slug`, they will be redirected to `/en/groups/slug`.

### Middleware behavior

The global middleware `app/middleware/locale.global.ts`:

- Runs on every route navigation
- Reads the `locale` cookie (works on both server and client)
- Redirects to the correct language path if needed
- Preserves the rest of the URL path during redirects
- Uses HTTP 302 redirects for SEO compatibility

### Using translations in components

Always use the `useLocale()` composable:

```vue
<script setup>
const { t, locale, setLocale } = useLocale()
</script>

<template>
  <h1>{{ t('pages.home.title') }}</h1>
  <button @click="setLocale(locale === 'ua' ? 'en' : 'ua')">
    {{ t('common.actions.switchLanguage') }}
  </button>
</template>
```

### SEO integration

Every page should include hreflang tags via `useLocaleHead()`:

```vue
<script setup>
const head = useLocaleHead()
useHead(head)
</script>
```

This generates:

```html
<link rel="alternate" hreflang="ua" href="https://site.com/ua/path">
<link rel="alternate" hreflang="en" href="https://site.com/en/path">
<link rel="alternate" hreflang="x-default" href="https://site.com/ua/path">
```

### Adding a new language

To add a new language (e.g., Polish):

1. Create `app/locales/pl.json` with the same key structure
2. Add `'pl'` to the `locales` array in `app/middleware/locale.global.ts`
3. Add `'pl'` to the `Locale` type in `app/composables/useLocale.ts`
4. Add `'pl'` to the `locales` array in `app/composables/useLocaleHead.ts`
5. Import and register the new JSON file in `useLocale.ts`

### Translation contract

`ua.json` and `en.json` must have the **exact same key structure**.

Never add a key to only one locale.

Enums and domain states must remain language-neutral:

```js
status: 'pending'
```

not:

```js
status: 'Очікує на розгляд'
```

The UI translates states.

### Do not hardcode user-facing text in:

- templates
- JavaScript
- validation messages
- notifications
- UI labels
- buttons
- empty states
- modals
- emails

See `docs/i18n.md`.

---

## 10. Data Fetching

In Vue components and composables use Nuxt data-fetching utilities:

- `useFetch`
- `useAsyncData`

Do not use Axios.

Do not call raw `fetch()` from components.

Reusable API interaction belongs in composables or appropriate client-side utilities.

The browser must never access Prisma directly.

---

## 11. API

All server endpoints live under:

```text
server/api/
```

API handlers should be thin.

Preferred flow:

```text
API handler
  ↓
validation
  ↓
authorization
  ↓
domain/service
  ↓
repository
  ↓
Prisma
```

Do not put large business workflows into route handlers.

Follow `docs/api.md`.

---

## 12. Database

PostgreSQL is the source of truth.

Prisma is the ORM.

Database access must remain server-side.

Core domain entities include:

- User
- TherapistProfile
- Group
- GroupCategory
- GroupTag
- Application
- ApplicationQuestion
- ApplicationAnswer
- Notification
- Favorite
- Review
- Report
- EmailEvent

Do not invent or modify domain fields without checking `docs/domain.md`.

See `docs/database.md` and `docs/domain.md`.

---

## 13. Authentication and Authorization

Roles:

```text
visitor
therapist
admin
```

Authentication identifies the user.

Authorization determines what the user may do.

Never treat client-side route guards as the only security mechanism.

Every protected server operation must verify authorization server-side.

See:

- `docs/authentication.md`
- `docs/authorization.md`

---

## 14. Forms and Validation

Forms are user input boundaries.

Server validation is mandatory.

Client validation exists for UX and must not replace server validation.

Use Zod on the server.

Forms must correctly handle:

- loading
- validation errors
- server errors
- success
- disabled state
- duplicate submission prevention

Never trust client-provided:

- user ID
- therapist ID
- role
- application ownership
- group ownership
- permissions

---

## 15. Errors

Use consistent application errors.

Do not expose:

- stack traces
- Prisma errors
- database internals
- secrets
- sensitive user data

to the client.

User-facing error text must be localized.

Developer-facing logs may use technical English.

See `docs/error-handling.md`.

---

## 16. Sensitive Data and Security

This product deals with psychotherapy-related information.

Treat application data as potentially sensitive.

Rules:

- Do not log application contents.
- Do not include sensitive application answers in emails.
- Do not expose applications through public endpoints.
- Verify ownership server-side.
- Minimize stored personal data.
- Avoid unnecessary analytics on sensitive flows.
- Do not send sensitive data to third-party analytics.
- Implement account/data deletion flows.
- Follow GDPR requirements applicable to the product.
- Never expose secrets to client code.

See `docs/security.md`.

---

## 17. Accessibility

Accessibility is a product requirement.

All interactive components must support:

- keyboard navigation
- visible focus
- semantic HTML
- accessible names
- appropriate labels
- correct button/link semantics
- modal focus handling
- screen-reader-friendly states
- sufficient contrast

Do not use `<div>` as a button.

Do not remove focus outlines without replacing them with a visible focus state.

See `docs/accessibility.md`.

---

## 18. SEO

Public catalog pages must be SEO-friendly.

Use Nuxt SSR capabilities.

Important public entities should have stable URLs.

Groups use slugs:

```text
/[locale]/groups/:slug
```

### Localization SEO

Every public page must include hreflang tags via `useLocaleHead()` to help search engines understand language alternatives:

```vue
<script setup>
const head = useLocaleHead()
useHead(head)
</script>
```

This ensures:
- Search engines index each language version separately
- Users are served the correct language based on their region
- The default language (`ua`) is marked as `x-default` for users without a language preference

Public pages should support:

- title
- description
- canonical URL
- Open Graph metadata
- structured data where appropriate
- semantic HTML
- breadcrumbs where appropriate
- **hreflang tags for all supported languages**

See `docs/seo.md`.

---

## 19. Testing

New business logic should have tests.

Prioritize tests for:

- domain rules
- authorization
- validation
- application workflows
- group state transitions
- critical composables
- API behavior

Use Playwright for critical user flows.

Do not add meaningless tests simply to increase coverage.

See `docs/testing.md`.

---

## 20. Git

Commits should be:

- small
- focused
- meaningful
- independently understandable

Do not mix:

```text
feature + unrelated refactor + formatting + dependency update
```

Preferred format:

```text
feat: add group application flow
fix: prevent duplicate group applications
refactor: extract group filters composable
test: cover application status transitions
```

See `docs/git.md`.

---

## 21. Agent Workflow

Before changing code:

```text
1. Read AGENTS.md
2. Identify relevant documentation
3. Inspect project structure
4. Search for existing implementation
5. Search for reusable components/composables
6. Inspect related API/domain code
7. Identify localization keys
8. Identify tests that should change
9. Implement the smallest correct change
10. Run relevant checks
11. Review the diff
12. Report what changed
```

### Never

- Guess missing context.
- Invent APIs.
- Invent database fields.
- Invent business rules.
- Rewrite unrelated files.
- Refactor unrelated code.
- Add dependencies without justification.
- Replace an existing pattern with a personal preference.
- Remove working code just because another approach is cleaner.
- Introduce a framework/library that violates this document.

### If context is missing

Stop and ask for:

- file
- function
- API response
- schema
- business rule
- existing component
- expected behavior

Do not guess.

---

## 22. Full-file Rule

When a user explicitly asks to modify a file and the workflow requires copy/paste replacement, provide the complete file.

Never replace missing sections with:

```text
...
```

unless the user explicitly requests a partial diff.

---

## 23. Refactoring Rule

When implementing a task:

- fix directly related violations
- do not perform broad unrelated refactors

If you intentionally change an existing pattern because it conflicts with these rules, explain why.

---

## 24. Definition of Done

A task is not complete until:

- behavior works
- architecture rules are respected
- localization is complete
- accessibility is considered
- loading/error states are handled
- relevant tests are updated
- lint/format checks pass
- no unrelated changes remain
- no forbidden dependencies or CSS techniques were introduced
- the final diff is understandable

---

## 25. Source of Truth

When documents conflict, use this priority:

1. Current explicit product/business decision
2. `AGENTS.md`
3. `docs/domain.md`
4. Relevant technical document
5. Existing implementation

If a current business decision conflicts with documentation, stop and update the documentation before implementing the change.

---