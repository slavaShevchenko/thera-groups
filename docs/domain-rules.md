# Domain Rules

All business rules enforced in code, extracted from services, repositories, and database constraints.

## Group Rules

### Status Transitions

```
DRAFT → PENDING_REVIEW
PENDING_REVIEW → PUBLISHED (admin only) | REJECTED (admin only)
REJECTED → PENDING_REVIEW
PUBLISHED → PENDING_REVIEW | FULL | COMPLETED | CANCELLED
FULL → PUBLISHED | COMPLETED | CANCELLED
CANCELLED → PENDING_REVIEW (admin only)
COMPLETED → (terminal)
```

`FULL` is never a decision anyone makes: `applicationService.updateStatus` writes it when
approving the last seat, and writes `PUBLISHED` back when a rejection or a capacity raise
frees one. Every other arrow goes through `validateStatusTransition`
(`server/services/groupService.ts`), which is the single source of truth this block
mirrors — change it there first.

Reaching `COMPLETED` or `CANCELLED` emails the owner and every **approved** applicant
(`notifyGroupCompleted` / `notifyGroupCancelled` in `server/utils/notifications.ts`,
templates `group_completed` / `group_cancelled`). That fan-out runs after the write
commits, so a failed email never rolls back the transition. Pending applicants are not
told — they never held a seat — and rejected ones already had their own decision letter.

`CANCELLED → PENDING_REVIEW` exists so an admin can reinstate a group cancelled by
mistake. An organizer cannot reopen one: the transition out of `PENDING_REVIEW` is theirs,
the transition out of `CANCELLED` is moderation's.

### Visibility vs. accepting applications

Two separate questions, and they answer differently:

| Status | In the catalog / by slug | Takes applications |
|--------|--------------------------|--------------------|
| PUBLISHED, FULL, COMPLETED | yes | only PUBLISHED |
| DRAFT, PENDING_REVIEW, REJECTED, CANCELLED | no | no |

`PUBLIC_GROUP_STATUSES` and `isPublicGroupStatus()` live in
`shared/constants/groupStatus.ts`; `groupAcceptsApplications()`, `isPastGroup()` and
`isClosedGroupStatus()` in `shared/utils/groupVisibility.ts`. Both are under `shared/`, so
the catalog query, the detail lookup, the sitemap and the UI badges read one definition.
The catalog lists a group by status alone — it does **not** filter on `startsAt`, because
the detail lookup never did, and the two disagreeing left every indexed URL for a started
group pointing at a page the catalog had dropped. A group that has started stays listed,
behind the upcoming ones.

A row that still says `PUBLISHED` after its `endsAt` has passed is closed for
applications (`GROUP_ENDED`) while remaining listed. Nothing moves a row to `COMPLETED`
on a schedule, so the date is the only thing that closes it — closing it by status would
have to happen in a cron nobody runs.

Refusals are distinct so the applicant sees why: `GROUP_FULL` (409), `GROUP_ENDED` (409),
`NOT_FOUND` (404) for a status that is not listed at all — a cancelled group does not
advertise that it exists.

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

- Only owner or admin can delete — a co-organizer may edit but not destroy
- Only DRAFT and REJECTED groups can be deleted (`ForbiddenError` otherwise). A PUBLISHED
  group is cancelled instead, so the page people bookmarked stops resolving rather than
  vanishing without a trace; FULL and COMPLETED are the record of a real event
- Refused with `HAS_APPLICATIONS` (409) while any application is still PENDING or
  APPROVED (`applicationRepository.countLiveApplications`). `Application.groupId`
  cascades, so without this guard deleting a group took every application, answer and
  question with it and told nobody
- WITHDRAWN and REJECTED applications do not block deletion — nobody is waiting on them
- Cascade deletes: applications, questions, answers, favorites, reviews, co-organizers

### Moderation

- Only PENDING_REVIEW groups can be published or rejected
- Rejection requires a reason
- Publishing notifies the organizer
- Rejection notifies the organizer with reason
- An admin may also end a group from moderation (`COMPLETED` / `CANCELLED`), which runs
  the same transition check and the same notification fan-out as an owner ending it

## Application Rules

### Creation

- Group must be PUBLISHED and not past its `endsAt` (`groupAcceptsApplications`)
- Refusals carry distinct codes so the applicant learns why: `GROUP_FULL` (409),
  `GROUP_ENDED` (409, also for a PUBLISHED row whose `endsAt` has passed),
  `NOT_FOUND` (404, any status that is not publicly listed — a cancelled group does not
  admit it exists). FULL is checked before the dates, so a full group that also ended
  reports the more actionable reason
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
- Approval checks capacity: if approved >= capacity → `GROUP_FULL` (409), and the
  application row is left untouched
- Auto-transition, both directions, written by `applicationService.updateStatus` inside
  the same transaction as the application:
  - approved count reaches capacity → group goes FULL
  - rejecting an approved applicant frees a seat while FULL → group goes back to PUBLISHED
    (a withdrawal cannot: only a PENDING application may withdraw, and that holds no seat)
  - raising `maxParticipants` above the approved count does the same, in
    `groupService.updateGroup`
  - Without the way back, FULL was a one-way door: the capacity check refuses the very
    approval that would have triggered a recount
- The PATCH response returns the post-transaction seat tally
  (`applicationRepository.findGroupSeats`) alongside the application, so the managing
  page re-renders capacity/approved/remaining from the state the write actually left
  rather than from what the client assumed

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
