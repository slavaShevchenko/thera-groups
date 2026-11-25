# API Endpoints

All endpoints live under `server/api/`. Handlers are thin — they validate input, check auth/permissions, delegate to services, and return responses.

## Auth (`/api/auth/`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | No | Register new user (rate-limited: 3/hour). The only path that creates an account, and — with `role=ORGANIZER` — the only one that opens a PENDING organizer profile, for which it collects every `VERIFICATION_REQUIRED_FIELDS` entry |
| POST | `/api/auth/login` | No | Login with email/password (rate-limited: 5/15min) |
| POST | `/api/auth/logout` | Yes | Invalidate session |
| GET | `/api/auth/me` | No | Get current user (returns null if not authenticated) |
| GET | `/api/auth/google-start` | No | Initiate Google OAuth flow. `?locale=ua\|en` (default `ua`) picks the callback URL |
| POST | `/api/auth/google` | No | Complete Google OAuth with token. Sign-in only — `404 NOT_FOUND` for an identity with no local account, which registration creates |

## Groups (`/api/groups/`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/groups` | No | List publicly visible groups (PUBLISHED, FULL, COMPLETED) with filters (q, type, format, dateFrom, languages). Ordered in three tiers: groups running now first (most recently started first), then events that have not begun (soonest first), then the archive (most recent first). "Ended" means a `COMPLETED` row or a past `endsAt`, so a group with no end date is open-ended and stays in the running-now tier rather than the archive. `dateFrom` is a `YYYY-MM-DD` day read in the site zone (`Europe/Kyiv`), not as UTC midnight. `languages` is a comma-separated list of ISO 639-1 codes matched with OR — `?languages=uk,es` returns groups running in either — and an invalid code is a 400 |
| GET | `/api/groups/latest` | No | Latest groups that have not ended — running now or still to come, `COMPLETED` excluded (limit param) — the home-page discovery block |
| GET | `/api/groups/my` | ORGANIZER/ADMIN | List organizer's own groups + co-organized |
| POST | `/api/groups` | ORGANIZER (VERIFIED) | Create new group (DRAFT). An ADMIN must pass `organizerId` of a VERIFIED profile; anyone else creates on their own profile and a supplied `organizerId` is ignored |
| GET | `/api/groups/[slug]` | Permission: `group.view` | Get group by slug |
| PATCH | `/api/groups/[slug]` | Permission: `group.edit` | Update group |
| DELETE | `/api/groups/[slug]` | Permission: `group.delete` | Delete group |
| GET | `/api/groups/[slug]/edit` | Permission: `group.edit` | Get group data for edit form |
| GET | `/api/groups/[slug]/questions` | No | Get group application questions |
| POST | `/api/groups/[slug]/apply` | No | Submit application (rate-limited: 10/15min) |
| POST | `/api/groups/[slug]/favorite` | Yes | Toggle favorite (add) |
| DELETE | `/api/groups/[slug]/favorite` | Yes | Toggle favorite (remove) |
| GET | `/api/groups/[slug]/applications` | Permission: `application.viewForGroup` | List applications for group. Query `page`/`limit`/`status`/`orderBy`; returns `{ group, applications, statusCounts, total, page, pageSize, totalPages }`, where `statusCounts` is tallied over the whole group so the seat total does not move with the filter |
| PATCH | `/api/groups/[slug]/applications/[id]` | Permission: `application.manage` | Approve, reject or revert an application. Body `{ status, rejectionReason? }`: `REJECTED` without a `rejectionReason` → 400 `VALIDATION_FAILED`; `PENDING` reverts a REJECTED row (any other source → 409 `CONFLICT`). Returns `{ application, group }` with the post-write seat tally |

## Applications (`/api/applications/`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/applications/my` | Yes | Get current user's applications (by userId or email) |
| POST | `/api/applications/[id]/withdraw` | Yes | Withdraw own application (only PENDING) |

## Organizers (`/api/organizers/`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/organizers` | No | List verified organizers |
| GET | `/api/organizers/search` | No | Search organizers by name |
| GET | `/api/organizers/me` | ORGANIZER/ADMIN | Get own organizer profile |
| PATCH | `/api/organizers/me` | ORGANIZER/ADMIN | Update own profile |
| POST | `/api/organizers/me` | Yes | Create own organizer profile as PENDING and promote a VISITOR to ORGANIZER. 409 `CONFLICT` if one already exists. Notifies every admin (`ORGANIZER_PENDING_REVIEW`); a failed notification is logged, not returned |
| POST | `/api/organizers/avatar` | ORGANIZER/ADMIN | Upload avatar (magic bytes validated, rate-limited) |
| GET | `/api/organizers/[slug]` | Permission: `organizer.profile.view` | Get organizer by slug |

## Articles (`/api/articles/`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/articles` | No | Paginated list of published articles in one locale. `?locale=ua\|en` (default `ua`) and `?page=N` (default 1). Page size is fixed at `ARTICLE_LIMITS.PAGE_SIZE` — a `limit` param is ignored, so one request cannot pull the table. Returns `{ articles, total, page, totalPages }`; `totalPages` is never 0, because the page renders "1 / N" for an empty archive too |
| GET | `/api/articles/latest` | No | The newest published headlines in one locale — `ARTICLE_LIMITS.HOME_TEASER_COUNT` of them, for the home page's discovery block. `?locale=ua\|en` (default `ua`). Returns a bare array of `{ slug, title, publishedDate }`: no excerpt, no byline, no `total`, and the query selects no body, so the busiest page on the site does not parse six markdown documents to throw them away. A sibling of `/api/groups/latest` rather than a `limit` on the list above, whose fixed page size is deliberate |
| GET | `/api/articles/[slug]` | No | One published article in one locale. Returns the body as **parsed markdown nodes**, not as stored markdown and not as HTML — the client carries no parser and nothing on this path uses `v-html`. 404 `NOT_FOUND` alike for a slug that never existed, one still in DRAFT, and one with no translation in this language: telling them apart would advertise which unpublished slugs exist |

All three are anonymous by design — a published reading surface, not an account feature — so
none of them calls `getUser()`. A draft is unreachable through them: the service filters on
`status = PUBLISHED` and on the existence of a translation in the requested locale, so the
list can never link to a page that 404s.

`latest` is a static segment, so Nitro routes `/api/articles/latest` to its own handler and
not to `[slug]` — the same trade-off `/api/groups/latest` makes, and the reason an article
cannot be published under the slug `latest`.

`locale` is a query parameter rather than something read off the request, because the
authority for it is the URL path the visitor is on (`/en/articles`) and the API path carries
no locale segment. The cookie is not a substitute: a first-time visitor of `/en/*` has none,
and falling back to `ua` there would serve Ukrainian copy on an English page.

## Favorites (`/api/favorites/`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/favorites/my` | Yes | Get user's favorite groups |

## Notifications (`/api/notifications/`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/notifications/my` | Yes | Get user's notifications |
| GET | `/api/notifications/unread-count` | Yes | Get unread notification count |
| PATCH | `/api/notifications/[id]/read` | Yes | Mark notification as read |
| PATCH | `/api/notifications/read-all` | Yes | Mark all notifications as read |

## Admin (`/api/admin/`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/groups` | `admin.groups.view` | List all groups with pagination. `status` takes a comma-separated list (`PUBLISHED,FULL`), which is how the panel groups statuses into views |
| PATCH | `/api/admin/groups/[id]` | `admin.groups.moderate` | Moderate group (publish / reject / complete / cancel). Completing and cancelling run the same transition check and the same notification fan-out as the owner doing it |
| GET | `/api/admin/applications` | `admin.applications.view` | List all applications with filters |
| GET | `/api/admin/organizers` | `admin.organizers.view` | List all organizers |
| GET | `/api/admin/organizer-profiles/pending` | `admin.profiles.view` | Verification queue, oldest first. Query `page`/`limit`; returns `{ items, total, page, totalPages }` |
| PATCH | `/api/admin/organizer-profiles/[id]` | `admin.profiles.moderate` | Moderate profile (verify/reject) — the only verification route; it notifies and emails the organizer |
| PATCH | `/api/admin/organizers/[id]/toggle-active` | `admin.organizers.moderate` | Activate/deactivate organizer |
| GET | `/api/admin/users` | `admin.users.view` | List all users |
| GET | `/api/admin/articles` | `admin.articles.view` | List articles of every status, newest-edited first. Query `page`/`limit` (1–100, default 20)/`status`. Rows carry titles only — `locales` says which translations exist, which is how the list shows why a publish was refused without pulling either body off the database |
| GET | `/api/admin/articles/[slug]` | `admin.articles.view` | The edit form's load: markdown **source** in both locales, the byline, the date as a bare `YYYY-MM-DD`, and `linkedAuthorName` so the picker can show a selection it did not make this session. Deliberately not the public detail endpoint — an editor needs raw source and needs a draft to resolve |
| POST | `/api/admin/articles` | `admin.articles.moderate` | Create an article. An empty body is valid and produces a blank DRAFT, the way `POST /api/groups` does. `slug` is optional and, when given, must already match what `slugify()` produces; a taken explicit slug is 409 `CONFLICT` rather than silently suffixed, because it is an address the admin intends to keep. Returns `{ success, article: { slug, status } }` |
| PATCH | `/api/admin/articles/[slug]` | `admin.articles.moderate` | Update an article, its byline, its date and whichever locales the body carries. There is no `slug` field — a published URL is not renamed under the index. Returns the form shape rather than a success flag so the editor can resync from the server's view of the row. 400 `VALIDATION_FAILED` with `field: 'translations'` when the publish gate refuses |
| DELETE | `/api/admin/articles/[slug]` | `admin.articles.moderate` | Delete an article; translations go with it through `ON DELETE CASCADE`. No `HAS_APPLICATIONS`-style guard, and that is a difference from deleting a group rather than an oversight — nothing anybody else owns hangs off an article. Returns `{ slug }` |

## User (`/api/user/`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/user/profile` | Yes | Get current user profile |

## Webhooks (`/api/webhooks/`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/webhooks/resend` | Signature | Apply Resend delivery events to `EmailEvent` |

Verified with a Standard Webhooks signature (`svix-*` headers, `standardwebhooks` package)
against `RESEND_WEBHOOK_SECRET`. Without the secret the endpoint answers 401 in production
and accepts the payload unverified in dev, logging a warning.

Handled events: `email.delivered` → `DELIVERED`, `email.bounced` → `BOUNCED`,
`email.complained` → `COMPLAINED`. Matching is by `data.id` → `EmailEvent.providerId`.
Anything else — unknown event types, payloads that match no row — is acknowledged with
`{ success: true }` so Resend does not retry it forever. Not linked from the sitemap or
robots.txt. The global rate limiter (100 req/60s per IP) applies to it like to any other
`/api/*` route.

## Error Response Format

All errors follow a consistent structure:

```json
{
  "statusCode": 400,
  "statusMessage": "Human-readable message",
  "data": {
    "code": "VALIDATION_FAILED",
    "field": "email"
  }
}
```

Trusted error codes: `VALIDATION_FAILED`, `NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL`.

Unknown errors are sanitized to `{ code: 'INTERNAL' }` with 500 status.
