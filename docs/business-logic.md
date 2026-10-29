# Business Logic

## Group Lifecycle

```
DRAFT ──→ PENDING_REVIEW ──→ PUBLISHED ──→ FULL ──→ COMPLETED
              ↓                    ↓          ↓
           REJECTED            CANCELLED   CANCELLED
              ↓                    ↓
         PENDING_REVIEW      PENDING_REVIEW (admin only)
```

### Valid Status Transitions

| From | Allowed Targets |
|------|----------------|
| DRAFT | PENDING_REVIEW |
| PENDING_REVIEW | PUBLISHED, REJECTED |
| REJECTED | PENDING_REVIEW |
| PUBLISHED | PENDING_REVIEW, FULL, COMPLETED, CANCELLED |
| FULL | PUBLISHED, COMPLETED, CANCELLED |
| CANCELLED | PENDING_REVIEW _(admin only)_ |
| COMPLETED | _(terminal)_ |

`validateStatusTransition` in `server/services/groupService.ts` is the source of truth;
`docs/domain-rules.md` carries the reasoning behind each arrow.

### Who Can Transition

- **PENDING_REVIEW** (submit for review): Owner, co-organizer, or admin
- **PUBLISHED** (approve): Admin only
- **REJECTED** (reject): Admin only (requires rejection reason)
- **FULL** (capacity reached): System (automatic on application approval)
- **PUBLISHED** (seat freed): System (automatic on rejecting an approved applicant, or on a capacity raise)
- **CANCELLED/COMPLETED**: Admin or owner, always by hand — nothing schedules a
  completion, so a past event keeps its status until somebody ends it (see
  [domain-rules.md](./domain-rules.md#visibility-vs-accepting-applications) for what reads
  the dates instead). A co-organizer's `status` field is dropped
  before validation, not refused after — ending a group emails every approved applicant,
  and that is the owner's or an admin's call
- **CANCELLED → PENDING_REVIEW**: Admin only

### Critical Field Changes

When a PUBLISHED group has critical fields changed (title, description, type, format, location, price, dates, capacity), the status automatically reverts to PENDING_REVIEW for re-moderation.

The revert fires on `existing.status === 'PUBLISHED'` only. A FULL group is edited without
re-entering moderation — it is already visible, and pulling it back would take a real
event off the catalog over a title change. Reopening FULL is a separate rule: raising
`maxParticipants` above the approved count (or clearing it to `null`) writes PUBLISHED,
because the capacity was the only thing that closed it and no further approval can fire
the recount `applicationService` uses.

## Application Flow

```
Create (PENDING) ──→ APPROVED
                 ──→ REJECTED ──→ PENDING (organizer reverts a wrong rejection)
                 ──→ WITHDRAWN (by applicant, only from PENDING)
```

### Creation Rules

1. Group must be PUBLISHED with an organizer, and not ended — past `endsAt`, or past
   `startsAt` when there is no end date. `isPastGroup()` in `shared/utils/groupVisibility.ts`
   is the one rule the badges, the apply button and the catalog ordering all read
2. Refusals: `GROUP_FULL` (409), `GROUP_ENDED` (409), `NOT_FOUND` (404) for a status that
   is not publicly listed — DRAFT, PENDING_REVIEW, REJECTED and CANCELLED all answer 404,
   so a cancelled group does not admit it exists
3. Duplicate prevention: unique `[groupId, email]` constraint
4. If user is authenticated, also checks `groupId + userId`
5. Required questions must be answered
6. Choice question answers must match defined options
7. Cannot re-apply after withdrawal (unique index prevents same email)

### Approval Rules

1. Group owner, co-organizer or admin can approve/reject — `can('application.manage')`, the
   same audience that may read the queue
2. If group has capacity, checks approved count < capacity; over the limit throws
   `GROUP_FULL` and leaves the application untouched
3. When approved count reaches capacity → group auto-transitions to FULL
4. When a rejection frees a seat on a FULL group → group returns to PUBLISHED
5. Applicant receives email notification + in-app notification
6. The response carries the post-transaction seat tally (`{ application, group }`), so the
   managing page shows capacity/approved/remaining as the write left them

### Rejection Rules

1. A reason is mandatory: rejecting without one throws `ValidationError` → 400
   `VALIDATION_FAILED`. The rule `organizerService.moderateProfile` already applies to a
   profile rejection
2. Stored on `Application.rejectionReason`, shown in the organizer's queue beside the row,
   and quoted in both halves of the applicant's notification
3. Approving or reverting clears it, so a row never explains a decision no longer in force

### Reverting a Decision

1. `REJECTED → PENDING` only. Reverting an APPROVED application throws `ConflictError`
   (409 `CONFLICT`): an approval holds a seat, so undoing it goes through REJECTED, which
   is the transition that frees the seat and can reopen a FULL group
2. Moves no seat itself — `countApproved` counts APPROVED rows only, and neither REJECTED
   nor PENDING is one, so the group keeps whatever status it had
3. Notifies nobody. No `NotificationType` or email template describes an undone rejection,
   and re-using the rejection letter would tell the applicant the opposite of what
   happened; they hear from us when a real decision lands

### Withdrawal Rules

1. Only the applicant (by userId or email match) can withdraw
2. Only PENDING applications can be withdrawn
3. Withdrawal notifies the group organizer

## Capacity Management

- Groups have optional `capacity` (integer, CHECK: > 0); `null` means unlimited and the UI
  renders it as such rather than as zero remaining
- When approving an application, system counts existing APPROVED applications
- If `approvedCount >= capacity` → `GroupFullError` → 409 `GROUP_FULL`
- After approval, if `newApprovedCount >= capacity` and group is PUBLISHED → auto-transition to FULL
- FULL returns to PUBLISHED when a seat frees up: an approval is rejected, or the owner
  raises `maxParticipants` above the approved count. A withdrawal cannot reopen it —
  only a PENDING application may withdraw, and that never held a seat
- The managing page disables Approve at zero remaining seats and explains why, pointing at
  rejecting an approved application — the one action that actually reopens the group. It
  deliberately does not suggest raising capacity, since `maxParticipants` is a critical
  field and changing it on a PUBLISHED group sends it back to moderation

## Verification Flow

### Organizer Profile Verification

```
UNVERIFIED → PENDING (organizer submits) → VERIFIED / REJECTED (admin moderates)
```

- Only VERIFIED organizers can create groups (`group.create` permission)
- REJECTED profiles can re-submit (back to PENDING)
- Rejection requires a reason
- Admins receive ORGANIZER_PENDING_REVIEW notification

### Profile Moderation

- Admin verifies or rejects PENDING profiles
- Rejection requires a reason
- Organizer receives notification with locale-appropriate message

## Duplicate Prevention

### Applications

- Unique index: `[groupId, email]` — same email cannot apply twice to same group
- Additional check: `[groupId, userId]` for authenticated users
- Checked in service layer before insert, enforced by DB unique constraint
- P2002 Prisma error mapped to ConflictError

### Reviews

- Unique index: `[userId, groupId]` — one review per user per group

### Co-Organizers

- Unique index: `[groupId, userId]` — same user cannot be co-organizer twice

## Question Management

- Max 10 questions per group (`LIMITS.MAX_QUESTIONS_PER_GROUP`)
- Max 10 options per choice question (`LIMITS.MAX_OPTIONS_PER_QUESTION`)
- Max 60 chars for question text (`LIMITS.MAX_QUESTION_TEXT`)
- Cannot modify questions after applications have been submitted
- Choice questions require at least 2 options

## Co-Organizer Rules

- Owner can add co-organizers (must be active ORGANIZER users)
- Co-organizers can edit groups and moderate applications, but cannot change status,
  manage other co-organizers, or delete the group
- Admins can transfer ownership by changing organizerId
- Co-organizers are excluded from being the main organizer
