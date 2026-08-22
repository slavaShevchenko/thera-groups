# Application Architecture

## Goal

Keep the system simple while maintaining clear boundaries.

The initial architecture is a modular monolith inside Nuxt.

Do not introduce microservices unless there is a demonstrated operational need.

## Layers

```text
UI
↓
composables
↓
API client
↓
server API
↓
domain services
↓
repositories
↓
Prisma
↓
PostgreSQL
```

## UI layer

Responsibilities:

- rendering
- user interaction
- local UI state
- accessibility
- localized presentation

Must not:

- access database
- decide authorization
- implement core business rules

## Composable layer

Responsibilities:

- reusable client-side state
- API interaction
- UI-oriented orchestration

Must not:

- contain secrets
- access Prisma
- replace server authorization

## API layer

Responsibilities:

- HTTP boundary
- input parsing
- validation
- authentication
- authorization
- delegating to services

Keep handlers thin.

## Service layer

Responsibilities:

- business workflows
- domain rules
- state transitions
- orchestration of repositories and side effects

Example:

```text
applicationService.approve()
```

can:

1. load application
2. verify current state
3. verify therapist permission
4. update application
5. create notification
6. schedule/send appropriate email event

## Repository layer

Responsibilities:

- persistence
- database queries
- Prisma interaction

Repositories should not know how UI works.

## Side effects

Email, notifications and similar side effects should be coordinated from services rather than scattered through UI code.

## Modularity

Organize code around domain concepts rather than technical duplication.

Prefer:

```text
groups
applications
therapists
notifications
```

over enormous generic folders.

## Complexity rule

Do not introduce infrastructure because it may be useful someday.

Start with:

```text
Nuxt
Nitro
PostgreSQL
Prisma
Vercel
```

and add infrastructure only when justified.
