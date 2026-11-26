# Domain Rules

All business rules enforced in code, extracted from services, repositories, and database constraints.

## Group Rules

### Status Transitions

```
DRAFT → PENDING_REVIEW | PUBLISHED (admin only)
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

`DRAFT → PUBLISHED` is admin-only and lives in a separate `ADMIN_ONLY_TRANSITIONS` table,
not in `VALID_STATUS_TRANSITIONS`, because that table is role-blind and mirrors the block
above one-for-one. It is the admin's own create-and-publish path: `/groups/new` writes a
DRAFT and the admin edit page's single button publishes it, so without the arrow publishing
took two requests — `PENDING_REVIEW`, then `moderateGroup` — and notified every admin about
a moderation the same admin was about to close. Moderation gates organizers, and an admin
*is* the moderator; `group.publish` is ADMIN-only already, so the arrow widens nobody else's
reach. It publishes silently, too — no `notifyGroupSubmitted`, because there is no moderator
left to inform.

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
`shared/constants/groupStatus.ts`; `groupAcceptsApplications()`, `isPastGroup()`,
`isOngoingGroup()`, `isClosedGroupStatus()` and `compareGroupsForListing()` in
`shared/utils/groupVisibility.ts`. Both are under `shared/`, so the catalog query, the
detail lookup, the sitemap and the UI badges read one definition.
The catalog lists a group by status alone — it does **not** filter on dates, because the
detail lookup never did, and the two disagreeing left every indexed URL for a started
group pointing at a page the catalog had dropped. Dates decide the *order*, in three
tiers: what is running now first (most recently started first), then what has not begun
(soonest first), then the archive (most recent first).

**One rule decides "ended"**: a `COMPLETED` row, or a past `endsAt` — `isPastGroup()`. The
apply gate, its client mirror `groupAcceptsApplications()`, the card and page badges, the
catalog's three ordering tiers (`endedWhere` / `ongoingWhere` / `upcomingWhere` in
`groupRepository`) and the order of an organizer's public groups
(`compareGroupsForListing`) all read it.

A **start date is never a reason to close a group.** No `endsAt` means open-ended: a weekly
therapy or intervision group has no last meeting to name, and it keeps taking applications
however long ago it began, until a person closes it — an end date, `COMPLETED` or
`CANCELLED`. This was settled the other way once, as `endsAt ?? startsAt`, so that the gate
and the badges could not disagree; it made them agree on the wrong answer, and the first
real organizer's open-ended intervision group was refused applicants from the day it
started while its own page announced the event had already happened.

The tiers exist because open-ended groups break a two-way split. Sorted with the upcoming
events, a group that began a year ago outranks every one of them forever, since nothing
beats an older `startsAt`; filed into the archive, it is hidden from the people who could
still join it. `COMPLETED` is archived by decision rather than by date for the same reason
in reverse — an organizer who closes a group early leaves an `endsAt` still in the future,
and `findLatest` names the status out so the home page stops inviting visitors to it.

They did not used to read one rule: the gate looked at `endsAt` alone, so a group that had
started with no end date kept taking applications while its own page called it a past
event, and the catalog split on `startsAt`, which filed a group running right now into the
archive below events that had not begun.

A row that still says `PUBLISHED` after its event has finished is closed for applications
(`GROUP_ENDED`) while remaining listed. Nothing moves a row to `COMPLETED` on a schedule,
so the end date is the only thing that closes a row by itself — closing it by status would
have to happen in a cron nobody runs. **Reviewed and kept, 2026-10-29; amended
2026-11-25**: `COMPLETED` is written by a person — the owner's "Mark as completed", or an
admin's — and every read that cares whether the event is over asks the date, treating
`COMPLETED` as a person's answer that overrides it in both directions: it archives a row
whose `endsAt` is still in the future, and it is what closes an open-ended group that has
no `endsAt` at all. The accepted cost is that the column lags: an event that ran a month
ago still reads `PUBLISHED` in the admin panel and still gets sitemap priority 0.8 — and
with no `endsAt` on it, it keeps taking applications until somebody closes it, which is the
behaviour an organizer asked for rather than an oversight.

Refusals are distinct so the applicant sees why: `GROUP_FULL` (409), `GROUP_ENDED` (409),
`NOT_FOUND` (404) for a status that is not listed at all — a cancelled group does not
advertise that it exists.

### Group Types

`GroupType` holds 17 values (consolidated 2026-10 from 19). The single source of
truth for value ↔ slug pairs is `shared/constants/groupTypes.ts` (`GROUP_TYPES`);
the localized labels live under `groupTypes.<VALUE>` in `app/locales/{ua,en}.json`
and the per-slug SEO copy under `typePages.<slug>` and `seo.typePages.<slug>`.
Adding or removing a type means touching all four plus `database/schema.prisma`.

All 17 are published whether or not any group of that type exists yet. A category page
answers 200 with its own per-locale title and description, so it is a landing page meant to
rank before the inventory arrives — `sitemap.xml.ts` therefore maps `GROUP_TYPES` directly
rather than deriving the list from the groups in the database. Deriving it was the original
behaviour and it listed one category out of seventeen in production, hiding every page for
exactly as long as it mattered. The same list feeds `CatalogCategoryLinks`, rendered on
`/catalog` and on every `/catalog/<slug>`: the type picker in `GroupFilters` is a `<select>`
that navigates through `router.push`, so without those anchors no crawlable link to a
category exists anywhere and the sitemap is the only way in. A new type is picked up by both
from `GROUP_TYPES` alone — there is no fifth place to touch.

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
- `title` is required at creation. It is the one input the slug is cut from, and the slug can
  never be fixed afterwards, so a group born nameless is a group permanently stuck on a
  meaningless URL
- Slug must be unique: `slugify(title)` plus a random suffix that is always appended, capped
  at `GROUP_LIMITS.SLUG_MAX` and cut on a word boundary. Always-suffixed because uniqueness
  must not depend on the title being unique — two organizers may both run a «Група підтримки
  для батьків»
- Slug is set once at creation and never renamed: the URL is indexed, sitemapped and
  hreflang-linked, and is copied into `Notification.entityId`

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

- Only PENDING_REVIEW groups can be published or rejected *through this endpoint*. An
  admin publishing a group they created themselves goes through `PATCH /api/groups/[slug]`
  and takes the admin-only `DRAFT → PUBLISHED` arrow instead — see Status Transitions
- Rejection requires a reason
- Publishing notifies the organizer
- Rejection notifies the organizer with reason
- An admin may also end a group from moderation (`COMPLETED` / `CANCELLED`), which runs
  the same transition check and the same notification fan-out as an owner ending it. The
  panel reads statuses in *views* — active (`PUBLISHED` + `FULL`), completed, cancelled —
  because `GET /api/admin/groups?status=` takes a comma-separated list; querying
  `PUBLISHED` alone left a group that had filled up reachable through no admin screen

### Event structured data

Every group page carries an `Event` node (`buildGroupEventJsonLd` in `app/utils/jsonLd.ts`).
Google rewrote the Event spec on **2025-06-05**, and the rewrite decides three things here:

- `location` must be a `Place` whose `address` is a **required** `PostalAddress`.
  `VirtualLocation`, `eventAttendanceMode` and `location.url` are gone from the doc, and the
  content guidelines now read: *"Virtual experiences that have no real-world component aren't
  supported. Events must take place in a physical location."*
- **An ONLINE group therefore cannot earn the event rich result, whatever we emit.** The
  `Place` named `Online` stays anyway — it is valid schema.org and Bing and AI crawlers still
  read it — and the `Missing required property address` it draws from Search Console and from
  Ahrefs is a **won't-fix, not a defect**. Filling the field would mean inventing an address:
  false structured data under Google's spam policy, and a map pin for a venue that does not
  exist. Reverting to `VirtualLocation` is not an escape either; that is what produced
  `Expected type for location: Place` before commit `9fd3efc`.
- **OFFLINE and HYBRID wrap the address in an object**, `{"@type":"PostalAddress",
  "streetAddress":<the line>}`. A bare string is schema.org `Text` and technically valid, but
  Google's parser reports the field as missing anyway. The line is not split into locality,
  postal code and region because `group.location` is free text and splitting it means guessing.
- **A HYBRID event is marked up at its physical venue only.** An array leading with the
  addressless online Place fails the `address` requirement for the whole page, and
  `MixedEventAttendanceMode` already says the event also happens online.
- An OFFLINE group whose organizer left `location` empty gets **no** `location` rather than an
  invented one. The durable fix is upstream, not in the markup: `location` is optional in
  `server/validators/group.ts` with no refinement tying it to `format`, so an offline event
  without a venue is still savable.

## Application Rules

### Creation

- Group must be PUBLISHED and not ended — `isPastGroup()`, i.e. a `COMPLETED` row or a past
  `endsAt`. A start date refuses nobody: no `endsAt` means the group is open-ended and still
  joinable (`groupAcceptsApplications` mirrors it client-side)
- Refusals carry distinct codes so the applicant learns why: `GROUP_FULL` (409),
  `GROUP_ENDED` (409, also for a PUBLISHED row whose event has finished),
  `NOT_FOUND` (404, any status that is not publicly listed — a cancelled group does not
  admit it exists). FULL is checked before the dates, so a full group that also ended
  reports the more actionable reason
- Duplicate check: same email + same group = conflict
- Authenticated users: also checked by userId + groupId
- Required questions must be answered
- Choice answers must match defined options
- Multiple choice: comma-separated, each validated against options

### Status Changes

- APPROVED/REJECTED: group owner, co-organizer, or admin (`application.manage`). Reading a
  group's queue and acting on it are the same audience — `application.viewForGroup` has
  always admitted co-organizers, so the two keys must agree or the queue renders buttons
  the server refuses.
- WITHDRAWN: only applicant (by userId or email match), only from PENDING
  - The email match is permanent, not a migration shim: `Application.userId` is
    nullable and `apply.post.ts` reads auth optionally, so a guest application
    stores `userId = NULL` on a clean database too. Matching on email is what lets
    someone who applied as a guest and registered afterwards still see and withdraw
    that application — `applicationRepository.findMyApplications` and
    `applicationService.withdraw` both rely on it.
- REJECTED → PENDING (revert): same audience as approve/reject, and the only decision that
  may be undone. Reverting an APPROVED row throws `ConflictError` — an approval holds a
  seat, so reversing it goes through REJECTED, which is the transition that frees the seat
  and can reopen a FULL group
  - A revert moves nothing itself: `countApproved` counts APPROVED rows only, and neither
    REJECTED nor PENDING is one, so the group keeps whatever status it had
  - A revert notifies nobody. No `NotificationType` or email template describes an undone
    rejection, and re-using the rejection letter would tell the applicant the opposite of
    what happened — they hear from us when a real decision lands
- REJECTED requires a reason: `updateStatus` throws `ValidationError` without one, so the
  PATCH answers 400 `VALIDATION_FAILED`. The rule `organizerService.moderateProfile`
  already applies to a profile rejection — "no" without a why leaves the applicant with
  nothing to fix
  - It is stored on `Application.rejectionReason`, rendered in the organizer's queue beside
    the row, and quoted in the applicant's email and in-app notification
  - Any other decision clears it, so a row never explains a decision no longer in force
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
- Every `VERIFICATION_REQUIRED_FIELDS` entry (`qualification`, `professionalOrganization`,
  `professionalOrganizationStatus`) is required at **creation**, on both paths —
  `registerSchema.organizerData` and `createOrganizerProfileSchema` — through one shared
  `requiredText()` builder, so the two cannot drift. A profile created without them lands in
  the moderation queue as an entry no admin can approve, while its owner has been told it is
  "under review"
  - `bio` is also required at creation on both paths: the profile edit form enforces it on
    save, so a profile created without one would leave the organizer stuck at the edit form
    without a way to complete it without backtracking
  - The same floor (`PROFILE_LIMITS.REQUIRED_TEXT_MIN`, 2 characters) applies to
    `firstName` / `lastName` on both paths and on the edit form, and the client mirrors it
    from the same constant
  - `updateOrganizerProfileSchema` deliberately keeps them **optional**: an empty string
    clears, an omitted key leaves the stored value alone. A required field on a PATCH means
    the client must resend the whole profile on every write, and a stale tab then overwrites
    a newer one. Completeness is enforced where it means something instead — at
    `organizerService.moderateProfile`, which refuses to verify a profile missing any of them
  - Rows created before the fields were collected (including profiles opened by the removed
    Google sign-up) can still be empty, so the public organizer page keeps hiding the
    professional-organization block until at least one of the two is filled — the same
    convention as the `education`, city and social blocks beside it
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
| GROUP_COMPLETED | Group owner + every approved applicant | Email + in-app (applicant in-app only when the address has an account) |
| GROUP_CANCELLED | Group owner + every approved applicant | Email + in-app (applicant in-app only when the address has an account) |
| GROUP_STARTING | — | None: no scheduler produces it yet |
| ORGANIZER_PENDING_REVIEW | All admins | Email + in-app |
| ORGANIZER_APPROVED | Organizer | Email + in-app |
| ORGANIZER_REJECTED | Organizer | Email + in-app |
| ORGANIZER_WELCOME | Organizer | Email + in-app |

`GROUP_SUBMITTED` and `GROUP_AUTO_REVERT` are mutually exclusive for one update: an edit that
pulled a PUBLISHED group back into moderation reports the revert (naming the fields whose value
really changed), a deliberate submission reports the submission. Either way the admins get their
own `GROUP_PENDING_REVIEW` message — two audiences, two letters, one transition.

### In-app targets

`notificationRoute()` (`shared/utils/notificationRoutes.ts`) turns a row into the path the bell
opens. Two conventions it cannot guess from the row:

- `entityId` for a group is the **slug**, never the cuid — every group notification is written
  that way, because the route builds `/{locale}/groups/{slug}` and a public URL keyed on the
  internal id resolves to nothing. Services pass the slug down; no call site looks the id up.
- `ORGANIZER_REJECTED` points at `/{locale}/profile/edit`, not the public organizer page.
  `organizers/[slug].get` answers 404 for any `verificationStatus` but VERIFIED (admins excepted),
  so the generic `organizerProfile` route sent the owner to a 404 from the one notification that
  asks them to fix something. The editor is where the reason is shown and where resubmitting
  resets the profile to PENDING; the `organizer_rejected` email button already points there.

### Locale

- Notifications use recipient's `preferredLocale` (ua or en)
- Server i18n: `server/i18n/notifications/{ua,en}.ts`

## Article Rules

Mechanics live in [`business-logic.md`](./business-logic.md#article-lifecycle); what follows is
the reasoning behind the three decisions that are easy to undo by accident.

### Why `DRAFT ⇄ PUBLISHED` has no third state

A group needs REJECTED, CANCELLED and COMPLETED because other people are waiting on it —
applicants, co-organizers, a moderation queue. An article has no applicants and no seats, so
there is nobody to notify and nothing to retract. Deleting is the honest terminal action;
inventing a `CANCELLED` state would give admins a row that renders nowhere and still 404s.

### Why publishing demands both locales

Not a data-entry preference — an hreflang obligation. `useLocaleHead()` advertises a `ua` and
an `en` alternate for every article, and `sitemap.xml` emits a `<url>` pair. Google requires
an advertised alternate not to redirect or 404, and **one hole invalidates the set for every
page in it**. So a single half-finished translation is not a small gap on one URL; it is
broken markup across the whole archive. The gate therefore re-runs on every update whose
effective status is PUBLISHED, not just on the way in — emptying the English title of a live
article has to be refused too.

The corollary worth remembering before adding a third language: the gate is
`incompleteLocales()` over `ARTICLE_LOCALES`, and the hreflang set, the sitemap pair and this
list all have to grow together or the site starts advertising pages it does not serve.

### Why the body is markdown source and never HTML

Storing rendered HTML would put a sanitizer on the critical path of the one input on this site
that is both free-form and rendered to anonymous visitors. Storing the source and parsing it
server-side into a closed set of typed nodes removes the step instead of implementing it: no
HTML string ever exists, so there is nothing to sanitize, and `marked` never reaches the client
bundle. The trade is that raw HTML blocks and tables are dropped — documented in the admin
form, and the reason the renderer is a `switch` over known node types rather than a passthrough.

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
| Unique article slug | `@unique` on `Article.slug` |
| One translation per article per locale | `@@unique([articleId, locale])` |
| A published article has a publication day | CHECK: `status <> 'PUBLISHED' OR publishedAt IS NOT NULL` |
| The byline has one source | CHECK: `authorId IS NULL OR authorName IS NULL` |
| Valid article locale | CHECK: `ArticleTranslation.locale IN ('ua', 'en')` |
| Both locales complete before publishing | Service only — `assertPublishable()`. Not expressible as a row-level CHECK, because it is a rule about a *set* of rows |

## Security Rules

- Application data is sensitive — never log full payloads
- Never include application answers in emails
- Server derives ownership from session, never trusts client IDs
- All admin operations require ADMIN role server-side
- Rate limiting on auth, registration, applications, uploads
- CSP headers on all responses
- Error sanitization: only trusted codes reach the client
