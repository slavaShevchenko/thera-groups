# Psychotherapy Groups Catalog — Полный аудит кодовой базы

**Дата:** 19 сентября 2026  
**Ветка:** `refactor-v1`  
**Коммит:** `dd30c97`

---

## Статистика кодовой базы

| Метрика | Значение |
|---------|----------|
| Всего файлов (src) | 168 |
| Строк кода | ~22 579 |
| Строк тестов | 1 704 |
| API endpoints | 42 |
| Страниц | 24 |
| Компонентов | 44 |
| Composables | 8 |
| Repositories | 5 |
| Validators (Zod) | 4 |
| Моделей Prisma | 14 |
| Миграций | 26 |
| Ключей локализации | 577 (521 + 56 SEO) |
| Приблизительное покрытие тестами | ~7.5% (по строкам) |

---

## 1. Критические проблемы (блокируют продакшен) — P0

| # | Проблема | Файл | Риск | Рекомендация |
|---|----------|------|------|--------------|
| 1 | **Нет rate limiting на подаче заявки** — любой IP может отправить сотни заявок с чувствительными данными психотерапии | `server/api/groups/[slug]/apply.post.ts` | Спам, abuse, утечка чувствительных данных | Добавить `applicationLimiter` (5-10 запросов / 15 мин на IP) |
| 2 | **robots.txt не блокирует приватные страницы** — все `Disallow` пути без локального префикса (`/groups/my` вместо `/ua/groups/my`), поисковики индексируют приватные страницы | `public/robots.txt` | Индексация приватных страниц (группы, заявки, профиль, админ) в Google | Изменить на `Disallow:/*/groups/my`, `Disallow:/*/auth/` и т.д. |
| 3 | **Юридический TODO** — тексты privacy policy и terms of use не проверены юристом | `app/pages/[locale]/privacy.vue:55`, `terms.vue:51` | Юридическая ответственность | Проверить тексты с юристом перед продакшеном |

---

## 2. Серьёзные проблемы (сильно влияют на качество) — P1

| # | Проблема | Файл | Влияние | Рекомендация |
|---|----------|------|---------|--------------|
| 4 | **Сервисы bypass-ят repositories** — все 3 сервиса (`groupService`, `applicationService`, `organizerService`) вызывают `prisma` напрямую (~35 раз), нарушая layered architecture | `server/services/*.ts` | Невозможно централизованно менять data access, сложно тестировать | Перенести Prisma-запросы из сервисов в соответствующие repositories |
| 5 | **18+ API handlers с прямым доступом к Prisma** — handlers делают запросы напрямую, минуя services/repositories | `server/api/groups/*.ts`, `server/api/admin/*.ts`, `server/api/organizers/*.ts` и др. | Бизнес-логика размазана по handler-ам, дублирование, сложно поддерживать | Вынести в services/repositories по аналогии с `groups/[slug].patch.ts` |
| 6 | **Нет e2e тестов** — `@playwright/test` установлен, но нет ни конфига, ни тестов | — | Критичные user flows (создание группы, подача заявки, авторизация) не покрыты | Создать `playwright.config.ts` и добавить e2e тесты |
| 7 | **Нет тестов API endpoints** — все 42 handler-а не имеют HTTP-уровневых тестов | `server/api/` | Не проверяется авторизация, валидация и форматы ответов на границе API | Добавить тесты хотя бы для auth и критичных CRUD endpoints |
| 8 | **Нет тестов organizerService** — третий сервис полностью не покрыт | `server/services/organizerService.ts` | Профили организаторов, верификация, аватары — без тестов | Добавить тесты по образцу `groupService.test.ts` |
| 9 | **Нет тестов auth utilities** — JWT, сессии, rate limiting не покрыты | `server/utils/auth.ts`, `server/utils/rateLimit.ts` | Security-критичный код без тестов | Добавить unit-тесты |
| 10 | **RLS не используется** — весь доступ через Prisma с `service_role` ключом, который bypass-ит RLS. Нет defense-in-depth на уровне БД | Все database access | При компрометации service_role ключа — полный доступ ко всем данным | Включить RLS на чувствительных таблицах (Application, Notification, Favorite, User) |
| 11 | **CSP `unsafe-inline` в script-src** — ослабляет защиту от XSS | `server/plugins/csp.ts` | XSS-атаки не блокируются CSP для inline скриптов | Заменить на nonce-based approach |
| 12 | **Дублируются hreflang теги** — `app.vue` и `useSeoPage()` оба вызывают `useLocaleHead()`, добавляя двойной набор hreflang | `app/app.vue`, `app/composables/useSeoPage.ts` | Поисковики могут игнорировать hreflang сигналы | Убрать вызов из одного места |
| 13 | **Email-адреса организаторов доступны любому авторизованному пользователю** — `organizers/search.get.ts` возвращает email без проверки роли | `server/api/organizers/search.get.ts` | Утечка PII (email) | Ограничить доступ до ORGANIZER/ADMIN или убрать email из ответа |
| 14 | **`Review.status` — String вместо enum** — нет DB-level constraint | `database/schema.prisma` | Возможны невалидные значения | Создать `ReviewStatus` enum |
| 15 | **~21 `as any` в коде** — 12 в `useSeoPage.ts`, 5 в Vue pages, остальные в composables | `app/composables/useSeoPage.ts`, `app/pages/[locale]/groups/my.vue`, `groups/edit/[slug].vue` | Обходит TypeScript, скрывает ошибки типов | Определить правильные типы для `useHead()` meta, `$fetch` methods |
| 16 | **Типы в `types/index.ts` рассинхронизированы с Prisma** — nullable поля типизированы как required, enum-ы как `string`, `Decimal` как `number` | `types/index.ts` | Ошибки типов на клиенте, неверные предположения о данных | Обновить типы по Prisma schema |
| 17 | **ESLint глобально отключает `no-explicit-any`** — blanket disable вместо точечных suppressions | `eslint.config.mjs:49` | `any` типы беспрепятственно проникают в код | Убрать глобальное отключение, использовать `eslint-disable-next-line` точечно |
| 18 | **N+1 в `groupService.updateGroup`** — `for` цикл с individual `prisma.applicationQuestion.create` | `server/services/groupService.ts:~131-148` | 10+ отдельных DB round-trips для вопросов группы | Заменить на `createMany()` |
| 19 | **Дублированный запрос в `applicationService.create`** — группа запрашивается дважды | `server/services/applicationService.ts:~79-91` | Лишний DB round-trip на каждой подаче заявки | Включить нужные поля в первый запрос |
| 20 | **Нет default pagination limit в `groupRepository.findPublished`** — если caller не передаст `take`, вернётся ВСЁ | `server/repositories/groupRepository.ts` | Неограниченный запрос, memory issues | Добавить default `take: 100` |
| 21 | **Дублированные индексы** — `@@index` на полях с `@unique` (User.email, Group.slug, GroupTag.slug, OrganizerProfile.userId) | `database/schema.prisma` | Лишние индексы, замедление writes | Убрать дублирующиеся `@@index` |
| 22 | **`Group.priceAmount` — `DECIMAL(65,30)`** — абсурдная точность для валюты | `database/schema.prisma`, миграция `20260919125336` | 30 знаков после запятой для денег бессмысленны | Использовать `Decimal @db.Decimal(10,2)` |

---

## 3. Средние проблемы (ухудшают качество кода) — P2

| # | Проблема | Файл | Влияние | Рекомендация |
|---|----------|------|---------|--------------|
| 23 | **Админ-компоненты содержат бизнес-логику** — `AdminGroupsTab`, `AdminApplicationsTab`, `AdminProfilesTab` содержат ~170+ строк логики | `app/components/admin/*.vue` | Нарушение разделения ответственности | Вынести в composables (`useAdminGroups()`, `useAdminApplications()`) |
| 24 | **Страницы с inline бизнес-логикой** — `groups/[slug].vue` (JSON-LD, permissions, price formatting), `groups/edit/[slug].vue` (publishing workflow) | `app/pages/[locale]/groups/` | Компоненты страниц перегружены | Вынести в composables (`useGroupPage()`, `useGroupEdit()`) |
| 25 | **43 пустых `catch {}` блока** — silent error swallowing по всему клиентскому коду | `app/` (43 файла) | Пользователь не видит ошибок, сложно дебажить | Добавить минимальное логирование или UI-нотификации |
| 26 | **9 GET endpoints без Zod валидации query params** — `groups.get`, `organizers.get`, `organizers/search`, `admin/applications.get`, `admin/organizers.get`, `admin/users.get`, `admin/groups.get`, `groups/latest.get`, `groups/[slug]/applications.get` | `server/api/` | Невалидные значения молча игнорируются или вызывают 500 | Добавить Zod schemas для query params |
| 27 | **Неконсистентный формат ответов API** — некоторые endpoints оборачивают в `{ success: true, ... }`, другие возвращают сырые данные | `server/api/` | Сложно предсказать формат ответа | Стандартизировать response envelope |
| 28 | **Неконсистентный формат ошибок API** — нет machine-readable `code` поля, разные структуры | `server/api/` | Клиенту сложно обрабатывать ошибки программно | Добавить `{ error: { code, message, details? } }` |
| 29 | **2 inline Zod schemas в admin handlers** — должны быть в `server/validators/` | `server/api/admin/groups/[id].patch.ts`, `admin/organizer-profiles/[id].patch.ts` | Непоследовательная структура | Перенести в `server/validators/` |
| 30 | **Дублированные функции** — `formatPrice` (2 копии), `formatDate` (3 копии), `toLocalInputValue` (2 копии) | `GroupCard.vue`, `groups/[slug].vue`, `profile/index.vue`, `AdminApplicationsTab.vue`, `useGroupForm.ts`, `groups/edit/[slug].vue` | Code duplication | Перенести в `app/utils/format.ts` |
| 31 | **Дублированные типы** — 5 overlapping group interfaces, 3 co-organizer interfaces | `types/index.ts` | Путаница, рассинхронизация | Консолидировать через base type + `Pick`/`Omit` |
| 32 | **`Record<string, unknown>` вместо Prisma типов** — 5+ мест в server code | `server/api/groups/my.get.ts`, `admin/groups.get.ts`, `organizers/index.get.ts`, `repositories/groupRepository.ts` | Потеря type safety | Использовать `Prisma.GroupWhereInput` и аналоги |
| 33 | **Over-fetching в каталоге** — `findPublished` включает полные tags, descriptions, co-organizers для спискового просмотра | `server/repositories/groupRepository.ts`, `server/api/groups.get.ts` | Лишние данные в ответе, медленнее загрузка | Использовать `select` вместо `include` для списков |
| 34 | **`@iconify/vue` в бандле** — полный Iconify runtime загружается eagerly | `app/components/ui/UiIcon.vue` | Увеличивает initial bundle size | Перейти на Nuxt built-in icon module с `@iconify-json/lucide` |
| 35 | **Дублированные ключи локализации** — `common.cancel`/`common.actions.cancel`, `common.close`/`common.actions.close`, `common.noResults`/`noResults`/`filters.noResults`, `groups.my.confirmDelete`/`groups.edit.confirmDelete` | `app/locales/ua.json`, `en.json` | 8+ дубликатов, путаница | Консолидировать дубликаты |
| 36 | **Хардкод строк** — email-адреса в contacts/privacy, URL placeholders в profile/edit, error messages в AvatarUploader, alt text в UiLogo | 6 файлов | Невозможно перевести/изменить через локализацию | Перенести в locale файлы |
| 37 | **SEO titles слишком короткие** — большинство 23-45 chars вместо 50-60 | `seo.ua.json`, `seo.en.json` | Недоиспользование SERP пространства | Расширить titles |
| 38 | **SEO descriptions слишком короткие** — большинство 43-120 chars вместо 150-160 | `seo.ua.json`, `seo.en.json` | Недоиспользование SERP пространства | Расширить descriptions |
| 39 | **Хардкод English fallback в nuxt.config.ts** — title и description только на английском | `nuxt.config.ts:22` | Украинские посетители/краулеры видят English | Сделать bilingual или locale-aware |
| 40 | **Canonical URL fallback не обрабатывает пустую строку** — `??` не срабатывает на `''` | `app/composables/useSeoPage.ts:20` | Пустой canonical tag на динамических страницах | Изменить на `\|\|` вместо `??` |
| 41 | **Auth pages дублируют input стили** — ~80 строк кастомных input стилей вместо использования `UiInput` | `app/pages/[locale]/auth/login.vue`, `register.vue` | Визуальная несогласованность, дублирование CSS | Мигрировать на `UiInput`/`UiTextarea` |
| 42 | **Хардкод цветов** — `#4a7c8f`, `rgba(217,83,79,0.1)` и другие вместо CSS переменных | `UsersTable.vue`, `OrganizersTable.vue`, `profile/edit.vue`, `login.vue` | Непоследовательность дизайн-системы | Заменить на CSS переменные из `variables.css` |
| 43 | **Rate limiter использует `RateLimiterMemory`** — per-process, не работает при масштабировании | `server/utils/rateLimit.ts` | В multi-instance deployment лимиты не работают корректно | Мигрировать на `RateLimiterPostgres` |
| 44 | **`application.create` permission определена но не enforced** — `ctx => !!ctx.user` в permissions.ts, но apply endpoint не проверяет | `shared/utils/permissions.ts:53`, `server/api/groups/[slug]/apply.post.ts` | Ложное чувство безопасности | Либо enforcing, либо удалить/обновить определение |
| 45 | **Дублирование routeRules** — `'/'` redirect определён и в `routeRules`, и в `nitro.routeRules` | `nuxt.config.ts:62-67` | Дублированная конфигурация | Убрать из одного места |
| 46 | **`compatibilityDate` устарел** — `2024-11-01` при Nuxt 4.5.2 | `nuxt.config.ts:74` | Возможные deprecation warnings | Обновить до актуальной даты |
| 47 | **Админ-таблицы без `aria-label`** — `<table>` элементы не имеют описания для screen readers | `OrganizersTable.vue`, `UsersTable.vue` | A11y нарушение | Добавить `aria-label` |
| 48 | **Несколько API endpoints с не-RESTful методами** — `toggle-active.post` (не идемпотентный), `verify.post` (state transition через POST) | `server/api/admin/organizers/[id]/` | Несоответствие REST конвенциям | Использовать PATCH с explicit body |
| 49 | **`organizers/[slug].get.ts` — двойной запрос** — сначала `findFirst` для VERIFIED, потом `findUnique` для admin | `server/api/organizers/[slug].get.ts` | Лишний DB round-trip | Объединить в один запрос |
| 50 | **`admin/applications.get.ts` — последовательные count запросы** — 2 count вызова после `Promise.all` | `server/api/admin/applications.get.ts:35-42` | 2 лишних последовательных DB round-trip | Включить в `Promise.all` |

---

## 4. Мелкие проблемы (косметика, code style) — P3

| # | Проблема | Файл | Рекомендация |
|---|----------|------|--------------|
| 51 | Мёртвый API endpoint `cities.get.ts` — нигде не вызывается | `server/api/cities.get.ts` | Удалить |
| 52 | Мёртвые типы — `PaginatedResponse<T>`, `MenuItem`, `MenuSection` (дубликат из `drawer.ts`) | `types/index.ts` | Удалить |
| 53 | TODO комментарии — `<!-- TODO: позже — блоки «популярные» и «спонсируемые» -->` | `app/pages/[locale]/index.vue:85` | Перенести в task tracker |
| 54 | Пустые директории `app/stores/` и `app/plugins/` | `app/` | Удалить или добавить `.gitkeep` с пояснением |
| 55 | `devtools: { enabled: true }` захардкожен | `nuxt.config.ts:11` | Сделать условным |
| 56 | `vue` и `vue-router` в dependencies — Nuxt управляет ими внутренне | `package.json` | Удалить из dependencies |
| 57 | `@playwright/test` установлен без конфига и тестов | `package.json` | Удалить до появления e2e планов или создать config |
| 58 | `no-console: 'warn'` — только предупреждает, не блокирует | `eslint.config.mjs:37` | Изменить на `'error'` с `allow: ['warn', 'error']` |
| 59 | Нет import ordering rule | `eslint.config.mjs` | Добавить правило сортировки импортов |
| 60 | `supabaseAnonKey` в `runtimeConfig.public` но не используется на клиенте | `nuxt.config.ts:53` | Убрать из public |
| 61 | `organizers/[slug].vue` — inline bilingual conditional вместо locale key | `app/pages/[locale]/organizers/[slug].vue:63` | Создать locale key |
| 62 | `groups/[slug].vue` — захардкожен brand string `'PsyGroup'` в title | `app/pages/[locale]/groups/[slug].vue:120` | Использовать `t('seo.siteName')` |
| 63 | `UiLogo.vue` — захардкод `alt="PsyGroup logo"` | `app/components/ui/UiLogo.vue:12` | Локализовать alt text |
| 64 | `homeDescription` слишком длинный (172/165 chars) | `seo.ua.json`, `seo.en.json` | Обрезать до 150-160 |
| 65 | `groups/[slug].vue` JSON-LD `offers.availability` всегда `InStock` | `app/pages/[locale]/groups/[slug].vue` | Динамически устанавливать по статусу группы |
| 66 | `inconsistent structure` — `common.*` vs `common.actions.*`flat и nested ключи для одних понятий | `app/locales/ua.json`, `en.json` | Выбрать один паттерн |
| 67 | `common.mixed` vs `common.formats.hybrid` — разные слова для одного понятия | `app/locales/ua.json` | Унифицировать |
| 68 | `AvatarUploader.vue` — `function setFileInput(el: any)` | `app/components/forms/AvatarUploader.vue:33` | Использовать `HTMLElement \| null` |
| 69 | Нет JSDoc на service methods | `server/services/*.ts` | Добавить JSDoc на публичные методы |
| 70 | Нет JSDoc на security-critical utilities | `server/utils/auth.ts`, `rateLimit.ts`, `permissions.ts` | Добавить JSDoc |
| 71 | `sitemap.xml.ts` — 3 отдельных запроса вместо 2 | `server/routes/sitemap.xml.ts` | Объединить запросы |
| 72 | `notificationRepository.findByUser` — нет `select`, возвращает все поля | `server/repositories/notificationRepository.ts:15` | Добавить `select` |
| 73 | `applicationRepository.findById` — `group: true` over-fetches | `server/repositories/applicationRepository.ts` | Использовать `select` |
| 74 | `GroupCoOrganizer.role` — String вместо enum | `database/schema.prisma` | Создать enum если набор ролей фиксирован |
| 75 | `Group.startsAt` nullable — для published групп должна быть required | `database/schema.prisma` | Добавить validation на уровне приложения |
| 76 | `devtools` hardcoded в true | `nuxt.config.ts` | Условное включение |
| 77 | `README.md` — путь к Prisma schema может быть неточным | `README.md` | Проверить и обновить |
| 78 | `README.md` — `ADMIN_EMAIL` и `ADMIN_PASSWORD` не упомянуты в секции env vars | `README.md` | Добавить |
| 79 | `README.md` — только `migrate deploy` без `migrate dev` для разработки | `README.md` | Добавить оба варианта |
| 80 | Нет документации API endpoints (JSDoc/OpenAPI) | `server/api/` | Добавить хотя бы JSDoc |
| 81 | `useLocale.ts` — `t()` возвращает ключ без предупреждения при missing key | `app/composables/useLocale.ts` | Добавить console.warn в dev mode |
| 82 | Хардкод `box-shadow` вместо CSS token | `groups/[slug].vue:739` | Использовать shadow variables |

---

## 5. Рекомендации по рефакторингу

### 5.1. Централизовать data access через repositories

**Что:** Все 3 сервиса и 18+ API handlers содержат прямые вызовы Prisma.  
**Почему:** Нарушает layered architecture из AGENTS.md §3. Невозможно менять data access централизованно.  
**Как:** Перенести все Prisma queries из `server/services/*.ts` в `server/repositories/*.ts`. API handlers должны вызывать только сервисы.  
**Референс:** `server/api/groups/[slug].patch.ts` и `server/api/groups/[slug]/applications/[id].patch.ts` — правильная тонкая структура.

### 5.2. Стандартизировать API responses

**Что:** Разные endpoints возвращают разные форматы.  
**Почему:** Клиентскому коду сложно предсказывать структуру ответа.  
**Как:** Ввести единый envelope: `{ success: boolean, data?: T, error?: { code: string, message: string, details?: unknown } }`.

### 5.3. Консолидировать типы в `types/index.ts`

**Что:** 5 overlapping group interfaces, 3 co-organizer interfaces, рассинхронизация с Prisma.  
**Почему:** Дублирование, путаница, ошибки типов.  
**Как:** Определить base `Group` type из Prisma, использовать `Pick`/`Omit`/`Partial` для вариантов.

### 5.4. Вынести бизнес-логику из admin компонентов

**Что:** `AdminGroupsTab`, `AdminApplicationsTab`, `AdminProfilesTab` содержат 130-170 строк логики.  
**Почему:** Компоненты должны заниматься рендерингом, не бизнес-логикой.  
**Как:** Создать composables: `useAdminGroups()`, `useAdminApplications()`, `useAdminProfiles()`.

### 5.5. Устранить дубликации функций

**Что:** `formatPrice` (2×), `formatDate` (3×), `toLocalInputValue` (2×).  
**Как:** Перенести в `app/utils/format.ts`, импортировать из всех мест.

### 5.6. Добавить Zod валидацию query params

**Что:** 9 GET endpoints принимают query params без валидации.  
**Как:** Создать Zod schemas в `server/validators/` для каждого endpoint.

---

## 6. Что работает хорошо

1. **Чистая структура директорий** — полное соответствие AGENTS.md спецификации
2. **Нет Prisma в Vue компонентах** — граница browser/server соблюдена идеально (0 результатов grep)
3. **Shared code** — `shared/utils/permissions.ts` используется и клиентом, и сервером
4. **Нет circular dependencies** — чистый граф зависимостей
5. **Все `~~/` импорты корректны** — 48 абсолютных импортов без ошибок
6. **Permission system** — централизованный, ресурсо-ориентированный, с `can()` функцией
7. **Thin handler pattern** — `groups/[slug].patch.ts`, `apply.post.ts`, `applications/[id].patch.ts` — отличные примеры
8. **`usePageLoading` integration** — 10+ страниц корректно интегрированы
9. **Сервисный слой** — 3 сервиса с реальной бизнес-логикой (status transitions, notifications, authorization), не pass-through wrappers
10. **Repository layer** — 5 repositories с Prisma queries, хорошее разделение
11. **Error sanitization** — `sanitizeError()` предотвращает утечку внутренних ошибок
12. **Security headers** — HSTS, X-Frame-Options, CSP, Referrer-Policy, Permissions-Policy
13. **Cookie security** — httpOnly, sameSite: lax, secure: true в production
14. **File upload validation** — MIME whitelist, 5MB limit, predictable naming
15. **Ownership verification** — проверка владельца на всех мутациях групп
16. **Sitemap** — хорошо реализован с hreflang annotations, priority levels, lastmod
17. **FAQ JSON-LD** — правильно структурирован с динамическими данными
18. **BreadcrumbList JSON-LD** — динамическая генерация
19. **Локализации** — 577 ключей, ua.json и en.json имеют идентичную структуру
20. **Нет overengineering** — абстракции пропорциональны сложности проекта
21. **Нет commented-out code** — код чист
22. **Нет unused components/composables/utils** — всё используется
23. **Нет console.log в клиентском коде** — только server-side error logging
24. **Rate limiting на auth endpoints** — 5 req/15min для login, 3/hr для registration
25. **Нет v-html** — XSS через innerHTML исключён (используется только для JSON-LD)

---

## 7. Итоговая статистика

| Метрика | Значение |
|---------|----------|
| Всего файлов проанализировано | 168 |
| Строк кода | ~22 579 |
| **Критических проблем (P0)** | **3** |
| **Серьёзных проблем (P1)** | **19** |
| **Средних проблем (P2)** | **28** |
| **Мелких проблем (P3)** | **32** |
| **Всего проблем** | **82** |
| Строк тестов | 1 704 |
| Приблизительное покрытие тестами | ~7.5% |
| `as any` в коде | 21 |
| `@ts-ignore` / `@ts-expect-error` | 0 |
| Пустых `catch {}` блоков | 43 |
| Дублированных функций | 4 |
| Дублированных locale ключей | 8+ |
| API endpoints без Zod query validation | 9 |
| API handlers с прямым Prisma | 18+ |
| Unused components | 0 |
| Unused composables | 0 |
| Overengineering случаев | 0 |

---

## 8. Не проверено

| Что | Причина |
|-----|---------|
| `npm audit` | Не запускался — требуется network access |
| E2E тесты (запуск) | Нет конфигурации Playwright |
| Production build | Не запускался |
| Lighthouse/PageSpeed | Требуется running server |
| Кросс-браузерное тестирование | Требуется running server + браузеры |
| Реальное покрытие тестами (coverage report) | Не запускался `vitest --coverage` |
| Vercel deployment config | Нет доступа к Vercel dashboard |
| Supabase RLS policies | RLS включен в миграции, но policies не проверялись на корректность (все access идёт через service_role) |

---

## 9. Чеклист полноты

- [x] Все 42 API endpoints проверены
- [x] Все 24 страницы проверены
- [x] Все 8 composables проверены
- [x] Все 44 компонента проверены
- [x] Все 5 repositories проверлены
- [x] Все 4 validators проверены
- [x] Все 14 моделей Prisma проверены
- [x] Все 26 миграций проверены
- [x] Все 577 ключей локализации проверены
- [x] Все 3 сервиса проверены
- [x] Все 10+ server utils проверены
- [x] CSS/переменные проверены
- [x] Конфигурация (nuxt, eslint, prettier, tsconfig) проверена
- [x] SEO (sitemap, robots.txt, meta, JSON-LD) проверено
- [x] Безопасность (auth, secrets, headers, CSP, rate limiting) проверена
