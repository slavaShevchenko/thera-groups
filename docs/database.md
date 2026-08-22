# Database Architecture

## Database

PostgreSQL.

Provider:

- Supabase

The application must remain portable at the PostgreSQL level where practical.

## ORM

Prisma.

Prisma is server-only.

Never import Prisma into client-side code.

## Repository boundary

Database access should be isolated behind repositories or server-side data-access functions.

Example conceptual flow:

```text
application API
↓
application service
↓
application repository
↓
Prisma
```

## Migrations

Every schema change must be represented by a migration.

Never rely on an undocumented manual production database change.

## Constraints

Use database constraints for invariants that belong at persistence level.

Examples:

- unique user email
- unique group slug
- unique favorite per user/group
- valid foreign keys
- required fields

Application code should still validate business rules.

## Sensitive data

Avoid storing data that the product does not need.

Application responses may contain sensitive personal information.

Do not log raw application payloads.

## Transactions

Use database transactions when multiple related writes must either all succeed or all fail.

Examples:

- approving an application and creating related records
- creating a group and its required related entities

Do not use transactions by default for unrelated reads.

## Seed

Seed data must be safe and deterministic enough for development.

Never include real personal information.
