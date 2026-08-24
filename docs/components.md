# Component Architecture

## Component hierarchy

Use this conceptual hierarchy:

```text
UI primitives
    ↓
Feature components
    ↓
Sections
    ↓
Pages
```

## UI primitives

A UI component knows how to render an interface primitive.

It does not know:

- what a group is
- who a organizer is
- what an application means
- how permissions work

Example:

```text
UiButton
UiInput
UiModal
```

## Feature components

Feature components understand a domain concept.

Example:

```text
GroupCard
GroupFilters
ApplicationStatus
OrganizerProfileCard
```

They may accept domain data, but should avoid owning the entire workflow.

## Sections

Sections compose features into meaningful page blocks.

## Pages

Pages compose sections/features and coordinate page-level data.

Avoid putting large templates into pages.

---

## Single responsibility

A component should answer one clear question.

Bad:

```text
GroupDetailsAndApplicationAndNotifications.vue
```

Better:

```text
GroupHeader.vue
GroupDetails.vue
GroupSchedule.vue
GroupApplicationForm.vue
```

---

## Props

Props should be explicit and meaningful.

Avoid passing a giant object when only a few values are required unless the domain object itself is the intended contract.

Do not mutate props.

---

## Emits

Events should describe intent:

```text
submit
cancel
select
remove
update
close
```

Avoid implementation-specific events such as:

```text
doThing
buttonClickedInternally
runRequest
```

---

## Slots

Use slots when layout components need flexible content.

Do not pass HTML strings.

---

## Forms

Forms should separate:

```text
presentation
form state
validation
submission
```

Complex forms should use a composable or dedicated feature-level logic rather than becoming giant components.

---

## Component extraction

Extract a component when:

- responsibility becomes unclear
- markup is repeated
- behavior is repeated
- the component is independently meaningful
- a section becomes difficult to reason about

Do not extract every five lines into a component.

---

## Reuse before creation

Before creating a component, search the repository.

If an existing component is 80% suitable, prefer extending it through a clean API over creating a duplicate.

Do not modify a generic component with business-specific behavior just to avoid creating a feature component.
