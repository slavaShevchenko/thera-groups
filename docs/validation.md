# Validation

## Server authority

The server is always authoritative.

Client validation is only for user experience.

## Zod

Use Zod schemas for external input.

Validate:

- request bodies
- query parameters
- route parameters when necessary
- external API responses where appropriate

## Validation boundaries

Validate immediately when data crosses a trust boundary.

Examples:

```text
browser → API
external service → server
database → domain when shape cannot be trusted
```

## Business rules vs shape validation

Zod is ideal for shape constraints:

```text
email is valid
title is a string
capacity is an integer
```

Domain services handle business rules:

```text
group must accept applications
organizer must own the group
published group cannot be edited in certain ways
```

Do not force all business logic into Zod schemas.

## Errors

Validation errors returned to users must be localized at presentation level.

Do not put localized prose into domain enums.
