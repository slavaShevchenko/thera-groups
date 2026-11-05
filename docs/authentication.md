# Authentication

## Supabase Auth Integration

Authentication is handled by Supabase Auth. The server creates a Supabase client per-request using `server/utils/supabase.ts`.

### Flow

1. Client sends session cookie/cookie-based auth
2. Server creates Supabase client via `createServerClient(event)`
3. `supabase.auth.getUser()` validates the JWT
4. Server upserts user in PostgreSQL (links `authId` to User record)

### Key Functions (`server/utils/auth.ts`)

| Function | Description |
|----------|-------------|
| `getUser(event, options?)` | Returns User or null. Upserts on authId. Optional `withProfile` includes organizerProfile. |
| `requireAuth(event)` | Returns User or throws 401 |

Authorization lives in `server/utils/permissions.ts`: `requirePermission(user, permission, resource?)`
throws 403 unless `can()` allows it. There is no role-based gate — check a permission key, not a role.

### Auto-Provisioning

When a user authenticates for the first time, `getUser()` automatically creates a User record with role `VISITOR`. The `authId` field links to the Supabase Auth user ID.

### Google OAuth

- `GET /api/auth/google-start` — initiates OAuth flow via Supabase. Takes `?locale=ua|en`
  (default `ua`), which picks the callback URL.
- `POST /api/auth/google` — completes OAuth with token exchange. **Sign-in only.**

Google never creates an account. `POST /api/auth/google` resolves the provider identity to
a `public.User` row and answers `404 NOT_FOUND` when there is none; the callback page turns
that into "register with email and password" plus a button to do it.

It used to be a sign-up path too, with a `role=visitor|organizer` choice carried across the
redirect in a short-lived httpOnly cookie. `organizer` opened a `PENDING` profile built from
nothing but `given_name` and `family_name` — which some Google accounts do not supply at
all — so the profile reached the moderation queue missing every field
`organizerService.moderateProfile` checks against `VERIFICATION_REQUIRED_FIELDS`. The queue
entry could never be approved, while its owner had been told the profile was "under review".
Registration is the only path that can ask those questions, so it is the only path that
opens a profile. The cookie, the `role` parameter and `createOrganizerProfile` are gone; a
stray `role=` in an old link is ignored.

An existing `VISITOR` who wants to organize uses `POST /api/organizers/me`
(`BecomeOrganizerForm` on the profile page), which collects the same fields.

#### A refusal cleans up after itself

Exchanging the code signs the identity in to GoTrue whether or not the handler accepts the
result, so a refusal leaves an `auth.users` row with no `public.User` behind it. For the 404
that row is poison: `register.post.ts` refuses to clear an orphan carrying a social identity,
because it cannot tell "somebody clicked Google and was refused" from "somebody else's
account" and guessing wrong is an account takeover. Left in place it would answer
`409 CONFLICT` to the very registration the 404 sends the visitor to.

So `google.post.ts` deletes the row its own exchange wrote before answering 404
(`clearRefusedSignup`). That is safe where the same deletion is not safe in registration:
the caller proved control of the address by completing the provider's consent flow seconds
earlier, and there is no local account to take over. It is best-effort — a provider failure
logs a `console.warn` and the answer stays 404, never 500.

The exchange also writes **session cookies**, and those have to go on *both* refusals:
`getUser()` auto-provisions a `VISITOR` row for any session it can resolve that no local row
answers to, and it is reached by every endpoint behind `requireAuth()` as well as by the
public reads that call it optionally (`/api/groups/[slug]`, `/api/organizers`,
`/api/organizers/[slug]`). A cookie left on the browser therefore registers the visitor on
their next page view and makes the 404 they just saw a lie. `endRefusedSession` signs out
first, while `/logout` can still reach the row `clearRefusedSignup` is about to delete.

The `409` provider conflict signs out for a different reason and stops there. Its session
resolves to no row either, but the address it carries belongs to an account under another
`authId`, so the auto-provisioned `create` would not register anybody — it would die on the
unique `email`, and the P2002 would surface as a 409 on public catalog pages until that
browser cleared its cookies. The GoTrue row is **kept**: the address has a real account
behind it, registration is not the way out of this refusal, and there is no orphan blocking
anything. Deleting an identity that may belong to a person is not a cleanup.

The deactivated-account `403` cleans up nothing, and that is correct: its row exists and is
found by `authId`, so the session is answered for by the revocation path in
[security.md §8](./security.md#8-revoking-a-session-that-is-already-open).

#### The redirect allowlist

`google-start` builds `redirectTo` as `` `${oauthRedirectOrigin(event)}/${locale}/auth/callback` ``,
so there is one callback URL **per locale**, and Supabase refuses any that is not on its allowlist.

`oauthRedirectOrigin()` (`server/utils/oauth.ts`) returns **`SITE_URL`, not the request's own
host**. Behind Vercel the request host is whichever hostname reached the function — a preview's
`*.vercel.app`, or the literal `localhost` h3 substitutes when no `host` header survives — and
`getRequestURL()` reports `http:` unless `x-forwarded-proto` is present. An origin that is not on
the allowlist is not an error either: Supabase sends the browser to the project's **Site URL**
instead, so the symptom of one wrong header is a production sign-in that lands on
`http://localhost:3000` with nothing in the function logs. The one exception is dev, where
`SITE_URL` is `nuxt.config.ts`'s localhost fallback rather than a configured public origin: there
the request origin wins, so a checkout on another port or a LAN address can still sign in.

| Environment | Origin used | URLs to allow |
|-------------|-------------|---------------|
| Production | `SITE_URL` | `https://psygroup.org/ua/auth/callback`, `https://psygroup.org/en/auth/callback` |
| Local dev | request origin | `http://localhost:3000/ua/auth/callback`, `http://localhost:3000/en/auth/callback` |
| Preview | `SITE_URL` | the production pair — a preview inherits it, so Google sign-in started on a preview **completes on the production domain** and the preview itself stays signed out |

Add them in the Supabase dashboard: **Authentication → URL Configuration → Redirect URLs → Add
URL**, one entry per row. **Site URL** on the same page must be the bare origin
(`https://psygroup.org`) and never a leftover `http://localhost:3000` — that is where Supabase
sends the browser when a `redirectTo` is missing or not allowed, which is why a missing entry
fails silently instead of erroring: the sign-in appears to do nothing, or lands on localhost, and
no function log explains it.

Adding a locale means adding its callback URL here too, and nothing in the codebase enforces
that the two lists agree — `googleStartQuerySchema` validates `locale` against the same enum
the routes use, so a third locale would start producing a `redirectTo` Supabase has never seen.

This is a pre-deployment checklist item: see
[`deployment.md`](./deployment.md#pre-deployment-checklist).

## Roles

| Role | Description |
|------|-------------|
| VISITOR | Default. Can browse, apply, favorite, manage own notifications |
| ORGANIZER | Can create groups (if VERIFIED), manage profile |
| ADMIN | Full access: moderate groups/profiles, manage users |

### Role Escalation

- Registration creates a `VISITOR`, or an `ORGANIZER` with a `PENDING` profile when the
  visitor picks that role — it collects every `VERIFICATION_REQUIRED_FIELDS` entry, so the
  profile that reaches the queue is one an admin can approve
- A `VISITOR` who wants to organize later uses `POST /api/organizers/me`, which asks for the
  same fields and opens the same `PENDING` profile
- Google sign-in changes no role and creates nothing: it only resolves an existing account
- Only a `VERIFIED` profile may create groups
- ADMIN role is assigned manually (via seed or database)

## Verification Status

| Status | Meaning |
|--------|---------|
| UNVERIFIED | New profile, not yet submitted |
| PENDING | Submitted for admin review |
| VERIFIED | Approved — can create groups |
| REJECTED | Denied — reason stored in rejectionReason |

## Session Management

- Supabase manages sessions via cookies
- `POST /api/auth/logout` calls `supabase.auth.signOut()`
- Server does not maintain its own session store
- JWT tokens are validated server-side on each request

## Security

- Service role key (`SUPABASE_SERVICE_ROLE_KEY`) is server-only — never exposed to client
- Anon key (`SUPABASE_ANON_KEY`) is public
- User IDs are derived from session, never trusted from client input
- `isActive` flag on User disables accounts — `requireAuth()` enforces it on every request,
  and the client re-reads `/api/auth/me` on a clock so an already-open session is revoked
  too. See [security.md](./security.md#8-revoking-a-session-that-is-already-open)
