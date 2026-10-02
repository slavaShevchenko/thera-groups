# Domain Rules

All business rules enforced in code, extracted from services, repositories, and database constraints.

## Group Rules

### Status Transitions

```
DRAFT → PENDING_REVIEW
PENDING_REVIEW → PUBLISHED (admin only) | REJECTED (admin only)
REJECTED → PENDING_REVIEW
PUBLISHED → PENDING_REVIEW | FULL | CANCELLED
FULL → PUBLISHED | COMPLETED
CANCELLED → (terminal)
COMPLETED → (terminal)
```

### Group Types

`GroupType` holds 17 values (consolidated 2026-10 from 19). The single source of
truth for value ↔ slug pairs is `shared/constants/groupTypes.ts` (`GROUP_TYPES`);
the localized labels live under `groupTypes.<VALUE>` in `app/locales/{ua,en}.json`
and the per-slug SEO copy under `typePages.<slug>` and `seo.typePages.<slug>`.
Adding or removing a type means touching all four plus `database/schema.prisma`.

Retired values and where they went:

| Retired | Now | Reason |
|---------|-----|--------|
| `FOUNDATION`, `ADVANCED`, `PROFESSIONAL` | `EDUCATIONAL_PROGRAMS` | The three level-based program types overlapped too much for organizers to choose between; merged into one educational bucket. |
| `PARTNERSHIP`, `INTERNATIONAL` | `OTHER` | **Product decision** — both were dropped from the catalogue. They described who runs a program or where it comes from, not what the event is, so no non-`OTHER` replacement fits. |

Added: `INTERVISION` (peer case discussion without a supervisor), `SYMPOSIUM`.

Old catalogue URLs keep resolving: `LEGACY_SLUG_REDIRECTS` in
`shared/constants/groupTypes.ts` maps `foundation`/`advanced`/`professional` →
`educational-programs` and `partnership`/`international` → `other`, served as a
**301** by `server/middleware/catalogTypeRedirect.ts`. The redirect lives in server
middleware rather than in the page so crawlers and direct hits never see the 404
that `app/pages/[locale]/catalog/[type].vue` throws for an unknown slug.

Data was migrated by `20261002170000_migrate_group_type_data` before
`20261002180000_drop_legacy_group_types` rebuilt the enum — PostgreSQL has no
`ALTER TYPE ... DROP VALUE`, so the type is renamed, recreated and the column
re-cast. Both migrations are safe to re-run against a database where the retired
values are already absent (no row matched at apply time).

### Creation

- Only VERIFIED organizers or ADMINs can create groups
- New groups start as DRAFT
- Slug must be unique (auto-generated from title)

### Editing

- Owner, co-organizers, and admins can edit
- Co-organizers cannot change status or manage other co-organizers
- Critical field changes on PUBLISHED groups auto-revert to PENDING_REVIEW
- Cannot modify questions after applications exist

### Deletion

- Only owner or admin can delete
- Cascade deletes: applications, questions, answers, favorites, reviews, co-organizers

### Moderation

- Only PENDING_REVIEW groups can be published or rejected
- Rejection requires a reason
- Publishing notifies the organizer
- Rejection notifies the organizer with reason

## Application Rules

### Creation

- Group must be PUBLISHED
- Duplicate check: same email + same group = conflict
- Authenticated users: also checked by userId + groupId
- Required questions must be answered
- Choice answers must match defined options
- Multiple choice: comma-separated, each validated against options

### Status Changes

- APPROVED/REJECTED: only group owner or admin
- WITHDRAWN: only applicant (by userId or email match), only from PENDING
- Approval checks capacity: if approved >= capacity → conflict
- Auto-transition: approved count reaches capacity → group goes FULL

### Re-Application

- After withdrawal, same email cannot re-apply (unique index `[groupId, email]`)
- This is by design — prevents duplicate applications

## Organizer Rules

### Profile

- One profile per user (1:1 relation)
- Slug must be unique
- VERIFIED status required to create groups
- `firstName` / `lastName` require at least 2 characters in both registration and profile edit
- Profiles created before migration `20261002120000` have empty `professionalOrganization` and `professionalOrganizationStatus` (DB default `''`)
  - The public organizer page hides the professional-organization block until at least one of the two is filled
  - Both fields stay required by the profile validator, so a legacy organizer fills them on the next profile save
- `education` is a partial-update field on `PATCH /api/organizers/me`: omitted → stored array untouched, `[]` → cleared, non-empty array → replaced

### Verification

- Profile starts UNVERIFIED
- Submit for review → PENDING
- Admin moderates → VERIFIED or REJECTED
- Rejection requires reason
- Re-submission after rejection allowed

### Avatar Upload

- Magic bytes validation (JPEG, PNG, WebP)
- Rate-limited (10/hour)
- Size-limited

### Deactivation

- Admin can toggle `isActive` on User
- Inactive organizer's groups hidden from catalog (`activeOrganizerFilter`)

## Notification Rules

### Types

| Event | Recipient | Channel |
|-------|-----------|---------|
| APPLICATION_RECEIVED | Organizer | In-app |
| APPLICATION_APPROVED | Applicant | Email + in-app |
| APPLICATION_REJECTED | Applicant | Email + in-app |
| APPLICATION_WITHDRAWN | Organizer | In-app |
| GROUP_APPROVED | Organizer | In-app |
| GROUP_REJECTED | Organizer | In-app |
| GROUP_PENDING_REVIEW | All admins | In-app |
| ORGANIZER_PENDING_REVIEW | All admins | In-app |
| ORGANIZER_APPROVED | Organizer | In-app |
| ORGANIZER_REJECTED | Organizer | In-app |

### Locale

- Notifications use recipient's `preferredLocale` (ua or en)
- Server i18n: `server/i18n/notifications/{ua,en}.ts`

## Data Integrity (Database Level)

| Rule | Enforcement |
|------|-------------|
| Unique email per application per group | `@@unique([groupId, email])` |
| Unique review per user per group | `@@unique([userId, groupId])` |
| Unique co-organizer per group | `@@unique([groupId, userId])` |
| Valid locale | CHECK: `preferredLocale IN ('ua', 'en')` |
| Non-negative price | CHECK: `priceAmount IS NULL OR priceAmount >= 0` |
| Valid date range | CHECK: `endsAt IS NULL OR startsAt IS NULL OR endsAt > startsAt` |
| Positive capacity | CHECK: `capacity IS NULL OR capacity > 0` |
| Valid rating | CHECK: `rating BETWEEN 1 AND 5` |

## Security Rules

- Application data is sensitive — never log full payloads
- Never include application answers in emails
- Server derives ownership from session, never trusts client IDs
- All admin operations require ADMIN role server-side
- Rate limiting on auth, registration, applications, uploads
- CSP headers on all responses
- Error sanitization: only trusted codes reach the client
