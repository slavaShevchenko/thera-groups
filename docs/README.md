# Psychotherapy Groups Catalog — Documentation

Bilingual (UA/EN) platform where psychotherapy organizers create group events and visitors discover groups and submit applications without registration.

## Tech Stack

| Layer        | Technology                              |
|--------------|-----------------------------------------|
| Framework    | Nuxt 4, Vue 3, Composition API, `<script setup>` |
| Language     | TypeScript (strict)                     |
| Database     | PostgreSQL (Supabase)                   |
| ORM          | Prisma 7 with `@prisma/adapter-pg`     |
| Auth         | Supabase Auth (JWT)                     |
| Validation   | Zod (server), client mirrors for UX     |
| Email        | Resend                                  |
| Rate Limit   | `rate-limiter-flexible` (Postgres-backed) |
| Hosting      | Vercel                                  |
| Testing      | Vitest (unit/integration), Playwright (e2e) |
| Styling      | Plain CSS, BEM, CSS custom properties   |

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Fill in DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

# Generate Prisma client
npx prisma generate

# Apply migrations — never `migrate dev`, which offers to reset a shared database
npx prisma migrate deploy

# Seed database (dev only, has safety guards)
npm run db:seed

# Start dev server
npm run dev
```

## Documentation Index

| File | Description |
|------|-------------|
| [architecture.md](./architecture.md) | Layered architecture, data flow, error handling, permissions |
| [database.md](./database.md) | Models, enums, constraints, indexes, the real RLS posture, deprecated tables, migrations |
| [api.md](./api.md) | All API endpoints grouped by domain |
| [business-logic.md](./business-logic.md) | Group lifecycle, application flow, capacity, verification |
| [authentication.md](./authentication.md) | Supabase Auth, roles, sessions, verification |
| [permissions.md](./permissions.md) | Permission keys, `can()` function, role/resource checks |
| [security.md](./security.md) | Client IP resolution, rate limiting, email canonicalization, public read shape, race-safe seats, OAuth reconciliation, database security posture |
| [testing.md](./testing.md) | Vitest setup, coverage thresholds, integration tests |
| [configuration.md](./configuration.md) | Environment variables, Nuxt/Prisma config, build |
| [deployment.md](./deployment.md) | Vercel deployment, env setup, storage buckets, post-deploy checklist |
| [domain-rules.md](./domain-rules.md) | All business rules documented from code |
| [archive/](./archive/README.md) | Superseded audit reports, kept for history. Not a description of the current system |
