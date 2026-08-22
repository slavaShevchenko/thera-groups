# Authentication

Authentication is handled via Supabase Auth.

## Roles

```text
visitor
therapist
admin
```

Only authenticated accounts can access therapist/admin dashboards.

Visitors can browse public groups and submit applications without registration.

## Registration

Therapist registration should establish an account first.

Therapist profile completion and verification are separate concepts.

Do not automatically treat registration as verification.

## Session

Use secure server-managed authentication appropriate for the selected provider.

Never store sensitive authentication secrets in localStorage.

## Passwords

If password authentication is implemented through an external auth provider, use its secure password handling.

Never implement custom password hashing unless there is a strong architectural reason.

## Protected routes

Client middleware improves UX.

It is not a security boundary.

Every protected API endpoint must authenticate the request server-side.

## Logout

Logout must invalidate the authenticated session according to the auth provider's mechanism.

## Account deletion

Account deletion must account for:

- personal profile data
- applications
- reviews
- favorites
- notifications
- audit requirements

Do not blindly cascade-delete legally or operationally required records.
