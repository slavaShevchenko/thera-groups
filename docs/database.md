# Database

## Schema Location

`database/schema.prisma` — single source of truth for all models.

## Models

### User

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| authId | String? | Unique, links to Supabase Auth |
| email | String | Unique |
| role | Role | Default: VISITOR |
| isActive | Boolean | Default: true |
| preferredLocale | String | Default: "ua", CHECK: IN ('ua', 'en') |

Indexes: `role`

Relations: organizerProfile (1:1), notifications, favorites, reviews, reports, coOrganizedGroups, applications

### OrganizerProfile

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| userId | String | Unique, FK → User (CASCADE) |
| slug | String | Unique |
| firstName, lastName | String | Required |
| avatarUrl | String? | |
| bio, qualification | String? | bio optional. qualification is nullable in the DB but required at creation (`VERIFICATION_REQUIRED_FIELDS`) — see [domain-rules.md](./domain-rules.md#profile) |
| specializations | String[] | Default: [] |
| experienceYears | Int? | |
| languages | String[] | ISO 639-1 codes, Default: [] |
| workFormats | String[] | Default: [] |
| city, location | String? | |
| education | String[] | Default: [] |
| professionalOrganization, professionalOrganizationStatus | String | Default: "". Both required at creation; the DB default survives only on rows created before that. `moderateProfile` refuses to verify a profile missing either — see [domain-rules.md](./domain-rules.md#profile) |
| telegramUrl, instagramUrl, linkedinUrl, whatsappUrl, facebookUrl, youtubeUrl | String? | Social links |
| website | String? | |
| verificationStatus | VerificationStatus | Default: UNVERIFIED |
| rejectionReason | String? | |

Indexes: `verificationStatus`

### Group

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| organizerId | String? | FK → OrganizerProfile (SET NULL) |
| title | String | Required at creation (`createGroupSchema`): the slug is cut from it and can never be regenerated |
| slug | String | Unique. `slugify(title)` plus a random 6-hex suffix that is always appended, so uniqueness never depends on the title being unique — two organizers may both run a «Група підтримки для батьків». Capped at `GROUP_LIMITS.SLUG_MAX` (60), wider than the 40 organizer and article slugs use, and cut on a word boundary. Set once at creation and never renamed: a published URL is indexed, sitemapped and hreflang-linked, and is copied into `Notification.entityId` |
| description | String | |
| program | String? | Event program, free-form text |
| format | GroupFormat? | ONLINE/OFFLINE/HYBRID |
| type | GroupType? | 17 values (THERAPEUTIC, WORKSHOP, etc.) |
| location | String? | |
| languages | String[] | ISO 639-1 codes the event is conducted in, Default: []. Plural by design — bilingual groups and groups running with an interpreter are normal. Same shape and ceiling (`LIMITS.LANGUAGE_CODES_MAX`) as `OrganizerProfile.languages`. Not a critical field: editing it does not pull a PUBLISHED group back to PENDING_REVIEW |
| startsAt, endsAt | DateTime? | CHECK: endsAt > startsAt |
| timezone | String | Default: "Europe/Kyiv" (`SITE_TIMEZONE`). `POST /api/groups` sends only a title (and, for an ADMIN, an `organizerId`), so this default is the zone every real group is born with — it must stay a key of the `timezones` locale dictionary, which is where the edit form's dropdown gets its options. It was "UTC" until `20261125120000_group_timezone_default_site_zone`, which no dropdown offered: the select rendered empty while holding it, saved it back on every edit, and the group page printed the raw lookup key `timezones.UTC` |
| capacity | Int? | CHECK: capacity > 0 |
| minParticipants | Int? | CHECK: minParticipants > 0; must not exceed capacity (validated in `updateGroupSchema`) |
| durationHours | Int? | CHECK: durationHours > 0 |
| certificateIssued | Boolean? | Tri-state: null = organizer did not answer |
| priceAmount | Decimal(10,2)? | CHECK: priceAmount >= 0 |
| currency | String | Default: "UAH" |
| status | GroupStatus | Default: DRAFT |
| rejectionReason | String? | Text |

Indexes: `organizerId`, `type`, `[status, type]`, `startsAt`, `createdAt`

### GroupCoOrganizer

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| groupId | String | FK → Group (CASCADE) |
| userId | String | FK → User (CASCADE) |
| role | String | |
| sortOrder | Int | Default: 0 |

Unique: `[groupId, userId]`

### Application

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| groupId | String | FK → Group (CASCADE) |
| userId | String? | FK → User (SET NULL) |
| name | String | |
| email | String | |
| phone | String? | |
| message | String? | |
| status | ApplicationStatus | Default: PENDING |
| rejectionReason | String? | Required by `applicationService` when rejecting; cleared by any other decision |

Indexes: `groupId`, `status`, `email`, `userId`
Unique: `[groupId, email]` — prevents duplicate applications

### ApplicationQuestion

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| groupId | String | FK → Group (CASCADE) |
| question | String | |
| type | QuestionType | TEXT/SINGLE_CHOICE/MULTIPLE_CHOICE |
| required | Boolean | Default: false |
| position | Int | |
| options | String[] | Default: [] |

### ApplicationAnswer

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| applicationId | String | FK → Application (CASCADE) |
| questionId | String | FK → ApplicationQuestion (CASCADE) |
| value | String | |

Unique: `[applicationId, questionId]`

### Notification

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| userId | String | FK → User (CASCADE) |
| type | NotificationType | 17 values |
| entityType, entityId | String | Polymorphic reference |
| title, message | String | |
| readAt | DateTime? | |

Indexes: `readAt`, `[userId, readAt]`

### Article

Bilingual long-form editorial content, written by admins and published under
`/[locale]/articles`.

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK. Never leaves the server — the slug is the public identifier |
| slug | String | Unique. Set once at creation and never renamed: a published URL is indexed, sitemapped and hreflang-linked |
| status | ArticleStatus | DRAFT (default), PUBLISHED |
| authorId | String? | FK → OrganizerProfile (**SET NULL**, not CASCADE — deleting a profile does not retract an article published under their name, it just leaves the byline unlinked) |
| authorName | String? | Free-text byline for a contributor with no profile. Mutually exclusive with `authorId` |
| publishedAt | DateTime? | Required once PUBLISHED. Stored as the start of a calendar day in `Europe/Kyiv`, and read back as a bare `YYYY-MM-DD` |
| createdById | String? | FK → User (SET NULL) |

Indexes: unique `slug`, `[status, publishedAt]` (serves the public list's
`WHERE status = 'PUBLISHED' ORDER BY publishedAt DESC` without a sort), `authorId`

### ArticleTranslation

One row per (article, language). Two tables rather than one because the copy is per-locale
while the identity is not — and against this shape the publish gate is a row count, not a
comparison between two nullable column pairs that a third language would turn into a
migration.

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| articleId | String | FK → Article (**CASCADE** — a translation has no meaning without its article) |
| locale | String | `'ua'` or `'en'` |
| title | String | |
| content | String | **Markdown source**, never rendered HTML. Stored as submitted so an edit round-trips losslessly and a change to the renderer reaches every existing article |

Indexes: unique `[articleId, locale]` — also the lookup path for the nested filter the public
list runs, so no index on `locale` alone is needed and none is created.

A row is *deleted* rather than left blank when a language is withdrawn, so `incompleteLocales()`
can answer the publish gate with a row count.

### Other Models

- **Favorite** — composite PK `[userId, groupId]`
- **Review** — unused, see [Deprecated tables](#deprecated-tables). CHECK: rating BETWEEN 1 AND 5, unique `[userId, groupId]`
- **Report** — unused, see [Deprecated tables](#deprecated-tables). Reporter FK → User (CASCADE), indexes on `[entityType, entityId]`
- **EmailEvent** — tracks email delivery (PENDING → SENT → DELIVERED/BOUNCED/COMPLAINED, or FAILED / SKIPPED / DEV_PREVIEW). Carries `template`, `locale`, `providerId` (indexed) and `html`, which is only written for DEV_PREVIEW rows
- **GroupTag** — name + slug, many-to-many with Group
- **rate_limits** — Postgres-backed rate limiting table (key PK, points, expire). Not a Prisma model: `rate-limiter-flexible` owns it and it exists only as migration SQL, so `prisma migrate diff` offers to drop it. See [Checking the database still matches the model](#checking-the-database-still-matches-the-model)

## Enums

| Enum | Values |
|------|--------|
| Role | VISITOR, ORGANIZER, ADMIN |
| VerificationStatus | UNVERIFIED, PENDING, VERIFIED, REJECTED |
| GroupFormat | ONLINE, OFFLINE, HYBRID |
| GroupType | THERAPEUTIC, WORKSHOP, SEMINAR, LECTURE, LECTURE_COURSE, INTENSIVE, AUTHOR_PROGRAM, SUPERVISION, INTERVISION, CONFERENCE, SYMPOSIUM, CERTIFICATION, SPECIALIZATION, EDUCATIONAL_PROGRAMS, MODULAR, PILOT, OTHER |
| GroupStatus | DRAFT, PENDING_REVIEW, PUBLISHED, REJECTED, FULL, COMPLETED, CANCELLED |
| ApplicationStatus | PENDING, APPROVED, REJECTED, WITHDRAWN |
| QuestionType | TEXT, SINGLE_CHOICE, MULTIPLE_CHOICE |
| NotificationType | APPLICATION_RECEIVED, APPLICATION_SUBMITTED, APPLICATION_APPROVED, APPLICATION_REJECTED, APPLICATION_WITHDRAWN, GROUP_APPROVED, GROUP_REJECTED, GROUP_STARTING, GROUP_PENDING_REVIEW, GROUP_SUBMITTED, GROUP_AUTO_REVERT, GROUP_COMPLETED, GROUP_CANCELLED, ORGANIZER_PENDING_REVIEW, ORGANIZER_APPROVED, ORGANIZER_REJECTED, ORGANIZER_WELCOME |
| ReviewStatus | PENDING, APPROVED, REJECTED |
| ReportStatus | PENDING, RESOLVED, DISMISSED |
| EmailEventStatus | PENDING, SENT, FAILED, BOUNCED, SKIPPED, DEV_PREVIEW, DELIVERED, COMPLAINED |
| ArticleStatus | DRAFT, PUBLISHED |

## CHECK Constraints

| Table | Constraint | Rule |
|-------|-----------|------|
| User | `User_locale_check` | preferredLocale IN ('ua', 'en') |
| Group | `Group_price_check` | priceAmount IS NULL OR priceAmount >= 0 |
| Group | `Group_dates_check` | endsAt IS NULL OR startsAt IS NULL OR endsAt > startsAt |
| Group | `Group_capacity_check` | capacity IS NULL OR capacity > 0 |
| Group | `Group_minParticipants_check` | minParticipants IS NULL OR minParticipants > 0 |
| Group | `Group_durationHours_check` | durationHours IS NULL OR durationHours > 0 |
| Review | `Review_rating_check` | rating BETWEEN 1 AND 5 |
| EmailEvent | `EmailEvent_locale_check` | locale IS NULL OR locale IN ('ua', 'en') |
| Article | `Article_published_requires_date_check` | status <> 'PUBLISHED' OR publishedAt IS NOT NULL |
| Article | `Article_author_single_source_check` | authorId IS NULL OR authorName IS NULL |
| ArticleTranslation | `ArticleTranslation_locale_check` | locale IN ('ua', 'en') |

`Article_published_requires_date_check` is enforced here and not only in the service because
the service is one of two writers: an admin-panel bug or a hand-run `UPDATE` should not be
able to produce a published article with no date either. `Article_author_single_source_check`
is likewise backed by `createArticleSchema`/`updateArticleSchema`, which refuse both sources
at once with a 400 — a CHECK violation would surface as an unmapped 500, and the real problem
is an ambiguous request ("which name should the page print?"), not a malformed one.

## Row Level Security

`relrowsecurity` is `true` on every table in `public`, including `GroupCoOrganizer` and
`rate_limits`. **That flag is not an active control in this deployment, and reading it as one
is the mistake this section exists to prevent.**

There are no policies (`pg_policies` for `public` is empty) and no grants to `anon`,
`authenticated` or `service_role`, and the application connects as a role with `BYPASSRLS`.
So no query this application runs is filtered by RLS. What actually keeps data scoped is the
repository layer: every read is an explicit `select`/`where` written for its caller, and
`server/utils/permissions.ts` decides who may ask.

The flag is worth keeping — it is default-deny if a policy-free table is ever exposed through
PostgREST, which nothing does today — but it protects nothing on its own. The full reasoning,
including what a leaked `SUPABASE_ANON_KEY` can and cannot reach, is in
[security.md §10](./security.md#10-database-security-posture).

`tests/integration/rls.test.ts` asserts the flag and nothing more; its own comment says so.

## Deprecated tables

`Review` and `Report` are reserved for future functionality and are **not used**: both are
empty in production, and no query, service, handler or page in the repository reads or writes
either one. `ReviewStatus` and `ReportStatus` are dead for the same reason.

They are deliberately kept rather than dropped:

- Both carry real relations — `Review` has three `ON DELETE CASCADE` foreign keys and a
  `@@unique([userId, groupId])`; `Report` has one cascade and an `[entityType, entityId]`
  index. Recreating that later means another hand-written migration, and this project cannot
  use `migrate dev` (see below).
- An empty table costs nothing at runtime and is invisible to every query that does not name
  it.

Two things to know before wiring either up:

- `Report.entityType`/`entityId` are a polymorphic pair with no foreign key behind them, so a
  report outlives whatever it was filed against and nothing enforces that `entityType` names a
  real table. That needs a decision, not just a handler.
- A public rating on a therapist is content the platform becomes responsible for. `Review`
  should not be exposed before moderation is designed — `ReviewStatus` implies an approval
  step that does not exist yet.

If they are ever dropped, remember that `scripts/cleanup-test-data.sql` reports their row
counts as a pre-flight check, and that both are outside what Prisma's migrator will reconstruct
for you here.

## Migrations

```bash
# Apply pending migrations — the only safe command on a shared database
npx prisma migrate deploy

# Check status
npx prisma migrate status

# Regenerate the client after a schema change
npx prisma generate
```

Schema location: `database/schema.prisma`
Migrations directory: `database/migrations/`
Prisma config: `prisma.config.ts`

> **Never run `migrate dev` on a shared database.** It is not a "development convenience" here
> — it compares the schema to the migration history and, on any mismatch, offers to **reset**
> the database, which drops every table and all its data. It is also already blocked on this
> one: `20260921160000_constraints_indexes_rls` was edited after it had been applied, so
> Prisma reports a checksum mismatch and makes that offer on every run. Never accept it.
>
> Author migrations by hand instead (the repo already does this — see the round timestamps
> such as `20261002120000_organizer_profile_fields`):
>
> 1. Create `database/migrations/<timestamp>_<name>/migration.sql` with the raw SQL.
> 2. Apply it with `npx prisma migrate deploy`, which only runs pending migrations and never
>    proposes a reset.
> 3. Run `npx prisma generate`.
>
> CHECK constraints are not expressible in the Prisma schema; they live only in migration SQL
> and are listed above. `migrate status` does not report them as drift.

### Checking the database still matches the model

`migrate status` compares the migration *history* against the directory and nothing else. It
cannot tell you that the database those migrations produced still agrees with
`schema.prisma`, which is the only check that catches a hand-written migration that said
something slightly different from the model:

```bash
npx prisma migrate diff --from-config-datasource --to-schema database/schema.prisma --script
```

Read-only. Read the output; never pipe it into a session. Exactly one category of line is
expected noise and must not be applied:

- `DROP TABLE "rate_limits"` — not a Prisma model, see [Other Models](#other-models).

Everything else the script prints is real drift and belongs in a new migration. It has
already earned its place once: `20260921120000_gdpr_ondelete_cascade` recreated
`Group_organizerId_fkey` and `Report_reporterId_fkey` with an `ON DELETE` clause only, so
PostgreSQL defaulted them to `ON UPDATE NO ACTION` while the other 16 foreign keys carry
`CASCADE`. No behaviour depended on it — both reference a cuid primary key nothing rewrites —
but `migrate status` reported the database as up to date the whole time, and a diff that
always prints something is a diff nobody reads.
`20261104120000_align_fk_on_update_cascade` is the correction.

## Seed

```bash
npm run db:seed
```

Safety guards:
- Refuses in `NODE_ENV=production`
- Only allows localhost/127.0.0.1 (override with `ALLOW_SEED_HOST`)
- Requires confirmation prompt (skip with `CI=true` or `FORCE_SEED=true`)
