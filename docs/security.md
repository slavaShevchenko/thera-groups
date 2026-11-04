# Security

Cross-cutting security decisions and the reasoning behind them. Endpoint-level auth lives in
[permissions.md](./permissions.md); error shapes live in
[architecture.md](./architecture.md).

---

## 1. Client IP resolution and rate limiting

Rate limits are only as good as the identity they key on. Getting that identity from a
header a client controls means the limit is decorative: one extra header per request and it
never fires.

### `x-real-ip` is never read

`getClientIP()` in `server/utils/rateLimit.ts` does not look at `x-real-ip` at all. It is an
ordinary request header. Whatever the platform puts there, a client can put there first, and
the platform's value is then indistinguishable from the client's:

```bash
# Before: ten attempts, ten different buckets, zero 429s.
for i in $(seq 10); do
  curl -s -o /dev/null -w '%{http_code}\n' -H "X-Real-IP: 1.2.3.$i" \
    -X POST https://example.com/api/auth/login \
    -H 'content-type: application/json' \
    -d '{"email":"victim@example.com","password":"guess"}'
done
```

There is no configuration that makes an attacker-supplied `x-real-ip` safe to trust, so the
header is ignored rather than validated.

### `x-forwarded-for` is read positionally

Vercel **appends** the connecting client address to whatever `x-forwarded-for` the client
sent, so the right-most entry is the real client and everything to its left is
attacker-controlled. The same is true of any correctly configured reverse proxy chain.

Two modes, selected by `TRUSTED_PROXY_HOPS`:

| `TRUSTED_PROXY_HOPS` | Behaviour |
|---|---|
| unset (default) | Walk `x-forwarded-for` right to left and return the first entry that is not a reserved/infrastructure address (RFC1918, loopback, `0.0.0.0/8`, link-local, CGNAT `100.64/10`, IPv6 `::1`/ULA/link-local, and the IPv4-mapped forms of those). If every entry is reserved, the right-most one is used. |
| `0` | Return the right-most entry. This is what Vercel produces and the recommended explicit setting for it. |
| `N > 0` | Return the entry `N` positions from the right — the number of proxy hops your own infrastructure adds. |
| anything else | Treated as unset. A hop count larger than the header length is clamped rather than falling back to the left-most entry, which would be attacker-chosen. |

With no `x-forwarded-for` at all, h3's `getRequestIP()` (socket address) is used, and a
failure there yields the literal `'unknown'` — one shared bucket, which fails closed rather
than open.

The heuristic default exists so a deployment behind its own nginx (which typically appends
`127.0.0.1`) still limits the real client without configuration. Set `TRUSTED_PROXY_HOPS`
explicitly whenever you know your hop count; it removes the guesswork entirely.

### Two buckets per credential endpoint

`login` and `register` consume **both**:

- `ip:<address>` — stops one host spraying attempts across many accounts;
- `em:<sha256(normalizeEmail(address))[:32]>` via `useEmailRateLimiter()` — stops a
  distributed attacker grinding a single account, and stops a household or office NAT-ing
  several organizers behind one address from spending each other's budget.

The account key is hashed because `rate_limits` is a plain table that anyone with database
read access can query, and the whole point of the key is an address somebody typed into a
login form. Hashing is applied after `normalizeEmail()`, so `User@Example.com` and
`user@example.com` share one budget.

### A store failure fails open

A limiter store failure is logged through `logHandlerError()` and the request is let through.
Rate limiting must not be able to take the site down when `rate_limits` is unreachable.

The distinction is made on the shape of the rejection, not on the fact that one happened:
only a result carrying a finite, non-negative `msBeforeNext` counts as "bucket exhausted".
That check has to be exact — `typeof NaN === 'number'`, so a malformed result used to become
`Math.round(NaN / 1000) || 1`, a 429 with `Retry-After: 1` on every request the site
received. A driver failure carries no `msBeforeNext` at all, and neither shape can now
produce a 429 the limiter did not ask for.

A real 429 sets the `Retry-After` response header as well as `data.retryAfter` in the body:
the header is what a client that is not ours reads.

Rate limiting is disabled in dev (`import.meta.dev`) and the limits themselves are listed in
[AGENTS.md §6](../AGENTS.md).

---

## 2. Email address canonicalization

`User.email` is `@unique`, and Postgres compares it byte-for-byte. Supabase GoTrue folds
case. When the two disagree:

- `register` looked up `findUnique({ where: { email } })` with the address **as typed** while
  `findAuthUsersByEmail()` normalized **its** side. A stored `User@Test.com` therefore read
  as "no such user", the orphan-cleanup path concluded the `auth.users` record was debris
  from a failed sign-up, and **deleted a live account**. One request, somebody else's login.
- `Application` has `@@unique([groupId, email])`, so mixed case let one person apply twice
  to the same group.
- OAuth resolution by email missed rows whose case differed, producing a second account or a
  raw P2002.

`normalizeEmail()` in `server/utils/emailAddress.ts` is the single canonical form
(`trim().toLowerCase()`). It is applied at:

| Where | Why |
|---|---|
| `registerSchema.email`, `loginSchema.email` (`server/validators/auth.ts`) | Zod 4 runs `.trim().toLowerCase()` before `.email()`, so the check sees the stored form. `.email().transform(…)` does **not** work — the format check would run on the untrimmed input. |
| `applicationSchema.email` | The unique index is byte-for-byte. |
| `getUser()` (`server/utils/auth.ts`) | Every authenticated request. |
| `google.post.ts` before any lookup | Providers are not obliged to send lower-case. |
| `findAuthUsersByEmail()` (`server/utils/supabase.ts`) | Both sides of a comparison must agree. |
| `emailRateLimitKey()` | One account, one budget. |

Existing rows are normalized by
`database/migrations/20261009130000_normalize_user_email_case/migration.sql`. Rows that would
collide under normalization are **skipped**, not merged: two accounts sharing one address is
a data decision, and readers normalize anyway, so leaving them alone is safe.

---

## 3. Orphaned `auth.users` records

Registration clears an `auth.users` record that has no `public.User` row, because such a
record blocks every retry with that address. It only clears a **password** record:

```ts
const isDeletableOrphan = (providers: string[]) =>
  providers.every(provider => provider === 'email')
```

An address attached to a social identity belongs to somebody who signs in through that
provider. Deleting it because a stranger typed the same address into the registration form
breaks the victim's Google login and hands the address to the typist. Those are reported as
taken (409) instead.

---

## 4. What a public read may return

Three layers, each of which has to hold on its own:

1. **The repository selects.** `organizerRepository.findBySlugWithGroups()` is a `select` of
   the 21 public profile fields plus `groups: { select: cardSelect }` — not an `include`,
   which ships every scalar column (`userId`, `organizerId`, `timezone`, `rejectionReason`,
   the cuid). `PUBLIC_GROUP_STATUSES` filters the groups, so DRAFT and REJECTED groups that
   are published nowhere are not even read.
2. **The mapper re-picks.** `mapGroupCard()` / `mapGroupForPublic()` in
   `server/utils/groupResponse.ts` build the response field by field. A group's public
   identifier is its slug; the cuid never leaves the server.
3. **The handler whitelists.** `api/organizers/[slug].get.ts` enumerates what it returns and
   answers 404 — not 403 — for a non-verified profile requested by a non-admin, so an
   unverified slug is indistinguishable from one that never existed.

`sessionUserSelect` in `server/repositories/userRepository.ts` is the same idea for sign-in
responses: a `select`, never an `include`, so `authId` and `rejectionReason` cannot ride
along.

---

## 5. Owner, co-organizer, admin

| Action | Owner | Co-organizer | Admin |
|---|---|---|---|
| View / edit a group | ✓ | ✓ | ✓ |
| Read the applicant queue (`application.viewForGroup`) | ✓ | ✓ | ✓ |
| Approve / reject (`application.manage`) | ✓ | ✓ | ✓ |
| Change group status | ✓ | ✗ | ✓ |
| Manage co-organizers | ✓ | ✗ | ✓ |
| **Delete** a group (`group.delete`) | ✓ | ✗ | ✓ |

Reading a queue and acting on it are the same audience; `application.manage` and
`application.viewForGroup` must agree, or the UI renders a button the server refuses.
Destroying a group is not: deletion cascades through applications, answers, questions,
favorites and reviews, so it stays with the owner.

`tests/shared/permissions.test.ts` asserts the two application keys agree on every caller.

---

## 6. Race-safe seat allocation

Approving an applicant used to count the seats, compare against capacity and write — with
nothing serializing concurrent approvals. Two organizers clicking at once both read the same
count, both wrote, and the group ended up over capacity with no error anywhere.

`applicationService.updateStatus()` now runs inside a `prisma.$transaction()` that opens with

```sql
SELECT status, capacity FROM "Group" WHERE id = $1 FOR UPDATE
```

(`groupRepository.lockById()`). Every later read of the seat state happens under that lock,
so approvals on one group are serialized by the database. `SELECT … FOR UPDATE` was chosen
over `SERIALIZABLE` deliberately: at this contention level a row lock waits, while a
serialization failure raises P2034 and needs a retry loop.

The `FULL` ⇄ `PUBLISHED` transition and the application write commit or roll back together.

---

## 7. OAuth identity reconciliation

`server/api/auth/google.post.ts` resolves the local row by `authId` first and by email
second:

1. a row already carrying this `authId` is the same person → repair its address if the
   provider changed it;
2. a row carrying the address with **no** `authId` is a password sign-up meeting its provider
   for the first time → link them;
3. a row carrying the address under a **different** `authId` is somebody else →
   `409 CONFLICT`, "Account with this email exists under a different provider";
4. otherwise the identity is new → create it.

Email-only matching (the old order) meant a Google account whose address changed could never
be reconciled: the local row kept the old address, the new one matched nothing, and every
later sign-in either created a second account or died on the unique `email` with an
unrecoverable P2002.

Two accounts sharing one address are **refused, never merged**. Adopting the existing row
would hand the caller somebody else's groups and applications.

`isActive` is checked after resolution on every path, not only the one that created a row: an
account deactivated while its Google session is still valid must not get back in.

`getUser()` performs no writes at all when the stored address already matches. It used to
`upsert` on every authenticated request, including read-only ones, and raced itself on
`authId` when two requests from a new session landed together.

---

## 8. Revoking a session that is already open

Setting `isActive = false` stops the account at three different distances, and only the
first was ever enough on its own:

1. **Every protected API call.** `requireAuth()` reads the row on each request and answers
   403, so a banned session cannot write or read anything privileged. This is the actual
   enforcement, and it does not depend on the client cooperating.
2. **Every private route.** `/api/auth/me` reports a deactivated account as
   `{ user: null, reason: 'ACCOUNT_DISABLED' }`. The client caches that answer for
   `SESSION_MAX_AGE_MS` and `auth.global.ts` re-reads it once the cache ages out, so an SPA
   session that was opened before the ban is dropped at the next private navigation — with
   the reason in the query string, which is what lets the login page explain itself instead
   of leaving the visitor to retry a password into a 403.
3. **Every signed-in page, within 30s.** The unread-notification poll is the one request an
   authenticated page makes on its own. Its 403 handler ends the session immediately, which
   covers a visitor sitting on a *public* page that the route guard never re-checks.

The re-read is on a clock rather than per navigation because each one costs a Supabase
round-trip plus a database read, and clicking around the site would otherwise put both
behind every click.

A transport failure while re-reading is **not** treated as a ban: `fetchUser()` leaves the
previous verdict alone, so a database blip signs nobody out and frames nobody.

---

## 9. Error handling and logging

See [architecture.md](./architecture.md) for the full flow. The security-relevant rules:

- `sanitizeError()` whitelists `TRUSTED_ERROR_CODES`. An untrusted code is replaced by
  `{ code: 'INTERNAL' }` while the handler's own status is kept, so a 403 stays a 403 — the
  body is what gets generic, not the status. Stack traces, Prisma messages and P-codes never
  reach a response body.
- `INTERNAL` is on the whitelist as a *code* only. It is the code a handler reaches for when
  it has an internal diagnostic to name (`'Failed to upload avatar'`), so `sanitizeError`
  strips that message even though the code passes. The log line keeps it.
- A `DomainError`'s message never reaches the wire either: `toDomainHttpError()` substitutes a
  fixed phrase per code and leaves the original on `cause`. Service messages are written for
  developers, are not localized, and can quote user input back —
  `Question "…" requires at least 2 options`. Clients branch on `data.code`.
- `mapPrismaError()` attaches the raw error as `cause` so the P-code reaches the logs while
  the body stays generic.
- `logHandlerError()` reads the domain message back off that same `cause` chain, so replacing
  it on the wire costs the operator nothing.
- A `CANCELLED` group answers 404, indistinguishable from a slug that never existed. So does a
  blocked organizer's profile — see [permissions.md](./permissions.md).
- Query strings are dropped from log lines so OAuth codes never land in logs.
- Application answers are never logged and never included in emails.

---

## 10. Database security posture

The short version: **one trusted server role, no PostgREST exposure, and RLS enabled but
inert.** RLS is present as a defense-in-depth flag, not as a control that filters anything.

Measured on the Supabase project (`pg_class`, `pg_policies`, `role_table_grants`):

| Property | Value |
|----------|-------|
| `relrowsecurity` on `public` tables | `true` for all of them |
| `pg_policies` where `schemaname = 'public'` | **0 rows** |
| `role_table_grants` for `anon` / `authenticated` / `service_role` | **0 rows** |
| Role the application connects as | `postgres`, which has `rolbypassrls = true` |

So no query this application runs is filtered by RLS. With zero policies, RLS would be
default-deny for any role that is not the owner and does not bypass — and the only role that
connects both owns the tables and bypasses. The flag changes nothing today.

### What actually scopes data

- **The repository layer.** Every read is an explicit `select` or `where` written for its
  caller. §4 is the rule and the reason; `organizerRepository.findBySlugWithGroups` is the
  clearest example, whitelisting columns because an `include` would ship `userId`,
  `organizerId` and `timezone` to an anonymous visitor.
- **`server/utils/permissions.ts`.** `can()` / `requirePermission()` decide who may ask, on
  the server, from a session-derived user — never from an id the client supplied.
- **No client-side database access.** There is no Supabase client in `app/` — the browser talks
  to `/api/*` only, and `server/plugins/csp.ts` puts nothing but `'self'` and the Iconify
  origins in `connect-src`, so a script that tried to reach PostgREST directly would be
  blocked by the browser as well as by the missing grants.

### What a leaked `SUPABASE_ANON_KEY` reaches

Nothing. The key authenticates to PostgREST and to GoTrue's public endpoints; with no grants
to `anon` and no policies, every table read through PostgREST is denied. This is why the anon
key is a build-time public value in `runtimeConfig.public` rather than a secret — it is not
one. `SUPABASE_SERVICE_ROLE_KEY` is the dangerous half and stays server-side, resolved at
request time and never inlined into `.output`.

### Why the flag is kept anyway

It costs nothing and it is the correct starting posture if that ever changes: enabling
PostgREST access, adding a client-side Supabase, or granting `anon` a single table would all
land on default-deny rather than default-allow. What must not happen is the flag being cited
as protection that exists now. `tests/integration/rls.test.ts` asserts `relrowsecurity` and
nothing else, and says so in a comment — a green run there is not evidence that a query is
filtered.

Making it a real control would mean writing policies *and* a test that reads through `anon`,
which requires granting `anon` something first. Until then, scoping is the repository's job.
