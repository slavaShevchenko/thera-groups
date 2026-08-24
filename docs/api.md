# API Conventions

## General

API routes live under:

```text
server/api/
```

Handlers are HTTP boundaries, not business workflows.

Preferred structure:

```text
parse request
↓
validate
↓
authenticate
↓
authorize
↓
call service
↓
return response
```

## Naming

Use resource-oriented URLs.

Examples:

```text
GET    /api/groups
GET    /api/groups/:id
POST   /api/groups
PATCH  /api/groups/:id
DELETE /api/groups/:id

POST   /api/groups/:id/applications

GET    /api/organizer/groups
GET    /api/organizer/applications

PATCH  /api/applications/:id

GET    /api/notifications
PATCH  /api/notifications/:id/read
```

Exact endpoints remain subject to the current product contract.

## HTTP methods

Use:

```text
GET    read
POST   create/action
PATCH  partial update
DELETE delete
```

Do not use POST for every operation.

## Validation

Every client-controlled payload must be validated.

Server validation is authoritative.

Use Zod schemas from the appropriate schema location.

## Authorization

Every protected mutation must check:

1. authentication
2. role
3. resource ownership where applicable
4. allowed state transition

Never trust IDs supplied by the client.

## Errors

Use consistent machine-readable error codes.

Example conceptually:

```text
VALIDATION_ERROR
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
CONFLICT
RATE_LIMITED
INTERNAL_ERROR
```

Do not return database or framework errors directly.

## Pagination

List endpoints should use a consistent pagination strategy.

Do not create a different pagination contract for every endpoint.

## Filtering

Filters must use explicit query parameters.

Example:

```text
/api/groups?query=anxiety&format=online&page=2
```

Do not serialize arbitrary executable objects into query parameters.

## Server response contracts

Response shapes should be predictable.

Avoid returning completely different shapes for success cases of the same endpoint.

Document non-obvious response contracts in the relevant feature documentation.
