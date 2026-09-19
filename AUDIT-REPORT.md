# 🔍PsyGroup — Production Readiness Audit Report

**Date:** September 19, 2026  
**Scope:** Full codebase audit — architecture, security, performance, database, API, typing, SEO, i18n, UI/UX, config, tests, docs  
**Method:** 5 parallel audit agents + manual verification  

---

## 1. Критические проблемы (блокируют продакшен) — P0

| # | Категория | Файл | Проблема | Риск |
|---|-----------|------|----------|------|
| 1 | **Tests** | `tests/` | **Ноль тестов.** Vitest, Playwright, @nuxt/test-utils установлены, но ни одного тестового файла нет. Критичная бизнес-логика (auth, permissions, application lifecycle, group status transitions) не покрыта. | Без тестов любой рефакторинг или фикс может сломать продакшен незаметно |
| 2 | **DB/Schema** | `database/schema.prisma:225` | `Application → Group` relation не имеет `onDelete`. Удаление группы с заявками упадёт с foreign key violation. | Потеря возможности удалять группы |
| 3 | **DB/Query** | `server/repositories/groupRepository.ts:97` | `findUnique` вызывается с relation filter (`activeOrganizerFilter`). Prisma `findUnique` принимает только `@id`/`@unique` поля — это runtime ошибка. | Страница группы не загружается |
| 4 | **Security** | `server/api/auth/login.post.ts`, `register.post.ts` | Нет rate limiting на auth endpoints. Брутфорс паролей и масс-регистрация не ограничены. | Компрометация аккаунтов |
| 5 | **Legal** | `app/pages/[locale]/privacy.vue:55`, `terms.vue:51` | `TODO: review with lawyer before production` — юридический контент не проверен. | Юридические риски |
| 6 | **Performance** | `server/repositories/groupRepository.ts:73` | `findPublished()` не имеет pagination. Возвращает ВСЕ опубликованные группы. При росте каталога — деградация. | Unbounded query |
| 7 | **Performance** | `server/api/admin/groups.get.ts` | Admin endpoint без pagination, с тяжёлыми nested includes. | Unbounded query |

---

## 2. Серьёзные проблемы (сильно влияют на качество) — P1

| # | Категория | Файл | Проблема | Влияние |
|---|-----------|------|----------|---------|
| 8 | **Architecture** | `server/api/groups/[slug].patch.ts` | ~220 строк бизнес-логики inline (auth, validation, field mapping, question CRUD, co-organizer CRUD, notifications). Нарушение layered architecture. | Неподдерживаемый код |
| 9 | **i18n** | `server/utils/notifications.ts` (lines 76-117) | ВСЕ тексты уведомлений захардкожены на украинском. Билингвальный проект присылает уведомления только на UA. | Неправильный UX для EN пользователей |
| 10 | **i18n** | `server/api/admin/organizer-profiles/[id].patch.ts:68-75` | Хардкод `'Профіль верифіковано'` / `'Профіль відхилено'` в уведомлениях. | Тот же |
| 11 | **Security** | `nuxt.config.ts` | Нет security headers (CSP, X-Frame-Options, X-Content-Type-Options). Нет CORS конфигурации. | Уязвимость к clickjacking, XSS |
| 12 | **Security** | `server/api/auth/register.post.ts:135` | Error response включает raw database/Supabase error message. Утечка внутренних деталей. | Information disclosure |
| 13 | **Security** | `server/api/auth/google.post.ts:32` | Возвращает email в error response (`account_not_found` + email). User enumeration. | Privacy violation |
| 14 | **A11y** | `app/pages/[locale]/notifications.vue:144` | `<div @click>` без role, tabindex, keyboard handler. Не доступен с клавиатуры. | WCAG violation |
| 15 | **A11y** | `app/pages/[locale]/auth/register.vue:431`, `login.vue:252` | `outline: none` на `:focus` без замены. Невидимый фокус. | WCAG violation |
| 16 | **CSS** | `variables.css` | `--font-weight-semibold` используется в 16 файлах, но **не определён** в variables.css. | Невалидный CSS |
| 17 | **CSS** | `variables.css` | `--color-primary-light` (UiTabs), `--color-primary-rgb` (group edit) — используются, но не определены. | Невалидный CSS |
| 18 | **Config** | `.env.example` | Отсутствуют: `RESEND_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SITE_URL`. | Неполная документация |
| 19 | **Config** | `nuxt.config.ts` | Нет `runtimeConfig`. Env vars accessed directly via `process.env` — нет type-safe доступа и валидации. | Нет validation env vars |
| 20 | **Performance** | `server/api/groups/[slug]/apply.post.ts:9,128` | Два отдельных запроса к одной группе. Второй можно eliminate через include в первом. | Лишняя латентность |
| 21 | **Performance** | `server/utils/auth.ts:15` | `getUser()` fetches full organizer profile (25+ полей) на каждый auth request, даже когда профиль не нужен. | Лишняя нагрузка на DB |
| 22 | **Performance** | `app/pages/[locale]/admin/index.vue` | 1343 строки, все табы загружаются eagerly. Нет lazy loading. | Тяжёлый бандл |
| 23 | **DB/Schema** | `database/schema.prisma:306-307` | `Review` model — нет `onDelete` на трёх relations. Удаление любого entity упадёт. | FK violation |
| 24 | **Performance** | `server/routes/sitemap.xml.ts` | Sitemap генерируется на каждый запрос без кэширования. 3 Prisma queries + string building. | Нагрузка при росте |
| 25 | **README** | `README.md` | Всё ещё шаблон Nuxt starter. Нет описания проекта, env vars, database setup, deployment. | Непрофессионально |
| 26 | **Types** | `types/index.ts` | `Group` vs `SectionGroup` — разные имена полей (`avatarUrl` vs `avatar`), требует unsafe cast. | Runtime bugs |
| 27 | **Types** | `types/index.ts` | Nullable Prisma поля (`format`, `startsAt`, `capacity`) mapped to non-nullable TS types. | Type mismatch |
| 28 | **SEO** | `app/pages/[locale]/organizers/[slug].vue:63` | Хардкод `'Організатор' : 'Organizer'` в SEO title. | SEO inconsistency |
| 29 | **i18n** | `app/components/layout/InfoPageLayout.vue:11` | Хардкод `'вересень 2026'` — дата на украинском для всех локалей. | Неправильный UX |
| 30 | **i18n** | `app/components/layout/PageLoader.vue:16` | `aria-label="Завантаження"` — захардкожен. | Неправильный UX |
| 31 | **i18n** | `app/components/ui/UiSelect.vue:15` | Placeholder `'Оберіть...'` — захардкожен. | Неправильный UX |
| 32 | **Security** | `server/api/groups/[slug].patch.ts:130-133` | После Zod валидации, `rawBody.organizerId` читается напрямую, bypassing validation. | Validation bypass |
| 33 | **Mobile** | `app/pages/[locale]/admin/index.vue` | Нет `@media` queries. Сложная табличная вёрстка сломается на мобильных. | Broken layout |
| 34 | **Dead code** | `app/components/features/GroupSearch.vue` | Полностью неиспользуемый компонент (0 references). Orphaned i18n keys. | Мёртвый код |
| 35 | **Dead code** | `server/validators/group.ts` | `publishGroupSchema` и `createDraftSchema` определены, но нигде не импортируются. | Мёртвый код |
| 36 | **Dead code** | `database/schema.prisma:132` | `OrganizerProfile.avatar` — deprecated колонка рядом с `avatarUrl`. | Dead column |
| 37 | **Dead code** | `database/schema.prisma:188` | `Group.price` — явно помечен `// deprecated` рядом с `priceAmount`. | Dead column |

---

## 3. Средние проблемы (ухудшают качество кода) — P2

| # | Категория | Файл | Проблема |
|---|-----------|------|----------|
| 38 | **Architecture** | `server/api/admin/groups/[id].patch.ts` | Status transition rules + notifications inline. Should be in service. |
| 39 | **Architecture** | `server/api/admin/organizer-profiles/[id].patch.ts` | Verification logic + notification inline. |
| 40 | **Architecture** | `server/api/groups/[slug]/apply.post.ts` | Answer validation logic inline. |
| 41 | **Architecture** | `server/api/admin/applications.get.ts` | Complex aggregation inline. |
| 42 | **Architecture** | `app/components/layout/AppHeader.vue` | Notification polling (30s interval) в компоненте. Should be composable. |
| 43 | **Architecture** | Repository pattern | Только 1 repository (`groupRepository.ts`). Все остальные entities обращаются к Prisma напрямую из API handlers. |
| 44 | **Security** | `shared/utils/permissions.ts` | `application.create`, `application.viewMyApplications`, `organizer.profile.edit` — permissions определены, но не enforce в endpoints. |
| 45 | **Security** | `server/utils/slugify.ts:19` | `Math.random()` для slug suffix — не cryptographically secure. |
| 46 | **Security** | `server/api/organizers/avatar.post.ts` | Any authenticated user can upload avatar — нет проверки ORGANIZER role. |
| 47 | **Performance** | `app/pages/[locale]/index.vue:36` | Static `useFetch` key `'home-filter-count'` с reactive query — cache collision. |
| 48 | **Performance** | `app/pages/[locale]/catalog/index.vue:56` | Same: static key `'groups'` с reactive query. |
| 49 | **Performance** | `app/pages/[locale]/admin/index.vue:237` | No debounce на filter input — API call на каждый keystroke. |
| 50 | **Performance** | `server/api/favorites/my.get.ts` | Over-fetches via `include` вместо `select`. |
| 51 | **Performance** | `server/api/admin/organizers.get.ts`, `admin/users.get.ts` | Нет pagination. |
| 52 | **Types** | `useSeoPage.ts` | 12 instances `as any` — полностью обходит type safety для SEO meta tags. |
| 53 | **Types** | `profile/edit.vue:87-104` | 18 `as string/number` casts из `Record<string, unknown>`. |
| 54 | **Types** | `useGroupForm.ts:181-208` | 15+ `as string` casts из untyped API response. |
| 55 | **Types** | Multiple pages | `method: 'DELETE' as any`, `method: 'PATCH' as any` на `$fetch` calls. |
| 56 | **Types** | `types/index.ts` | `Notification.read: boolean` vs Prisma `readAt: DateTime?` — field name/type mismatch. |
| 57 | **DB/Schema** | `database/schema.prisma:301` | `Review.status` — String вместо enum. |
| 58 | **DB/Schema** | `database/schema.prisma:210` | `GroupCoOrganizer.role` — String вместо enum. |
| 59 | **DB/Schema** | Redundant indexes | `@@index` на полях с `@unique` (User.email, User.authId, Group.slug, etc.) — redundant. |
| 60 | **CSS** | 82 hex colors hardcoded | Статусные цвета (`#FEF3C7`, `#D1FAE5`, `#FEE2E2`...) дублируются в 5+ файлах. |
| 61 | **A11y** | 10+ components | `outline: none` на `:focus` без adequate replacement (UiInput, UiSelect, UiTextarea, etc.). |
| 62 | **Error states** | 7 pages | Missing error states: favorites, applications/my, profile/index, notifications, groups/my, admin/index. |
| 63 | **Config** | `package.json` | `playwright` дублирует `@playwright/test`. |
| 64 | **Config** | `package.json` | Missing scripts: `test:e2e`, `typecheck`. |
| 65 | **i18n** | `~20+ Russian comments` | Комментарии на русском в server code (должны быть на английском). |
| 66 | **Overengineering** | `useGroupForm.ts` | Duplicated payload construction в autosave и flushSave. |
| 67 | **SEO** | 13 private pages | Bypass `useSeoPage()`, используют `useHead()` напрямую — нет hreflang, canonical. |
| 68 | **Docs** | No JSDoc | Services, repositories, composables — ни одного JSDoc комментария. |
| 69 | **Hardcoded** | `server/routes/sitemap.xml.ts:5` | `baseUrl = 'https://psygroup.org'` — should be env variable. |
| 70 | **Security** | `server/api/admin/users.get.ts` | Returns only VISITOR users — misses ORGANIZER. Looks like a bug. |

---

## 4. Мелкие проблемы (косметика, code style) — P3

| # | Файл | Проблема |
|---|------|----------|
| 71 | `server/api/auth/logout.post.ts` | Нет auth check (возвращает success для неавторизованных). |
| 72 | `server/api/auth/google.post.ts` | Нет Zod валидации body (только manual null-check). |
| 73 | `server/api/auth/register.post.ts:131` | `console.error` logs full error object. |
| 74 | `types/drawer.ts` | UI types в root `types/` вместо `app/types/`. |
| 75 | `shared/utils/groupTypeSlug.ts` | Re-export shim — 9 файлов импортируют через него. |
| 76 | `types/index.ts` | Нет типов для Review, Report, EmailEvent, Favorite, GroupCoOrganizer. |
| 77 | `nuxt.config.ts:15-16` | Default title/description только на украинском. |
| 78 | `app/pages/[locale]/index.vue:114` | TODO comment — feature placeholder. |
| 79 | `app/pages/[locale]/groups/[slug].vue:3` | Unnecessary `import { NuxtLink } from '#components'` — auto-imported. |
| 80 | `database/seed.ts` | Only 2 of 10 groups have questions, no applications created. |
| 81 | `app/components/features/GroupFilters.vue:317` | `font-size: 11px` — нет token. |
| 82 | `server/validators/group.ts` | Comments in Russian. |
| 83 | `app/pages/[locale]/profile/edit.vue:342,402` | English `Remove` in aria-labels not localized. |
| 84 | `server/api/admin/organizers/[id]/toggle-active.post.ts` | POST для toggle — PATCH был бы RESTful. |
| 85 | `profile/index.vue` | Нет `@media` queries. |

---

## 5. Рекомендации по рефакторингу

### 5.1. Критический рефакторинг

1. **`server/api/groups/[slug].patch.ts` (220 lines)** → Вынести в `groupService.ts`:
   - `updateGroup()` — field mapping + Prisma update
   - `updateGroupQuestions()` — question CRUD
   - `updateGroupCoOrganizers()` — co-organizer CRUD
   - Handler должен остаться ~20 строк: auth → validate → call service → return

2. **`server/api/admin/applications.get.ts`** → Вынести aggregation в `applicationService.ts`

3. **`app/pages/[locale]/admin/index.vue` (1343 lines)** → Разделить на компоненты по табам:
   - `AdminGroupsTab.vue`
   - `AdminOrganizersTab.vue`
   - `AdminApplicationsTab.vue`
   - `AdminUsersTab.vue`

### 5.2. Средний рефакторинг

4. **`server/utils/notifications.ts`** → Перевести на i18n ключи + per-user locale resolution
5. **`app/components/layout/AppHeader.vue`** → Extract `useNotifications()` composable
6. **`app/composables/useGroupForm.ts`** → Extract `buildPayload()` helper
7. **`types/index.ts`** → Unify `Group` / `SectionGroup` / `OrganizerGroup` в базовый тип
8. **`server/repositories/`** → Создать repositories для Application, Organizer, User, Notification

### 5.3. Мелкий рефакторинг

9. **Удалить `GroupSearch.vue`** + orphaned i18n keys
10. **Удалить `publishGroupSchema` и `createDraftSchema`** из validators
11. **Удалить deprecated поля** `avatar` и `price` из schema (после миграции)
12. **Удалить `playwright`** из devDependencies (дублирует `@playwright/test`)

---

## 6. Что работает хорошо ✅

| Область | Что хорошо |
|---------|-----------|
| **Auth/Permissions** | Чёткая система: `getUser()` → `requireAuth()` → `requireRole()` → `requirePermission()`. Centralized permission definitions. IDOR protection на всех checked endpoints. |
| **Cookie security** | `httpOnly: true`, `sameSite: 'lax'`, `secure` в production. Service role key только на сервере. |
| **Localization structure** | 520 ключей ua ↔ en — идеально синхронизированы. 56 SEO ключей — тоже. Middleware корректно работает с cookie priority. |
| **SEO** | `useSeoPage()` composable — централизованный SEO с hreflang, OG, canonical, JSON-LD. Sitemap с hreflang alternates. FAQPage, Event, Person, ItemList structured data. |
| **Component architecture** | 15 UI primitives (UiButton, UiInput, etc.) используются консистентно. Нет дубликатов. BEM naming. Scoped styles. |
| **No XSS** | Нет `v-html`, нет raw HTML rendering. Vue auto-escaping. |
| **No SQL injection** | Нет raw SQL. Все через Prisma query builder. |
| **No secrets in code** | Нет hardcoded API keys/passwords. `.env` в `.gitignore`. |
| **Validation** | Zod schemas на большинстве mutation endpoints. Хорошая валидация answers в apply.post.ts. |
| **Page loading** | Консистентный паттерн `usePageLoading` с counter-based system. 200ms delay prevents flicker. |
| **Semantic HTML** | Нет `<div @click>` (кроме notifications — одна ошибка). Правильные button/link semantics. |
| **v-for keys** | Все `v-for` имеют `:key`. |
| **Sitemap** | Full coverage: static pages, dynamic groups, organizers, type catalogs. hreflang + x-default. |
| **Documentation** | 21 docs файл покрывает architecture, auth, API, CSS, i18n, security, SEO, testing, etc. |
| **ESLint config** | Строгие правила: no-semi, single-quotes, Vue block order, self-closing tags, no-console warn. |
| **Prisma schema** | Хорошие индексы, правильные enums для основных статусов, cascade deletes на большинстве relations. |
| **Server structure** | Thin handlers (большинство <40 строк), validators отделены, utils organized. |

---

## 7. Статистика

| Метрика | Значение |
|---------|----------|
| Файлов проанализировано | **144** (source files, excluding generated) |
| Строк кода | **~20,637** (excluding generated) |
| Компонентов | 40 |
| Composables | 8 |
| Страниц | 24 |
| API endpoints | 42 |
| Repositories | 1 |
| Services | 1 |
| Validators | 4 (6 schemas) |
| Prisma models | 14 |
| Миграций | 23 |
| Локализационных ключей | 520 (ua) + 520 (en) + 56 (seo ua) + 56 (seo en) = **1,152** |
| Покрытие тестами | **0%** |
| | |
| **Критических проблем (P0)** | **7** |
| **Серьёзных проблем (P1)** | **30** |
| **Средних проблем (P2)** | **33** |
| **Мелких проблем (P3)** | **15** |
| **Всего найдено** | **85** |

---

## 8. Чеклист проверки полноты

- [x] Все 42 API endpoints — проверены на auth, validation, response format
- [x] Все 24 страницы — проверены на SEO, loading states, i18n
- [x] Все 8 composables — проверены на типизацию, использование
- [x] Все 40 компонентов — проверены на unused, hardcoded strings, a11y
- [x] Все 1 repository — проверен на N+1, pagination, select vs include
- [x] Все 4 validators — проверены на полноту, использование
- [x] Все 14 моделей Prisma — проверены на типы, индексы, cascade
- [x] Все 23 миграции — просмотрены
- [x] Все 1,152 ключа локализации — проверена синхронизация ua ↔ en
- [x] `.env.example` — проверен на полноту
- [x] `nuxt.config.ts` — проверен на production readiness
- [x] `package.json` — проверен на dependencies
- [x] Security headers — проверены
- [x] CSS variables — проверены на определённые/неопределённые

---

## 9. Не проверено

| Что | Причина |
|-----|---------|
| `npm audit` | Не запускался — требует network access |
| Bundle size analysis | Не запускался `nuxt analyze` |
| Lighthouse performance | Требует running server |
| E2E тесты | Нет ни тестов, ни `playwright.config.ts` |
| Supabase RLS policies | Требует access к Supabase dashboard |
| Email delivery | Требует RESEND_API_KEY |
| Google OAuth flow | Требует Google credentials |
| Production build | Не запускался `npm run build` |
| Type checking | Не запускался `vue-tsc --noEmit` |

---

*Report generated by 5 parallel audit agents + manual verification. Total analysis time: ~15 minutes.*
