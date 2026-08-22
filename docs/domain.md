# Domain Model

## Product

The platform is a catalog and application platform for psychotherapy groups.

Primary actors:

```text
Visitor
Therapist
Admin
```

## User

Represents an authenticated account.

Core fields conceptually include:

```text
id
email
role
status
preferredLocale
createdAt
updatedAt
```

### preferredLocale

The user's preferred language for the interface.

- Stored as a string enum: `'ua'` or `'en'`
- Default value: `'ua'`
- Used by the middleware to resolve the correct locale when the user visits the site
- Takes highest priority in the locale resolution system (cookie > URL > default)
- When the user changes the language via the UI, this field is updated along with the browser cookie

Do not duplicate authentication provider data unnecessarily.

---

## TherapistProfile

A therapist may have a public profile.

Conceptual fields:

```text
id
userId
firstName
lastName
avatar
bio
qualification
specialization
experienceYears
languages
location
website
verificationStatus
createdAt
updatedAt
```

### Multilingual content

Therapist profiles may contain content that needs localization:

- `bio` — therapist description
- `qualification` — credentials
- `specialization` — areas of expertise

Currently, these fields store content in a single language. Future iterations may support separate fields per locale or JSON-based multilingual storage.

The exact database schema is maintained separately.

---

## Group

A group is the primary catalog item.

Conceptual fields:

```text
id
therapistId
title
slug
description
categoryId
format
location
startsAt
endsAt
timezone
capacity
price
currency
status
createdAt
updatedAt
```

### Group format

```text
online
offline
hybrid
```

### Group lifecycle

```text
draft
  ↓
pending_review
  ↓
published
  ↓
completed
```

Alternative transitions:

```text
pending_review → rejected
published → cancelled
published → full
full → completed
```

A group must not be publicly visible unless its status permits publication.

### Multilingual content

Groups contain user-facing text that must be localized:

- `title` — group name
- `description` — detailed description

Currently, these fields store content in a single language. Future iterations may support:

- Separate fields per locale: `titleUa`, `titleEn`
- JSON-based multilingual storage: `title: { ua: "...", en: "..." }`
- Linked translation entities

The `slug` field is language-independent and shared across all locale versions.

---

## Application

A visitor may apply without registration.

Conceptual fields:

```text
id
groupId
name
email
phone
message
status
locale
createdAt
updatedAt
```

### locale

The language in which the application was submitted.

- Stored as a string enum: `'ua'` or `'en'`
- Captured at the time of submission from the current URL locale
- Used to determine which language to use when sending notification emails to the therapist
- Helps therapists understand the applicant's preferred language

Application answers may be stored separately.

### Application lifecycle

```text
pending
  ↓
approved
```

or:

```text
pending
  ↓
rejected
```

Possible withdrawal:

```text
pending → withdrawn
approved → withdrawn
```

Do not invent additional transitions without a product decision.

---

## Application Questions

Therapists may define additional application questions.

Conceptually:

```text
id
groupId
question
type
required
position
```

Answers:

```text
id
applicationId
questionId
value
```

### Multilingual questions

Application questions may need localization if the platform supports therapists creating questions in multiple languages.

Currently, questions are stored in a single language. Future iterations may support:

- Separate fields per locale
- Linked translation entities
- Locale-specific question sets

Question types should be explicitly defined by the product.

Do not accept arbitrary executable content.

---

## Notification

Notifications inform authenticated users about events.

Conceptual structure:

```text
id
userId
type
entityType
entityId
title
message
readAt
createdAt
```

Notification type must be a stable domain enum, not translated text.

Examples:

```text
APPLICATION_RECEIVED
APPLICATION_APPROVED
APPLICATION_REJECTED
GROUP_APPROVED
GROUP_REJECTED
GROUP_STARTING
```

### Localized notification content

While the notification `type` is language-neutral, the `title` and `message` fields must be localized based on the recipient's `preferredLocale`.

---

## Favorite

Authenticated users may save groups.

Conceptually:

```text
userId
groupId
createdAt
```

There should be a uniqueness constraint preventing duplicate favorites.

---

## Review

Reviews should only be possible when the product can establish a legitimate relationship between reviewer and group/therapist.

Do not allow arbitrary public reviews.

### Multilingual reviews

Reviews contain user-generated text that may be in any language.

Consider storing the review language alongside the content to:

- Display language badges
- Filter reviews by language
- Provide translation suggestions

---

## Report

Users may report problematic groups or therapists.

Conceptually:

```text
id
reporterId
entityType
entityId
reason
description
status
createdAt
updatedAt
```

---

## EmailEvent

Transactional email delivery must be auditable without storing unnecessary sensitive content.

Conceptually:

```text
id
type
recipient
locale
entityId
providerId
status
sentAt
error
createdAt
```

### locale

The language in which the email was sent.

- Captured at send time based on the recipient's `preferredLocale`
- Used for auditing and debugging
- Helps track which language versions of email templates are being used

Never store full sensitive application content in email logs.

---

## State transition rules

Business state changes must happen in domain/service code.

Do not allow clients to arbitrarily set:

```text
status
role
verificationStatus
ownership
preferredLocale (only the user themselves can change this)
```

The server determines valid transitions.

---