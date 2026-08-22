# Error Handling

## Categories

Use predictable application-level categories:

```text
VALIDATION_ERROR
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
CONFLICT
RATE_LIMITED
INTERNAL_ERROR
```

## User-facing errors

User-facing messages must be localized.

Do not expose:

- stack traces
- SQL errors
- Prisma errors
- internal IDs unless intentionally designed
- implementation details

## Developer-facing errors

Logs may contain technical details required for debugging.

Never log:

- passwords
- authentication tokens
- full application contents
- sensitive psychotherapy-related answers
- secrets

## Expected errors

Expected domain errors should be handled deliberately.

Examples:

- group no longer accepts applications
- application already exists
- therapist cannot edit published group
- user lacks permission

Do not treat expected business conflicts as generic 500 errors.

## Unexpected errors

Unexpected errors should be logged server-side and exposed to the user as a generic localized error.

## Error consistency

Do not create custom error response shapes for every endpoint.
