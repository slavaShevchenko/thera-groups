# Project Structure

## Principle

Folder placement must communicate responsibility.

Do not place code in a convenient location simply because it is easy to import.

## Application

```text
app/
├── components/
│   ├── ui/
│   ├── layout/
│   ├── sections/
│   └── features/
├── composables/
├── layouts/
├── locales/
├── middleware/
├── pages/
├── plugins/
├── stores/
├── utils/
└── assets/
```

### `components/ui`

Generic visual primitives.

Examples:

```text
UiButton.vue
UiInput.vue
UiTextarea.vue
UiSelect.vue
UiCheckbox.vue
UiRadio.vue
UiModal.vue
UiSpinner.vue
UiPagination.vue
```

No business knowledge.

### `components/layout`

Shared structural components:

```text
AppHeader.vue
AppFooter.vue
AppNavigation.vue
AppContainer.vue
```

### `components/features`

Domain-specific reusable components:

```text
GroupCard.vue
GroupFilters.vue
GroupApplicationForm.vue
OrganizerCard.vue
NotificationList.vue
```

### `components/sections`

Page-level compositions:

```text
HomeHero.vue
FeaturedGroups.vue
PopularTopics.vue
```

### `composables`

Reusable application logic.

Examples:

```text
useLocale.ts
useLocaleHead.ts
useAuth.ts
useGroups.ts
useApplications.ts
useNotifications.ts
```

A composable must have a clear responsibility.

### `locales`

Translation files for the application.

```text
locales/
├── ua.json
└── en.json
```

Both files must maintain the same key structure.

See `docs/i18n.md`.

### `middleware`

Route middleware.

```text
middleware/
└── locale.global.ts
```

The global locale middleware resolves the active language using the priority system (cookie > URL > default) and redirects to the correct path-based locale prefix.

See `docs/i18n.md`.

### `utils`

Pure helper functions without Vue state.

### `stores`

Only client-side global state that actually needs to be shared.

Do not store every API response in Pinia.

### `pages`

Routing and page composition.

Pages should remain relatively thin.

All pages live under the dynamic `[locale]` segment to support path-based localization:

```text
pages/
└── [locale]/
    ├── index.vue
    └── groups/
        ├── index.vue
        └── [slug].vue
```

See `docs/i18n.md` and `docs/seo.md`.

---

## Server

```text
server/
├── api/
├── middleware/
├── services/
├── repositories/
├── utils/
└── plugins/
```

### `server/api`

HTTP boundaries.

Handlers should validate input, authorize the request and delegate.

### `server/services`

Business workflows.

Examples:

```text
groupService
applicationService
notificationService
organizerService
```

### `server/repositories`

Database access.

Repositories should know about persistence, not UI.

### `server/utils`

Server-only helpers.

---

## Shared

```text
shared/
├── constants/
├── schemas/
├── types/
└── utils/
```

Use `shared` only for code safe and useful on both client and server.

Never put secrets or server-only database code there.

---

## Database

```text
database/
├── migrations/
└── seed/
```

Database schema changes must be reproducible.

Never make manual production-only schema changes that are not represented by migrations.

---

## Naming

Components: PascalCase.vue
Composables: camelCase.ts
Utilities: camelCase.ts
Services: camelCase.ts
Repositories: camelCase.ts

Use meaningful names.

Avoid:

```text
helpers.ts
common.ts
misc.ts
stuff.ts
data.ts
```

unless the file has a genuinely broad and documented purpose.

---