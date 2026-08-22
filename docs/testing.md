# Testing

## Philosophy

Test behavior and business rules, not implementation trivia.

## Unit tests

Use Vitest for:

- pure utilities
- domain functions
- validation
- state transition rules
- permission logic
- composables where meaningful

## Integration tests

Use integration tests for:

- services
- repositories where practical
- API workflows
- database behavior that cannot be safely represented by unit tests

## E2E

Use Playwright for critical flows.

Initial priority:

```text
visitor searches groups
visitor opens group
visitor submits application
therapist logs in
therapist views application
therapist approves/rejects application
therapist creates group
admin moderates group
```

## Tests for state machines

Every important lifecycle transition should have tests.

Example:

```text
draft → pending_review
pending_review → published
pending_review → rejected
published → cancelled
```

Invalid transitions should also be tested.

## Tests for permissions

Test both:

```text
allowed
forbidden
```

Do not only test happy paths.

## Test data

Never use real personal information.

Use deterministic fixtures where possible.

## Definition

A test is valuable when it would fail if a meaningful regression were introduced.
