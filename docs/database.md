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
| bio, qualification | String? | |
| specializations | String[] | Default: [] |
| experienceYears | Int? | |
| languages | String[] | ISO 639-1 codes, Default: [] |
| workFormats | String[] | Default: [] |
| city, location | String? | |
| education | String? | |
| telegramUrl, instagramUrl, linkedinUrl, whatsappUrl, facebookUrl, youtubeUrl, tiktokUrl | String? | Social links |
| website | String? | |
| verificationStatus | VerificationStatus | Default: UNVERIFIED |
| rejectionReason | String? | |

Indexes: `verificationStatus`

### Group

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| organizerId | String? | FK → OrganizerProfile (SET NULL) |
| title | String | |
| slug | String | Unique |
| description | String | |
| format | GroupFormat? | ONLINE/OFFLINE/HYBRID |
| type | GroupType? | 19 values (THERAPEUTIC, WORKSHOP, etc.) |
| location | String? | |
| startsAt, endsAt | DateTime? | CHECK: endsAt > startsAt |
| timezone | String | Default: "UTC" |
| capacity | Int? | CHECK: capacity > 0 |
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
| type | NotificationType | 11 values |
| entityType, entityId | String | Polymorphic reference |
| title, message | String | |
| readAt | DateTime? | |

Indexes: `readAt`, `[userId, readAt]`

### Other Models

- **Favorite** — composite PK `[userId, groupId]`
- **Review** — CHECK: rating BETWEEN 1 AND 5, unique `[userId, groupId]`
- **Report** — reporter FK → User (CASCADE), indexes on `[entityType, entityId]`
- **EmailEvent** — tracks email delivery (PENDING → SENT/FAILED/BOUNCED)
- **GroupTag** — name + slug, many-to-many with Group
- **rate_limits** — Postgres-backed rate limiting table (key PK, points, expire)

## Enums

| Enum | Values |
|------|--------|
| Role | VISITOR, ORGANIZER, ADMIN |
| VerificationStatus | UNVERIFIED, PENDING, VERIFIED, REJECTED |
| GroupFormat | ONLINE, OFFLINE, HYBRID |
| GroupType | THERAPEUTIC, WORKSHOP, SEMINAR, LECTURE, LECTURE_COURSE, INTENSIVE, AUTHOR_PROGRAM, SUPERVISION, CONFERENCE, CERTIFICATION, SPECIALIZATION, FOUNDATION, ADVANCED, PROFESSIONAL, MODULAR, PARTNERSHIP, INTERNATIONAL, PILOT, OTHER |
| GroupStatus | DRAFT, PENDING_REVIEW, PUBLISHED, REJECTED, FULL, COMPLETED, CANCELLED |
| ApplicationStatus | PENDING, APPROVED, REJECTED, WITHDRAWN |
| QuestionType | TEXT, SINGLE_CHOICE, MULTIPLE_CHOICE |
| NotificationType | APPLICATION_RECEIVED, APPLICATION_APPROVED, APPLICATION_REJECTED, APPLICATION_WITHDRAWN, GROUP_APPROVED, GROUP_REJECTED, GROUP_STARTING, GROUP_PENDING_REVIEW, ORGANIZER_PENDING_REVIEW, ORGANIZER_APPROVED, ORGANIZER_REJECTED |
| ReviewStatus | PENDING, APPROVED, REJECTED |
| ReportStatus | PENDING, RESOLVED, DISMISSED |
| EmailEventStatus | PENDING, SENT, FAILED, BOUNCED |

## CHECK Constraints

| Table | Constraint | Rule |
|-------|-----------|------|
| User | `User_locale_check` | preferredLocale IN ('ua', 'en') |
| Group | `Group_price_check` | priceAmount IS NULL OR priceAmount >= 0 |
| Group | `Group_dates_check` | endsAt IS NULL OR startsAt IS NULL OR endsAt > startsAt |
| Group | `Group_capacity_check` | capacity IS NULL OR capacity > 0 |
| Review | `Review_rating_check` | rating BETWEEN 1 AND 5 |

## Row Level Security

RLS is enabled on all tables including `GroupCoOrganizer` and `rate_limits`.

## Migrations

```bash
# Development — create and apply migration
npx prisma migrate dev --name description

# Production — apply pending migrations
npx prisma migrate deploy

# Check status
npx prisma migrate status
```

Schema location: `database/schema.prisma`
Migrations directory: `database/migrations/`
Prisma config: `prisma.config.ts`

## Seed

```bash
npm run db:seed
```

Safety guards:
- Refuses in `NODE_ENV=production`
- Only allows localhost/127.0.0.1 (override with `ALLOW_SEED_HOST`)
- Requires confirmation prompt (skip with `CI=true` or `FORCE_SEED=true`)
