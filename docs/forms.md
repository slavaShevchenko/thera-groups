# Forms

## Principles

Forms must be predictable and accessible.

Every form should explicitly handle:

```text
idle
submitting
success
validation error
server error
```

## Double submission

Disable or otherwise guard submission while the request is in progress.

Do not rely only on UI disabling if duplicate requests could have meaningful consequences.

The server should also enforce idempotency or uniqueness where required.

## Validation

Client validation:

- improves UX
- gives immediate feedback

Server validation:

- is authoritative
- must always happen

## Error presentation

Errors should be:

- associated with the relevant field
- readable by assistive technologies
- localized
- non-destructive to already entered values

## Application forms

Applications may be submitted without registration.

At minimum, the server must validate:

- group availability
- group status
- required contact fields
- custom question requirements
- duplicate/duplicate-like application rules if applicable

Never expose private organizer application data to the applicant.

## Sensitive answers

Do not place application answers in confirmation emails.

Use email to confirm that the application was received.

Detailed content remains inside the authenticated organizer dashboard.
