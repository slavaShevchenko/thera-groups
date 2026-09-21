# PsyGroup

Платформа для пошуку психотерапевтичних груп в Україні. Каталог верифікованих організаторів з онлайн та офлайн форматами.

## 🚀 Tech Stack

- **Frontend:** Nuxt 4, Vue 3, TypeScript
- **Styling:** Custom CSS with design tokens (BEM)
- **Database:** PostgreSQL via Supabase
- **ORM:** Prisma
- **Auth:** Supabase Auth
- **Email:** Resend
- **Testing:** Vitest, Playwright
- **Deployment:** Vercel

## 📦 Installation

### Prerequisites

- Node.js 20+
- PostgreSQL 15+ (або Supabase account)
- Resend account (для email)
- Google OAuth credentials (опціонально)

### Setup

1. Clone repository:

```bash
git clone <repo-url>
cd groupThera
```

2. Install dependencies:

```bash
npm install
```

3. Setup environment variables:

```bash
cp .env.example .env
```

Edit `.env` with your values:

- `DATABASE_URL` — PostgreSQL connection string
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — Supabase credentials
- `RESEND_API_KEY` — Resend API key
- `EMAIL_FROM` — sender email address
- `SITE_URL` — your domain (`http://localhost:3000` for dev)
- `ADMIN_EMAIL` — admin email for seed script
- `ADMIN_PASSWORD` — generate a secure password: `openssl rand -base64 32`

4. Run database migrations:

```bash
npx prisma migrate deploy
```

5. Seed initial data (creates admin user):

```bash
npm run db:seed
```

Default admin email: `admin@psygroup.local` (password is set via `ADMIN_PASSWORD` env variable)

6. Start development server:

```bash
npm run dev
```

Open http://localhost:3000

## 🏗️ Project Structure

```
.
├── app/
│   ├── components/       # Vue components
│   │   ├── ui/          # Reusable UI primitives (UiButton, UiInput, etc.)
│   │   ├── layout/      # Layout components (header, footer, page loader)
│   │   ├── features/    # Feature-specific components (GroupCard, GroupFilters)
│   │   └── forms/       # Form components (AvatarUploader, ApplicationForm)
│   ├── composables/     # Vue composables (useLocale, useGroupForm, etc.)
│   ├── pages/           # File-based routing ([locale]/...)
│   ├── layouts/         # Page layouts
│   ├── middleware/       # Route middleware (locale.global.ts)
│   ├── locales/         # i18n files (ua.json, en.json)
│   ├── plugins/         # Nuxt plugins
│   ├── utils/           # Client-side utilities
│   └── assets/          # CSS, images
├── server/
│   ├── api/             # API endpoints (H3)
│   ├── repositories/    # Database access layer
│   ├── services/        # Business logic
│   ├── validators/      # Zod schemas
│   ├── utils/           # Server utilities (auth, prisma, notifications)
│   └── middleware/      # API middleware
├── shared/
│   ├── constants/       # Shared constants (group types, etc.)
│   └── utils/           # Code shared between client/server
├── types/               # TypeScript type definitions
├── database/
│   ├── schema.prisma    # Prisma schema
│   ├── migrations/      # Database migrations
│   └── seed.ts          # Seed script
├── tests/
│   ├── unit/            # Vitest unit tests
│   ├── integration/     # Integration tests (with DB)
│   └── shared/          # Shared test utilities
└── docs/                # Project documentation
```

## 🧪 Testing

```bash
# Unit & integration tests
npm run test

# Run tests once (CI)
npm run test:run

# Type checking
npx vue-tsc --noEmit

# Linting
npm run lint
npm run lint:fix
```

## 🚀 Deployment

### Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. Link project: `vercel link`
3. Set environment variables in Vercel dashboard
4. Deploy: `vercel --prod`

### Database (Supabase)

Use connection pooling for serverless:

```
DATABASE_URL=postgresql://...:6543/postgres?pgbouncer=true
```

## 📝 Environment Variables

See `.env.example` for the full list of required variables.

## 🌍 Localization

Two locales supported: Ukrainian (`ua`) and English (`en`).

Locale files:

- `app/locales/ua.json`, `en.json` — UI strings

URL structure: `/ua/...`, `/en/...`

Locale priority: cookie → URL → default (`ua`).

## 🔒 Security

- Rate limiting on auth endpoints
- Security headers (CSP, HSTS, X-Frame-Options)
- Row Level Security in Supabase
- Input validation with Zod (server-side)
- Sensitive application data is never logged or exposed publicly

## 📄 License

Private. All rights reserved.

## 🤝 Contributing

1. Create feature branch
2. Make changes
3. Run tests: `npm run test`
4. Run typecheck: `npx vue-tsc --noEmit`
5. Submit PR

## 📧 Support

Email: support@psygroup.org
