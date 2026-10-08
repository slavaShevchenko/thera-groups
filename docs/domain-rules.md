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

Retired slugs are not redirected: `foundation`, `advanced`, `professional`,
`partnership` and `international` answer with the same 404 that
`app/pages/[locale]/catalog/[type].vue` throws for any unknown slug. A 301 map
existed while pre-consolidation URLs might still have been indexed or bookmarked;
it was removed before the first deploy, when no such URL had ever been published.

The enum itself was rebuilt by `20261002180000_drop_legacy_group_types`, after
`20261002170000_migrate_group_type_data` moved the rows — PostgreSQL has no
`ALTER TYPE ... DROP VALUE`, so the type is renamed, recreated and the column
re-cast. Both stay part of the history that `prisma migrate deploy` replays.

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
  - The email match is permanent, not a migration shim: `Application.userId` is
    nullable and `apply.post.ts` reads auth optionally, so a guest application
    stores `userId = NULL` on a clean database too. Matching on email is what lets
    someone who applied as a guest and registered afterwards still see and withdraw
    that application — `applicationRepository.findMyApplications` and
    `applicationService.withdraw` both rely on it.
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
- `professionalOrganization` and `professionalOrganizationStatus` are empty (DB default `''`) until the organizer saves their profile: `registerSchema` collects only `firstName`, `lastName`, `bio` and `qualification`
  - The public organizer page hides the professional-organization block until at least one of the two is filled — the same convention as the `education`, city and social blocks beside it
  - `updateOrganizerProfileSchema` requires both, so the first profile save fills them
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
| APPLICATION_RECEIVED | Organizer | Email + in-app |
| APPLICATION_SUBMITTED | Applicant | Email, plus in-app when the address has an account |
| APPLICATION_APPROVED | Applicant | Email, plus in-app when the address has an account |
| APPLICATION_REJECTED | Applicant | Email, plus in-app when the address has an account |
| APPLICATION_WITHDRAWN | Organizer | Email + in-app |
| GROUP_APPROVED | Group owner | Email + in-app |
| GROUP_REJECTED | Group owner | Email + in-app |
| GROUP_PENDING_REVIEW | All admins | Email + in-app |
| GROUP_SUBMITTED | Group owner | Email + in-app |
| GROUP_AUTO_REVERT | Group owner | Email + in-app |
| GROUP_STARTING | — | None: no scheduler produces it yet |
| ORGANIZER_PENDING_REVIEW | All admins | Email + in-app |
| ORGANIZER_APPROVED | Organizer | Email + in-app |
| ORGANIZER_REJECTED | Organizer | Email + in-app |
| ORGANIZER_WELCOME | Organizer | Email + in-app |

`GROUP_SUBMITTED` and `GROUP_AUTO_REVERT` are mutually exclusive for one update: an edit that
pulled a PUBLISHED group back into moderation reports the revert (naming the fields whose value
really changed), a deliberate submission reports the submission. Either way the admins get their
own `GROUP_PENDING_REVIEW` message — two audiences, two letters, one transition.

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
