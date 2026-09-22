# Business Logic

## Group Lifecycle

```
DRAFT ──→ PENDING_REVIEW ──→ PUBLISHED ──→ FULL ──→ COMPLETED
              ↓                    ↓
           REJECTED            CANCELLED
              ↓
         PENDING_REVIEW (re-submit)
```

### Valid Status Transitions

| From | Allowed Targets |
|------|----------------|
| DRAFT | PENDING_REVIEW |
| PENDING_REVIEW | PUBLISHED, REJECTED |
| REJECTED | PENDING_REVIEW |
| PUBLISHED | PENDING_REVIEW, FULL, CANCELLED |
| FULL | PUBLISHED, COMPLETED |
| CANCELLED | _(terminal)_ |
| COMPLETED | _(terminal)_ |

### Who Can Transition

- **PENDING_REVIEW** (submit for review): Owner, co-organizer, or admin
- **PUBLISHED** (approve): Admin only
- **REJECTED** (reject): Admin only (requires rejection reason)
- **FULL** (capacity reached): System (automatic on application approval)
- **CANCELLED/COMPLETED**: Admin or owner

### Critical Field Changes

When a PUBLISHED group has critical fields changed (title, description, type, format, location, price, dates, capacity), the status automatically reverts to PENDING_REVIEW for re-moderation.

## Application Flow

```
Create (PENDING) ──→ APPROVED
                 ──→ REJECTED
                 ──→ WITHDRAWN (by applicant, only from PENDING)
```

### Creation Rules

1. Group must be PUBLISHED with an organizer
2. Duplicate prevention: unique `[groupId, email]` constraint
3. If user is authenticated, also checks `groupId + userId`
4. Required questions must be answered
5. Choice question answers must match defined options
6. Cannot re-apply after withdrawal (unique index prevents same email)

### Approval Rules

1. Only group owner or admin can approve/reject
2. If group has capacity, checks approved count < capacity
3. When approved count reaches capacity → group auto-transitions to FULL
4. Applicant receives email notification + in-app notification

### Withdrawal Rules

1. Only the applicant (by userId or email match) can withdraw
2. Only PENDING applications can be withdrawn
3. Withdrawal notifies the group organizer

## Capacity Management

- Groups have optional `capacity` (integer, CHECK: > 0)
- When approving an application, system counts existing APPROVED applications
- If `approvedCount >= capacity` → ConflictError "Group is full"
- After approval, if `newApprovedCount >= capacity` and group is PUBLISHED → auto-transition to FULL
- When group goes FULL, it can return to PUBLISHED if capacity changes or applications are withdrawn

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
- Co-organizers can edit groups but cannot change status or manage other co-organizers
- Admins can transfer ownership by changing organizerId
- Co-organizers are excluded from being the main organizer
