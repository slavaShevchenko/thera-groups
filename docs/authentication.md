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
  and `?role=visitor|organizer` (default `visitor`).
- `POST /api/auth/google` — completes OAuth with token exchange.

`role` decides whether the sign-up also opens an `OrganizerProfile` in `PENDING`:

- `visitor` — a `User` with role `VISITOR` and **no** profile. Signing in through Google
  used to create a profile for everyone who had a name in their Google metadata, which
  filled the verification queue with people who never asked to organize.
- `organizer` — a `User` with role `ORGANIZER` plus a `PENDING` profile. An existing
  `VISITOR` who signs in with `role=organizer` is upgraded: the profile is created and the
  role changes. A user who already has a profile keeps it — repeated sign-ins never create
  a second one.

The role cannot travel through the redirect itself: Supabase generates its own OAuth `state`
and the `redirectTo` must stay inside its allowlist, so `google-start` stores the choice in a
short-lived httpOnly cookie (`server/utils/oauth.ts`) that `POST /api/auth/google` consumes.
The register page passes the role its radio buttons selected; the login page passes
`visitor`.

#### The redirect allowlist

`google-start` builds `redirectTo` as `` `${origin}/${locale}/auth/callback` ``, so there is one
callback URL **per locale**, and Supabase refuses any that is not on its allowlist:

| Environment | URLs to allow |
|-------------|---------------|
| Production | `https://psygroup.org/ua/auth/callback`, `https://psygroup.org/en/auth/callback` |
| Local dev | `http://localhost:3000/ua/auth/callback`, `http://localhost:3000/en/auth/callback` |
| Preview | `https://<deployment-url>/ua/auth/callback`, `https://<deployment-url>/en/auth/callback` |

Add them in the Supabase dashboard: **Authentication → URL Configuration → Redirect URLs → Add
URL**, one entry per row. **Site URL** on the same page should be the bare origin
(`https://psygroup.org`) — that is where Supabase sends the browser when a `redirectTo` is
missing or not allowed, which is why a missing entry fails silently instead of erroring: the
sign-in appears to do nothing and no function log explains it.

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

- Registration creates VISITOR
- User must create an OrganizerProfile and get VERIFIED to create groups
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
