# Authorization

## Principle

Authentication answers:

> Who is this?

Authorization answers:

> Is this user allowed to perform this action on this resource?

Authorization must be enforced server-side.

## Roles

### Visitor

Can:

- browse public groups
- search
- filter
- submit applications
- use public therapist profiles

Cannot:

- manage groups
- access therapist applications
- access admin functions

### Therapist

Can:

- manage own profile
- create own groups
- edit own groups according to lifecycle rules
- view applications for own groups
- approve/reject applications for own groups
- manage own notifications

Cannot:

- edit another therapist's groups
- view another therapist's private applications
- approve groups globally

### Admin

Can:

- moderate groups
- manage therapist verification
- review reports
- manage platform-level entities
- access administrative workflows

## Ownership

Never accept ownership from client payloads.

Bad:

```text
POST /api/groups
{
  therapistId: "someone-else"
}
```

The server must derive the authenticated therapist identity from the session.

## Resource authorization

Before returning or mutating a private resource:

```text
authenticate
↓
identify resource
↓
verify ownership/permission
↓
perform operation
```

Never rely only on hidden UI buttons.
