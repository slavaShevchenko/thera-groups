# Psychotherapy Groups Catalog — Production Ready State

## Поточний стан
- Гілка: refactor-v1
- Останні коміти: 6fab16a, 27b215d
- 12 хвиль рефакторингу пройдено (19 вересня 2026)
- 222 passing tests, 0 typecheck/lint помилок
- Production-ready до деплою

## Архітектура
- Frontend: Nuxt 4.5.2, Vue 3, TypeScript strict
- Backend: Nitro 2.13.4, Prisma 7.10, Supabase (Postgres)
- Шари: UI → composables → API handlers → services → repositories → Prisma
- Права: shared/utils/permissions.ts з can() enforcement
- Помилки: domain errors → mapDomainError → sanitizeError
- Rate limit: Postgres-backed через rate-limiter-flexible

## Що працює
- Каталог груп з фільтрами, пошуком, пагінацією
- Створення і редагування груп організаторами
- Модерація груп і профілів адмінами
- Система заявок (create, approve, reject, withdraw) з capacity check
- Автентифікація (email + Google OAuth через Supabase)
- i18n (ua/en), SEO (hreflang=uk, sitemap, robots.txt, JSON-LD)
- Email нотифікації через Resend (базовий)
- Admin panel з 5 вкладками
- Accessibility WCAG 2.1 AA

## Що НЕ зроблено
- E2E тести — свідоме рішення, не треба
- Resend email templates — базові, не брендовані
- Payment integration — відсутня
- Real-time notifications — polling 30s
- Admin email notifications — тільки in-app
- Full-text search з pg_trgm — базовий LIKE

## Наступні кроки (пріоритет)
1. **Деплой на Vercel + Neon/Supabase**
2. ⚖️ Юрист для privacy/terms (TODO залишились)
3. 🌍 Native speaker review en.json
4. 📧 Resend: брендовані HTML-шаблони, tracking, retry
5. 📱 Manual mobile + a11y testing на реальних пристроях
6. 📈 Sentry + Vercel Analytics

## Критичне для деплою
- `NUXT_PUBLIC_SITE_URL` має бути встановлений ДО build (не runtime)
- Supabase Root CA закріплений в server/utils/prisma.ts
- Seed має guard проти production (NODE_ENV, allowlist хостів, підтвердження)
- `npx prisma migrate deploy` перед першим стартом на новому env
- TEST_DATABASE_URL для інтеграційних тестів (опціонально)

## Відомі обмеження
- Rate limiting per-instance на Vercel serverless (Redis потрібен для production scale)
- Resend email sending synchronous (no retry queue)
- Image upload: magic bytes check, без virus scanning
- Admin action logging: базове console.error, без audit trail

## Файлова структура
app/
├── components/ (ui/, features/, admin/, catalog/, home/, layout/, sections/, forms/)
├── composables/ (8 штук)
├── pages/[locale]/ (24 pages)
├── utils/ (format, initials, backTo, languages)
└── assets/css/ (variables.css, fonts.css, animations.css)

server/
├── api/ (41 endpoint)
├── services/ (group, application, organizer)
├── repositories/ (group, application, organizer, user, notification, favorite)
├── validators/ (5 schemas)
└── utils/ (auth, errorHandler, rateLimit, slugify, notifications, etc.)

shared/
├── utils/ (permissions, groupTypeSlug, notificationRoutes)
└── constants/ (locales, limits, statusColors)

database/
├── schema.prisma (14 моделей, 11 enum)
├── migrations/ (30+ migrations)
└── seed.ts

docs/ (21 документи)