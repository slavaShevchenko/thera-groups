# Security and Privacy

## Sensitivity

Psychotherapy applications may contain highly sensitive personal information.

Treat application data as sensitive by default.

## Data minimization

Store only what the product needs.

Do not collect a sensitive field merely because it might be useful later.

## Logging

Never log:

- passwords
- auth tokens
- secrets
- full application payloads
- custom application answers
- sensitive user messages

Logs should contain enough technical context to diagnose failures without exposing private content.

## Email

Do not send full application details by email.

Use notification emails such as:

```text
You received a new application.
Log in to review it.
```

## Access

Private application information requires authentication and authorization.

An organizer can access applications belonging to their own groups.

Admins may have broader access according to explicit policy.

## Client exposure

Never send secrets or private server configuration to the browser.

Only expose environment values intentionally marked as public.

## Third parties

Before sending user data to any third-party service, verify that it is necessary and permitted.

Analytics must not receive sensitive psychotherapy content.

## GDPR

The implementation must support applicable GDPR requirements, including appropriate:

- privacy notices
- consent where required
- deletion
- data access/export
- retention policies
- processor/vendor review

Exact legal requirements must be confirmed with appropriate legal advice.

## Rate limiting

Public application and authentication endpoints should be protected against abuse.

Do not invent an arbitrary rate limit without considering infrastructure and product requirements, but never leave sensitive public endpoints completely unprotected.

## Security principle

Never trust:

- browser state
- hidden inputs
- route params
- user IDs
- roles
- status fields
- ownership fields

Everything security-sensitive is verified server-side.
