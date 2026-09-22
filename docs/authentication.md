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
| `requireRole(event, roles[])` | Returns User or throws 401/403 |

### Auto-Provisioning

When a user authenticates for the first time, `getUser()` automatically creates a User record with role `VISITOR`. The `authId` field links to the Supabase Auth user ID.

### Google OAuth

- `GET /api/auth/google-start` — initiates OAuth flow via Supabase
- `POST /api/auth/google` — completes OAuth with token exchange

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
- `isActive` flag on User can disable accounts
