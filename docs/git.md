# Git Conventions

## Commit principles

Commits should be:

- focused
- small
- understandable
- independently reviewable

Preferred prefixes:

```text
feat:
fix:
refactor:
test:
docs:
chore:
perf:
```

Examples:

```text
feat: add therapist group creation flow
fix: prevent duplicate group applications
refactor: extract group filters composable
test: cover application state transitions
docs: document group moderation flow
```

## Avoid

```text
feat: add groups and fix unrelated header and update packages
```

Split unrelated work.

## Pull requests

A PR should explain:

- what changed
- why
- relevant behavior
- tests performed
- any known limitations

## Agent commits

An AI agent must not create commits unless explicitly instructed.

Before a commit is requested, inspect the final diff.

## Formatting-only changes

Do not mix broad formatting changes with feature work unless formatting is the explicit task.
