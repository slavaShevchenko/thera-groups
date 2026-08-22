# Local Agent Workflow

## Goal

The agent should behave like a senior engineer working inside an existing production codebase.

The agent must inspect before changing.

## Step 1 — Understand

Read:

```text
AGENTS.md
```

Then identify relevant documents from:

```text
docs/
```

For example:

- UI task → components + css + i18n
- API task → api + domain + authorization + database
- auth task → authentication + authorization + security
- form task → forms + validation rules + i18n
- SEO task → seo

## Step 2 — Inspect

Before creating a new file:

1. inspect nearby files
2. search for similar behavior
3. search for reusable components
4. search for existing composables
5. inspect related API endpoints
6. inspect relevant domain states
7. inspect translation keys

## Step 3 — Plan

For non-trivial tasks, internally establish:

```text
What changes?
Which files?
Which existing abstractions can be reused?
Which domain rules apply?
Which translations are required?
Which tests should change?
```

Do not over-engineer.

## Step 4 — Implement

Make the smallest safe change.

Do not rewrite unrelated code.

Do not introduce a new library unless absolutely necessary and compatible with the project rules.

## Step 5 — Validate

Run the most relevant:

```text
lint
tests
type/static checks if configured
build
e2e
```

Do not claim a check passed if it was not actually run.

## Step 6 — Review

Inspect the final diff.

Look specifically for:

- hardcoded text
- missing translations
- BEM violations
- CSS framework usage
- duplicated logic
- missing authorization
- client-side security assumptions
- accidental unrelated changes
- missing loading/error states

## Step 7 — Report

Final report should be concise:

```text
Changed:
- ...

Tests:
- ...

Notes:
- ...
```

If something could not be verified, say so explicitly.

---

## Missing context rule

If the task cannot be safely completed because required information is missing:

STOP.

Ask for the exact missing information.

Examples:

```text
Please provide the current Group model.
Please show the existing application API.
Please show the current useLocale implementation.
Please provide the component that currently renders this UI.
```

Do not fabricate an implementation.

---

## Existing-pattern rule

Before introducing:

- a new composable
- a new component
- a new utility
- a new service
- a new repository
- a new state store

search for an existing equivalent.

Prefer consistency over personal preference.

---

## Scope rule

If the task is:

```text
Add application form
```

do not also:

- redesign the header
- refactor unrelated components
- rename unrelated files
- upgrade dependencies
- rewrite CSS architecture

unless required for the task.

---

## Dependency rule

Do not add a dependency when:

- the feature is small
- the platform already provides the functionality
- the project already has a suitable abstraction

Any new dependency should have a clear technical justification.
