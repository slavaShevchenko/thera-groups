# ФИНАЛЬНЫЙ АУДИТ ПРОИЗВОДСТВЕННОЙ ГОТОВНОСТИ

**Проект:** Psychotherapy Groups Catalog
**Ветка:** `refactor-v1`
**Дата аудита:** 2026-09-19
**Режим:** read-only. Ни один файл проекта не создан, не изменён и не удалён (`git status --porcelain` = ` M AUDIT-REPORT.md` + `?? .qwen/`, обе позиции существовали до начала аудита).

---

## Методология и сверки, выполненные перед отчётом

Отчёт собран по результатам полного чтения кодовой базы (5 параллельных потоков анализа: сервер/API, база данных и миграции, сборка/тесты/конфигурация, SEO/i18n, фронтенд) плюс собственных верификаций автора отчёта.

Дополнительные сверки, уточняющие или опровергающие предварительные данные:

- `app/locales/ua.json` = **518 ключей**, `en.json` = **518**, diff = **0**. `seo.ua.json` = **56**, `seo.en.json` = **56**, diff = **0**. Паритет идеален — но `common.close` и `common.noResults` **отсутствуют в обоих** (подтверждено программно), при этом используются в 5 местах.
- `HANDOFF.md` **не существует**.
- `playwright.config.*`, `tests/e2e/`, `e2e/` — **не существуют**; зависимость Playwright в `package.json` отсутствует.
- Гипотеза о stored XSS через JSON-LD `innerHTML` **снята** после чтения исходников unhead (см. §5).
- Утверждение «13 из 20 ключей разрешений мертвы» **исправлено** на более точное: все 20 где-то упоминаются, но 9 — только в тестах.

### ⚠️ Побочный эффект самого аудита

Во время прогона `npx vitest run --coverage` тест **`tests/integration/cascade-deletes.test.ts` записал и удалил строки в живой БД**, на которую указывает `.env`. Попытка исключить его флагом `--exclude='tests/integration/**'` **не сработала**: config-уровневый `include` в `vitest.config.ts` переопределил CLI-флаг, и тест выполнился — всего **дважды**. Миграции, `db push` и деплои **не запускались**. Детали — в P1-30.

---

## 1. Критические проблемы (P0)

| # | Проблема | Файл | Риск | Рекомендация |
|---|---|---|---|---|
| P0-1 | `DATABASE_URL?.replace('sslmode=require', 'sslmode=no-verify')`. Подтверждено по исходникам: `pg-connection-string/index.js:153-154` при `no-verify` ставит `ssl.rejectUnauthorized = false` | `server/utils/prisma.ts:8`; дубли в `database/seed.ts:15`, `tests/integration/cascade-deletes.test.ts:5` | Проверка TLS-сертификата СУБД **отключена**. Весь трафик к Postgres — включая заявки на психотерапию (AGENTS.md §16) — доступен для MITM. Supabase всегда валиден по сертификату, замена не нужна вообще | Удалить `.replace()` во всех трёх файлах. Если локальный стенд без TLS — выносить флаг в отдельный env, а не в прод-код |
| P0-2 | `"postinstall": "nuxt prepare"` — **`prisma generate` отсутствует**. Усиливается рассинхроном `prisma@7.9.1` (dev) / `@prisma/client@7.10.0` (prod) и `generator client { provider = "prisma-client-js" }` **без `output`** | `package.json:8,29-30`; `database/schema.prisma:1-3` | На Vercel `npm install` → `nuxt prepare` → `nuxt build` импортирует `@prisma/client`, в котором нет сгенерированного клиента. Деплой либо падает, либо поднимается с битым клиентом. Локально работает, потому что клиент сгенерирован вручную | `"postinstall": "prisma generate && nuxt prepare"`; привести `prisma` и `@prisma/client` к одной версии |
| P0-3 | `migrations.seed = 'npx prisma generate --schema=database/seed.schema.prisma && tsx database/seed.ts'`. Обе схемы объявляют `prisma-client-js` **без `output`** → обе генерируют в один `node_modules/.prisma/client`. `seed.schema.prisma` **устарел**: нет `enum GroupType` (19 значений), `GroupStatus.REJECTED`, `enum ReviewStatus`, `User.authId`, `User.isActive`, `Group.rejectionReason`, `OrganizerProfile.slug`, всех social/city/education-полей, модели `GroupCoOrganizer`, `NotificationType.GROUP_PENDING_REVIEW/ORGANIZER_*`; зато есть удалённые `GroupCategory` и `currency @default("RUB")` | `prisma.config.ts`; `database/seed.schema.prisma` | Запуск сида **перезаписывает живой Prisma Client устаревшим**. После `npm run db:seed` приложение теряет 14 полей, 3 enum'а и целую модель. Обнаруживается только в рантайме | Удалить `seed.schema.prisma`; в seed-команде убрать `prisma generate` (схема одна) |
| P0-4 | `deleteMany()` по 9 моделям **без `NODE_ENV`-guard, без подтверждения, без allowlist хостов**; плюс `supabaseAdmin.auth.admin.deleteUser()` по совпадению email | `database/seed.ts:64-74`, `:29-37`, `:51-58` | `npm run db:seed` против прода = **полная потеря данных** и удаление реальных auth-пользователей Supabase (необратимо, требует поддержки Supabase) | `if (process.env.NODE_ENV === 'production') throw`; явный allowlist хостов; интерактивное подтверждение |
| P0-5 | В `connect-src` нет `api.iconify.design`, а `UiIcon.vue` рендерит `<Icon :icon="`lucide:${name}`" />` из `@iconify/vue` без `addCollection`/`addIcon`/Nuxt-icon-модуля → иконки тянутся с внешнего API в рантайме. Плагин применяется **только при `NODE_ENV === 'production'`** | `server/plugins/csp.ts`; `app/components/ui/UiIcon.vue` (12 потребителей) | **Все иконки исчезают только после деплоя** — локально CSP выключен, дефект невоспроизводим в dev. Плюс `connect-src` содержит мёртвые origin'ы (`api.resend.com`, `*.googleapis.com`): клиентского Supabase в `app/` нет вообще (grep = 0 совпадений) | Либо бандлить коллекцию локально (`@iconify-json/lucide` уже установлен и **не используется**), либо добавить origin в CSP. Убрать мёртвые origin'ы |
| P0-6 | `watch(activeTab, …)` **без `immediate: true`**; `activeTab = ref('profiles')`; `AdminProfilesTab.vue` делает `defineExpose({ loadProfiles })` и **не имеет `onMounted`** | `app/pages/[locale]/admin/index.vue:34-42`, `:7`; `app/components/admin/AdminProfilesTab.vue:104` | Админ, открыв `/admin`, **навсегда** видит «нет профилей на верификации». Очередь модерации организаторов молча кажется пустой, пока не кликнуть на другую вкладку и обратно | Добавить `{ immediate: true }` (1 строка) |
| P0-7 | Цикл валидации идёт **только по присланным `input.answers`**, а `applySchema` объявляет `answers` с `.default([])` | `server/services/applicationService.ts:29-66`; `server/validators/application.ts` | `POST { answers: [] }` проходит **все обязательные вопросы**. Ядро продукта (организатор требует ответы) обходится одним запросом | Итерироваться по `questions` группы, а не по `answers`; проверять наличие ответа для каждого `required` |
| P0-8 | `deleteQuestionsByGroup` вызывается внутри `$transaction`, а `ApplicationAnswer.question` имеет `onDelete: Cascade` | `server/services/groupService.ts:184`; `database/schema.prisma` (`ApplicationAnswer`) | Редактирование списка вопросов группы **удаляет ответы всех существующих заявителей**. Необратимая потеря чувствительных данных | Не удалять вопросы, а деактивировать/версионировать; либо запретить правку вопросов при наличии заявок |
| P0-9 | `Group.organizerId` и `Report.reporterId` объявлены **без `onDelete`** → RESTRICT | `database/schema.prisma` (`Group`, `Report`) | `userRepository.delete` падает с FK-violation для любого организатора, создавшего группу, и любого пользователя, подавшего жалобу. **Право на удаление (GDPR Art. 17) структурно нереализуемо** | Определить политику (анонимизация вместо удаления для Group; `SetNull` для Report) и зафиксировать миграцией |
| P0-10 | Возвращает клиенту полную строку Prisma `User` и **никогда не проверяет `isActive`** | `server/api/auth/google.post.ts` | Деактивированный/забаненный пользователь входит через Google. Утечка внутренних колонок (`authId`, `preferredLocale`, `createdAt`, …) | `select`-whitelist; проверка `isActive` → 403 |
| P0-11 | Публичный поиск возвращает `email` других пользователей (поле закреплено в типе `OrganizerSearchResult`) | `server/api/organizers/*` (search); `types/index.ts` (`OrganizerSearchResult`) | Утечка PII с публичного эндпоинта. Email — это ещё и логин Supabase → перечисление аккаунтов + таргетированный фишинг против терапевтов | Убрать `email` из `select` и из типа |
| P0-12 | `Disallow: /*/groups/my` и `Disallow: /*/groups/new` — это **префиксные** совпадения | `public/robots.txt:2-3` | Блокируются реальные опубликованные слагы вида `/ua/groups/my-healing-circle-a1b2` и `/ua/groups/new-…`, которые **одновременно присутствуют в sitemap.xml**. Прямое противоречие; коммерческие страницы каталога выпадают из индекса | `Disallow: /ua/groups/my$` / `/en/groups/my$` (и то же для `new`) либо перенести приватные маршруты на непересекающийся префикс |
| P0-13 | `const slug = route.params.slug as string` — **нереактивно**. То же в `organizers/[slug].vue:6`, `groups/applications/[slug].vue:10`, `catalog/[type].vue`. Корректный паттерн уже есть в `groups/edit/[slug].vue:7` (`computed(...)`) | `app/pages/[locale]/groups/[slug].vue:9` | Vue переиспользует экземпляр при смене только параметра. Переход группа→группа оставляет `slug` от **предыдущей** группы: ключ `useFetch`, slug в `FavoriteButton`, `ApplicationForm`, canonical, JSON-LD и ссылка редактирования указывают не туда. **Пользователь может отправить заявку в группу, которую уже не видит** | `const slug = computed(() => route.params.slug as string)` либо `:key="route.fullPath"` на `<NuxtPage>` |
| P0-14 | Модалка открывается **до** загрузки вопросов (`isModalOpen = true` первой строкой); catch глотает ошибку; `questionsLoaded = true` ставится **и в ветке провала** | `app/pages/[locale]/groups/[slug].vue:50-60` | При сбое `/api/groups/:slug/questions` пользователь видит форму **без единого вопроса**, заполняет контакты и отправляет заявку с нулём ответов. Перезакрытие не повторяет запрос. Тихая потеря данных на основном конверсионном сценарии | Загружать вопросы до открытия; при ошибке — состояние ошибки внутри модалки, `questionsLoaded` не трогать |
| P0-15 | Три radio без атрибута `name`, а CSS задаёт `.group-edit__radio { display: none }` | `app/pages/[locale]/groups/edit/[slug].vue:272-283` + CSS | `display: none` исключает input из tab-order, а без общего `name` нет и стрелочной навигации группы. **Пользователь только с клавиатуры не может выбрать Online/Offline/Hybrid вообще**, а формат входит в чеклист публикации → создание группы без мыши невозможно. WCAG 2.1.1 (A) | Использовать существующий `UiRadio.vue` либо скрывать clip-техникой + добавить `name="format"` |
| P0-16 | `--line-height-normal: 1;` применяется к `html` | `app/assets/css/variables.css:102`, `:179` | Межстрочный интервал **всего документа = 1**, строки тела текста соприкасаются. Провал WCAG 1.4.12 (AA, требуется ≥1.5). Задевает каждый компонент, наследующий `line-height` | `1.5`; точечно проверить места, рассчитывавшие на `1` (например `GroupFilters.vue:324`) |
| P0-17 | Ключей `common.close` и `common.noResults` **нет ни в `ua.json`, ни в `en.json`** (проверено: 518 ключей в каждом, в блоке `common` их нет), а `useLocale.ts:38` при промахе возвращает **сырой ключ** | `app/pages/[locale]/catalog/index.vue:203`; `app/components/features/ApplicationForm.vue:103`; `app/components/ui/UiModal.vue:105`; `app/components/ui/UiDrawer.vue:110`; `app/components/features/CoOrganizersPicker.vue:108` | На публичной странице каталога в пустом состоянии буквально выводится `common.noResults`. В модалке заявки — видимая кнопка с текстом `common.close`. У всех модалок и drawers `aria-label` кнопки закрытия = `common.close` | Добавить оба ключа в обе локали; в `useLocale` — fallback на читаемый текст + проверка паритета ключей в CI |
| P0-18 | `<!-- TODO: review with lawyer before production -->` в обоих юридических документах + жёстко зашитая дата «последнего обновления» | `app/pages/[locale]/terms.vue:51`; `app/pages/[locale]/privacy.vue:55`; `app/components/layout/InfoPageLayout.vue:15` (`2026-09-01`) | Авторы сами пометили это как блокер. Публикация непроверенной политики конфиденциальности для продукта, обрабатывающего данные о психотерапии, — дефект прозрачности по GDPR Art. 13. Зашитая дата молча станет ложной | Юридическая вычитка до деплоя; дату — из метаданных ревизии документа |

---

## 2. Серьёзные проблемы (P1)

| # | Проблема | Файл | Влияние | Рекомендация |
|---|---|---|---|---|
| P1-1 | `sanitizeError` применён в **1 из 41** эндпоинта; каталога `server/middleware/` нет; `nitro.errorHandler` не задан; `app/error.vue` отсутствует | `server/utils/errorHandler.ts` (единственный потребитель — `server/api/auth/register.post.ts:7,125`) | Необработанные ошибки рендерят дефолтную страницу Nitro без локализации и без брендинга. Единого контракта ошибок нет | Nitro-плагин `errorHandler` + `app/error.vue` |
| P1-2 | `sanitizeError` сохраняет `statusMessage` **любой** ошибки дословно, а сервисы пишут их по-английски и с внутренними деталями | `server/utils/errorHandler.ts`; `server/services/groupService.ts:103` (`'Only admins can publish groups. Use PENDING_REVIEW instead.'`), `:223` (`'Some co-organizer users are not valid active organizers'`) | Утечка внутренней логики. Строка `:223` — **оракул перечисления**: перебором `userId` выясняют, кто является верифицированным организатором | Whitelist'ить `statusMessage` только для доверенных кодов; остальное — generic + `data.code` |
| P1-3 | Нет маппинга Prisma-ошибок (P2002/P2025/P2003) | `server/utils/errorHandler.ts` | Уникальность и «не найдено» уезжают клиенту как 500 | Маппинг в 409/404/400 |
| P1-4 | `getRequestIP(event, { xForwardedFor: true })` берёт **крайний левый** элемент XFF | `server/utils/rateLimit.ts` | Значение подделывается клиентом одним заголовком → **все** лимитеры обходятся | Брать последний адрес от доверенного прокси (Vercel) либо использовать `x-real-ip`/первый не-приватный справа |
| P1-5 | Лимит применён только в 4 из 41 эндпоинта | `login.post.ts:10`, `register.post.ts:12`, `google.post.ts:8`, `groups/[slug]/apply.post.ts:12` | Загрузка аватара, создание групп, модерация, поиск организаторов (утекающий email), mark-all-read — без ограничений | Глобальный лимитер в `server/middleware/` + точечные строгие |
| P1-6 | Только `RateLimiterMemory` | `server/utils/rateLimit.ts` | На Vercel у каждого serverless-инстанса своя память → лимит действует в пределах одного тёплого инстанса, т.е. практически отсутствует | Redis/Upstash-адаптер `rate-limiter-flexible` |
| P1-7 | Валидируются лишь 4 переменные; `SITE_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `JWT_SECRET` — **нет** | `server/plugins/configValidation.ts` | Прод стартует «успешно» с неверным `SITE_URL` (canonical/sitemap/OG на localhost), молча не отправляя письма и с неработающим Google-входом | Валидировать весь набор; для опциональных — явный warning |
| P1-8 | `process.exit(1)` внутри Nitro-плагина | `server/plugins/configValidation.ts:32` | На Vercel это непрозрачный срыв cold start без внятного лога | `throw new Error(...)` с перечислением отсутствующих переменных |
| P1-9 | Админская ветка берёт `organizerProfile.findFirst({ where: { verificationStatus: 'VERIFIED' } })` **без `orderBy`**; вся функция — 6 прямых обращений к Prisma, минуя service/repository; группа создаётся с `title: ''` | `server/api/groups.post.ts:22-30`, `:52-53` | Группа, созданная админом, **приписывается произвольному реальному терапевту**. На свежей прод-БД (0 верифицированных) создание падает 400 — «курица и яйцо». Брошенные черновики живут вечно, лимита нет. ~30 строк дублируются между ветками | Вынести в `groupService.create`; для админа — явный `organizerId` или служебный профиль |
| P1-10 | Проверка допустимости перехода статуса находится **внутри** `if (data.status)` | `server/services/groupService.ts:99-124` | Не передав `status`, организатор правит заголовок/описание/цену/даты **опубликованной** группы без повторной модерации | Guard вынести наружу; при правке PUBLISHED — автоматически в PENDING_REVIEW |
| P1-11 | `notifyAdminsGroupPendingReview` (`:170`) и `userRepository.findValidOrganizerUsers` (`:218`) вызываются внутри `$transaction`, но пишут/читают через модульный `prisma`, а не `tx` | `server/services/groupService.ts` | Операции вне транзакции: откат оставляет отправленные уведомления и письма | Пробрасывать `tx` |
| P1-12 | Проверка дубля — read-then-write без `$transaction`; `@@unique([groupId, email])` в схеме **нет**; ответ — `400 'Application failed'` вместо 409 | `server/services/applicationService.ts:68-75`; `database/schema.prisma` (`Application`) | Параллельные отправки создают дубликаты. Текст сообщения — оракул «этот email уже подавал заявку» | Уникальный индекс + `$transaction` + 409 |
| P1-13 | `updateStatus` без машины состояний и без идемпотентности; вызов `await`-ится | `server/services/applicationService.ts:128-138` | Цикл APPROVED→REJECTED→APPROVED каждый раз шлёт письмо — примитив для спама заявителю. Запрос блокируется на Resend без таймаута | Запретить недопустимые переходы; no-op при том же статусе; письмо — в фон |
| P1-14 | ``html: `<p>${body}</p>` `` интерполирует пользовательские `groupTitle`/`applicantName` **без экранирования**; нет текстовой альтернативы и HTML-обёртки | `server/utils/notifications.ts:120` | Инъекция HTML в письмо получателю (контролируемые организатором/заявителем строки) | Экранировать; добавить `text`; полноценный шаблон |
| P1-15 | Локаль заявителя угадывается через `prisma.user.findUnique({ where: { email } })` | `server/utils/notifications.ts:104-108` | Заявители **не зарегистрированы** → почти всегда `null` → `resolveLocale` возвращает `'ua'` → англоязычные получают письма на украинском | Хранить локаль в `Application` либо передавать из формы |
| P1-16 | `findMany({ where: { role: 'ADMIN' } })` без ограничения и без индекса; далее `Promise.all(admins.map(...))` — по одному insert на админа, вне транзакции вызывающего | `server/utils/notifications.ts:173-183` | N+1 записей на каждое событие; рост latency с ростом числа админов | `createMany`; индекс на `User(role)` |
| P1-17 | `generateUniqueSlug` после 5 итераций делает `return slug` **без проверки последнего кандидата**; `randomSuffix` на `Math.random()` и `.slice(2, 2+length)` даёт 0–3 символа; `.slice(0, 40)` применяется **до** суффикса | `server/utils/slugify.ts:29-34` | При исчерпании — гарантированный P2002 → 500. Итоговый slug может превысить 40. Пустой/символьный заголовок даёт ведущий дефис (`"-x7k2"`) | Проверять последний кандидат; CSPRNG; обрезать после склейки |
| P1-18 | `orderBy: { startsAt: 'asc' }` **без нижней границы `startsAt >= now()`** | `server/repositories/groupRepository.ts:91-93` | Уже начавшиеся/прошедшие группы стоят **первыми** на странице каталога по умолчанию | Добавить фильтр по дате либо сортировать по релевантности/дате создания |
| P1-19 | `findBySlug` в JSDoc назван «published», но **фильтра по статусу нет**; эндпоинт делает `const { coOrganizers, ...rest } = group; return { ...rest }` | `server/repositories/groupRepository.ts:133-158`; `server/api/groups/[slug].get.ts:42-56` | «Whitelist по случайности»: публичным становится всё, что включил репозиторий, — включая `rejectionReason` и `organizer.userId`. DRAFT/REJECTED доступны по slug | Явный `select`-whitelist в эндпоинте; фильтр статуса в репозитории |
| P1-20 | Группы отфильтрованы только по `status: 'PUBLISHED'` — **`activeOrganizerFilter` отсутствует**; организаторы — по `VERIFIED`, но без `user.isActive`. Три `findMany` без `take` и без кэша. `baseUrl = config.public.siteUrl \|\| 'https://psygroup.org'` | `server/routes/sitemap.xml.ts:9-19`, `:6` | Sitemap перечисляет URL, которые отдают 404 (soft-404, трата crawl budget). Неограниченные выборки растут линейно. Второй, **отличный** от `nuxt.config.ts` (`\|\| 'http://localhost:3000'`) fallback — split-brain | Синхронизировать фильтры с репозиторием; единый источник `siteUrl`; пагинация/кэш |
| P1-21 | `Sitemap: https://psygroup.org/sitemap.xml` зашит в статический файл | `public/robots.txt:15` | При деплое на другой домен/preview робот получает чужой sitemap | Генерировать `robots.txt` серверным маршрутом из `SITE_URL` |
| P1-22 | `hreflang="ua"`. `ua` — код **страны** ISO 3166; язык по ISO 639-1 — `uk`. Правильное соответствие уже есть в `langMap` и применено к `htmlAttrs.lang`, но **не** к массиву ссылок | `app/composables/useLocaleHead.ts:28-32` vs `:4`,`:26`; `server/routes/sitemap.xml.ts:42,57,71,86` | Google игнорирует невалидный hreflang → **украинская альтернатива не зарегистрирована на всём сайте**, где `ua` — SEO-язык по умолчанию. Прямой провал AGENTS.md §18 | Пропускать значения через `langMap` |
| P1-23 | `useLocaleHead` читает `route.path` **однократно** и возвращает обычный объект; `app.vue` передаёт его в `useHead`. Первый сегмент пути срезается вслепую, query теряется | `app/composables/useLocaleHead.ts:14-16`; `app/app.vue:4-5` | hreflang/canonical **заморожены на первом посещённом маршруте** на всё время жизни приложения | Возвращать геттеры/`computed` |
| P1-24 | Все значения резолвятся eagerly; canonical строится из `useRequestURL().origin + route.path` (не `SITE_URL`) и **теряет query**; `ogImage` — `?? DEFAULT_OG_IMAGE` никогда не срабатывает (`t()` возвращает строку ключа) и значение **относительное** | `app/composables/useSeoPage.ts:24-28` | Пагинированные страницы каталога канонизируются на страницу 1. Симптом уже виден: `groups/[slug].vue:75` отдаёт `<link rel="canonical" href="">`, `organizers/[slug].vue:65` — пустой `og:image`. Относительный `og:image` игнорируется соцсетями | `computed`; абсолютный URL из `siteUrl`; явный fallback |
| P1-25 | `{ "files": [], "references": [...] }` → **`npx vue-tsc --noEmit` (команда из README) завершается с кодом 0, не проверив ни одного файла**; нужен `--build`. Скрипта `typecheck` в `package.json` нет | `tsconfig.json`; `README.md` | Ложно-зелёная проверка типов. Реальное состояние видно только через `npx nuxi typecheck` → **exit 2, 5 ошибок** | `"typecheck": "nuxi typecheck"`; поправить README |
| P1-26 | 5 ошибок типов. Четыре из них — `method: 'PATCH'/'DELETE'` не присваивается `'get" \| "GET" \| undefined'` | `app/components/forms/AvatarUploader.vue:145`; `app/pages/[locale]/groups/edit/[slug].vue:117,130,161`; `app/pages/[locale]/groups/my.vue:100` | **Каждый мутирующий вызов `$fetch` находится вне системы типов.** Опечатка в теле PATCH/DELETE не обнаруживается на этапе сборки | Типизировать generic'ом `$fetch<T>` / перейти на `useFetch` с явным типом |
| P1-27 | `"test": "vitest"` — **watch-режим** | `package.json` | Любой CI/Vercel-шаг с `npm test` зависает навсегда | `"test": "vitest run"` |
| P1-28 | **Ноль end-to-end тестов.** Нет `playwright.config.*`, нет `tests/e2e/`, нет `e2e/`, зависимость Playwright отсутствует | `package.json`; структура каталогов (проверено glob) | AGENTS.md §19 прямо требует Playwright для критических пользовательских сценариев. Ни один из P0-6, P0-13, P0-14, P0-15 не был бы пропущен при наличии хотя бы одного e2e на подачу заявки | Завести Playwright + 3–5 сценариев: каталог→заявка, создание группы, модерация, логин |
| P1-29 | Покрытие **33.93%** stmts / 35.11% branch / 32.20% funcs; **51 из 77** файлов ровно **0%**; `coverage.include: ['server/**/*.ts','shared/**/*.ts']` → **всё дерево `app/` исключено из измерения**; `server/repositories` — **3.38%** branch; порогов нет | `vitest.config.ts` | 0%: весь `server/api/admin` (10 файлов), `server/plugins`, `errorHandler.ts`, `notifications.ts` (34 stmts), `avatar.post.ts` (32), `organizers/me.patch.ts` (40), `sitemap.xml.ts`, 2 валидатора, 2 репозитория. Ничто из найденного в этом аудите не покрыто | Включить `app/`; пороги (ratchet); покрыть admin-эндпоинты и notifications |
| P1-30 | Интеграционный тест подключается к **живой БД из `.env`** и пишет/удаляет строки. CLI-флаг `--exclude` **переопределён** config-уровневым `include` | `tests/integration/cascade-deletes.test.ts:5-9`; `vitest.config.ts` | Во время этого аудита тест **дважды изменил реальную БД**. Изолировать его из командной строки невозможно | Отдельный `TEST_DATABASE_URL`; project-разделение в vitest; guard на hostname |
| P1-31 | **9 из 20** ключей разрешений упоминаются только в `tests/shared/permissions.test.ts` / `tests/server/auth.test.ts` и никогда в проде: `group.edit`, `group.delete`, `group.publish`, `favorite.manage`, `application.create`, `application.manage`, `organizer.profile.edit`, `organizer.profile.moderate`, `notification.manage`. Сервером enforced лишь **7** | `shared/utils/permissions.ts` | ~250 строк зелёных тестов утверждают поведение, которое приложение никогда не вызывает — **ложная уверенность в авторизации**. Реальные проверки прав размазаны по handlers | Либо провести все операции через `requirePermission`, либо удалить неиспользуемые ключи и их тесты |
| P1-32 | `usePermissions` используется в **ровно одном** месте, при этом **16 самодельных проверок `user.value?.role === 'X'`** в 9 файлах с **противоречащими правилами** | `app/composables/usePermissions.ts`; `AppHeader.vue:6` vs `admin/index.vue:27`, `groups/edit/[slug].vue:14,17,76`, `groups/new.vue:13`, `groups/applications/[slug].vue:39`, `groups/[slug].vue:187`, `groups/my.vue:60`, `profile/edit.vue:166,192`, `profile/index.vue:92,123,142,150`, `ModerationBanner.vue:11` | `groups/applications/[slug].vue:39` и `groups/my.vue:60` пускают только `ORGANIZER`, а `groups/new.vue:13` — `ORGANIZER \|\| ADMIN` → **админ-соорганизатор не видит заявки своей группы**. Добавление роли = правка 9 файлов | Все проверки через `can()` с типизированным union |
| P1-33 | **14 из 40** handlers импортируют `prisma` напрямую | `server/api/groups.post.ts` (6 вызовов), `server/api/groups/[slug].get.ts:3,32-40`, `server/routes/sitemap.xml.ts`, др. | Нарушение слоёв AGENTS.md §3 в трети API. `favoriteRepository.findByUserAndGroup` **уже существует и мёртв**, а `[slug].get.ts:32-40` дублирует его inline | Провести через repositories; включить ESLint-правило `no-restricted-imports` |
| P1-34 | В сервисах **44** вхождения `createError`/`statusCode` (23 — в одном `groupService`); три разных формы возврата у `create`/`update`/`moderateGroup`; `moderateGroup` реализует настоящую машину состояний, но **не транзакционна** | `server/services/groupService.ts` (332 строки), `applicationService.ts`, `organizerService.ts` | HTTP-концепты в доменном слое (AGENTS.md §3/§11). Доменный код невозможно переиспользовать вне HTTP; частичный сбой модерации оставляет несогласованное состояние | Сервисы бросают доменные ошибки; HTTP-коды назначает слой API |
| P1-35 | `q`, `type`, `format`, `dateFrom`, `city`, `exclude` — голые `z.string()` **без `.max()`**; `status` — тоже `z.string()`, затем `as`-приведение на стороне вызова | `server/validators/query.ts` | Многомегабайтный ILIKE-паттерн против неиндексированного `contains` = дешёвый DoS. Невалидный `status` проходит Zod и падает уже в Prisma → **500 вместо 400** | `.max()` на каждое поле; `z.nativeEnum()` для статусов |
| P1-36 | Детали Zod-ошибок **выбрасываются**, клиенту уходит только `'Validation failed'` | `server/api/groups/[slug]/apply.post.ts:30-35` | Форма подачи заявки не может показать ошибки по полям — пользователь не понимает, что исправить | Пробрасывать `issues` в `data` |
| P1-37 | Старый объект в storage удаляется **до** коммита записи в БД; MIME проверяется только по клиентскому `Content-Type` (без magic bytes); размер проверяется **после** того, как `readMultipartFormData` уже буферизовал тело; лимита нет; `requireAuth` не используется | `server/api/organizers/avatar.post.ts:66-76`, `:35`, `:29`,`:39` | Провал `update` → у пользователя битый аватар; срыв между шагами → осиротевший файл. Подмена `Content-Type` позволяет загрузить произвольное содержимое. Неограниченный размер тела (Nitro-лимит не задан) | Сначала запись в БД, затем удаление старого; sniffer по сигнатуре; лимит размера тела; rate limit |
| P1-38 | Дрейф nullability: `specializations`, `languages`, `workFormats`, `ApplicationQuestion.options` типизированы как `String[]` (NOT NULL), но миграциями созданы **nullable** | `database/schema.prisma` vs `database/migrations/*` | `Cannot read properties of null` в рантайме на любой легаси-строке; Prisma-типы лгут | `NOT NULL DEFAULT '{}'` миграцией + `prisma migrate diff` для контроля дрейфа |
| P1-39 | `DROP COLUMN "status"` с последующим повторным добавлением | `database/migrations/20260919150409_add_review_status_enum` | **Вся существующая модерация отзывов сброшена в PENDING.** Был доступен无损-вариант `USING status::"ReviewStatus"` | Заменить на `ALTER COLUMN ... TYPE ... USING` |
| P1-40 | Единственная папка миграции с **дефисом** вместо `_` | `database/migrations/20260826210841-add-rejection-reason` | Может молча не распознаваться резолвером Prisma → расхождение схемы и БД (статически не подтверждено, см. §9) | `prisma migrate status` на реальной БД; при необходимости переименовать + запись в `_prisma_migrations` |
| P1-41 | В git-отслеживаемом файле задокументирован **`ADMIN_PASSWORD=admin123456`** (повторяется в README); при этом ни один участок кода его не читает | `.env.example`; `README.md` | Слабая учётка-по-умолчанию в публичном репозитории; мёртвые переменные (`ADMIN_EMAIL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) создают ложное впечатление о конфигурации | Удалить значение и мёртвые переменные; задокументировать реально используемый набор |
| P1-42 | Авто-`forceHide()` через 5 с обнуляет `pendingCount.value = 0`; состояние в общем `useState`, а таймеры — в замыканиях **отдельного экземпляра** | `app/composables/usePageLoading.ts:17-19`,`:45`,`:2-5` | Один медленный запрос **навсегда** ломает общий счётчик: последующие `finishLoading()` декрементируют от 0 → лоадер либо не появляется, либо не исчезает. Механизм защиты сам вызывает застревание. Дополнительно гонка: 200 мс hide от экземпляра A срабатывает во время загрузки B | Таймеры в `useState`; отслеживать поколение/токен вместо обнуления |
| P1-43 | Молчаливый catch; `profile` остаётся `null`; единственная ветка `!profile` — это надпись «Загрузка…» | `app/pages/[locale]/profile/index.vue:37-40`, `:60-65` | **Любой сбой API рендерит бесконечное «Loading…»** без ошибки и без повтора. Худший режим отказа: неотличим от медленной сети | Флаг `loadError` + состояние ошибки с кнопкой повтора |
| P1-44 | В catch — только комментарий: ни ref ошибки, ни тоста, ни disabled-состояния | `app/pages/[locale]/auth/login.vue:47-49` | «Продолжить с Google» молча не делает ничего; пользователь не понимает, повторять ли | Показывать ошибку и предлагать повтор |
| P1-45 | Палитра не проходит контраст (расчёт по формуле относительной яркости WCAG): `--color-primary #6FA39B` на белом = **2.84:1**; `--color-success #5CB85C` = **2.48:1**; `--color-error #D9534F` = **3.96:1**; `--color-primary-hover #5a8a82` = **3.89:1**; `--color-text-muted #5a7a7a` на `--color-background #FAF8F4` = **4.40:1** | `app/assets/css/variables.css:5,6,11,17,18`; потребители: `:202` (все ссылки в тексте — 2.84:1 **и без подчёркивания** → ещё и 1.4.1), `:190-193` + `:73` (глобальное кольцо фокуса, 50% alpha — ниже 3:1 по 1.4.11), skip-link в `layouts/default.vue`, `organizers/[slug].vue` `.organizer-page__verified`, `register.vue` `.auth-form__role-btn--active`, тексты ошибок в `login.vue`/`register.vue`/`profile/edit.vue`/`auth/callback.vue` | Слабовидящие и дальтоники не читают ссылки, сообщения об ошибках, подтверждения успеха, бейджи верификации и метаданные; клавиатурные пользователи не видят фокус | Ввести `--color-primary-text`/`--color-error-text`/`--color-success-text` ≥4.5:1, светлые оттенки оставить для фонов; ссылки в тексте подчеркнуть |
| P1-46 | `html { font-size: 16px }` | `app/assets/css/variables.css:176` | Перекрывает пользовательскую настройку размера шрифта в браузере (WCAG 1.4.4); все `rem`-токены считаются от неверной базы | `font-size: 100%` |
| P1-47 | `.group-filters__input { outline: none }` **без какой-либо замены** — в файле нет ни `:focus`, ни `:focus-visible` для этого класса, ни `:focus-within` на обёртке | `app/components/features/GroupFilters.vue:331-340` | Поле поиска и поле даты в каталоге — главные элементы управления на самой посещаемой странице — **не имеют индикатора фокуса вовсе**. Провал WCAG 2.4.7 (AA). Остальные 8 мест с `outline: none` в проекте сделаны правильно | `:focus-visible` по образцу `UiInput.vue:172` |
| P1-48 | `.application-row__main` — `<div>` с `@click` и `cursor: pointer`, **без `role`, `tabindex`, `@keydown`, `aria-expanded`**; `AvatarUploader.vue:114` — `<div role="button">`, оборачивающий `<input type="file">` | `app/pages/[locale]/groups/applications/[slug].vue:145-152`; `app/components/forms/AvatarUploader.vue:114` | С клавиатуры и со скринридером **невозможно раскрыть заявку и прочитать ответы заявителя** — то есть весь смысл экрана организатора. WCAG 2.1.1/4.1.2. (Корректный образец — `notifications.vue:143-149`) | Настоящий `<button aria-expanded>`; для загрузчика — `<label for>` |
| P1-49 | `updateStatus(id, 'APPROVED'\|'REJECTED')` привязан к кнопке напрямую, **без подтверждения**, с молчаливым catch | `app/pages/[locale]/groups/applications/[slug].vue:77-93,188,197` | Один случайный клик решает судьбу заявки на психотерапию (чувствительные данные, AGENTS.md §16). При сбое кнопка просто разблокируется **без сообщения** — организатор считает решение принятым. Удаление черновика при этом подтверждается через `UiConfirmModal` | Подтверждение + индикация сбоя + `role="status"` |
| P1-50 | Рабочий процесс публикации живёт в Vue-странице: 30-строчная ветка выбирает доменный переход (`PUBLISHED` для админа / `PENDING_REVIEW` для организатора), собирает админ-payload с `coOrganizers.filter(...)` и делает два **неатомарных** PATCH подряд | `app/pages/[locale]/groups/edit/[slug].vue:95-137` | Машина состояний группы в UI — нарушение AGENTS.md §3/§14. Если `flushSave()` прошёл, а публикация упала, группа сохранена, но не опубликована, и пользователь видит лишь общую ошибку | Единый `POST /api/groups/:slug/publish`, владеющий переходом |
| P1-51 | Не помечены элементы форм: поиск и дата в фильтрах (ни `<label>`, ни `aria-label`); `bio` и `education` без `:label`; `<label>` без `for` рядом со `Slider` без `aria-label`; сырой `<select>` валюты; поле роли в `CoOrganizersPicker`; `Combobox`/`UiAutocomplete`; осиротевший `<label>` в `AvatarUploader` | `GroupFilters.vue`; `profile/edit.vue:262,277-288,322-334,427-431`; `CoOrganizersPicker.vue`; `forms/Combobox.vue`; `ui/UiAutocomplete.vue`; `forms/AvatarUploader.vue` | Скринридер сообщает «поле редактирования», не говоря, что вводить — в форме профиля организатора это bio, образование, стаж, валюта и языки. WCAG 1.3.1/4.1.2. Примитивы уже умеют генерировать `id`/`for` | Передавать `:label`; для групп — `<fieldset><legend>` |
| P1-52 | Кнопки только с иконкой без имени: 5+ в конструкторе вопросов (вверх/вниз/дублировать/удалить/добавить вариант), `←`/`→` пагинации в трёх админ-таблицах, бургер в шапке (плюс нет `aria-expanded`/`aria-controls` для drawer) | `GroupQuestionsBuilder.vue`; `AdminGroupsTab.vue:225,243,320,338`; `AdminUsersTab.vue`; `AdminOrganizersTab.vue`; `AdminApplicationsTab.vue`; `AppHeader.vue` | Скринридер произносит «кнопка» или сам символ стрелки. WCAG 4.1.2. Правильный образец уже есть — `profile/edit.vue:346,409` | `aria-label` |
| P1-53 | Эмодзи как **индикаторы состояния**, без `aria-hidden`: `⏳ ✕ ✓ 💻 🏢 🔄` и **десять** `✅`/`⬜` чеклиста публикации; `📋 ✕ 📷 💚 ✅ *` | `groups/edit/[slug].vue:200,208,219,279,429,435,445-460,264`; `groups/my.vue:139,181`; `AvatarUploader.vue`; `AppFooter.vue`; `ApplicationForm.vue` | Скринридер произносит «white heavy check mark Title» / «hourglass not done Saving»; состояние передаётся только эмодзи + цветом. WCAG 1.4.1 и AGENTS.md §9. При этом `UiIcon` уже используют 12 файлов | `<UiIcon aria-hidden>` + состояние через `aria-checked`/`aria-label`/`role="status"` |
| P1-54 | Форма имеет `novalidate`, а функции `validate()` в файле **нет вообще**; `required` проставлен, `handleSubmit` отправляет безусловно | `app/pages/[locale]/profile/edit.vue:214,242,251,110` | **Профиль организатора сохраняется с пустыми именем и фамилией.** Атрибуты `required` декоративны: нативная валидация отключена, JS-валидацией не заменена. AGENTS.md §14 | `validate()`, зеркалящая серверную Zod-схему |
| P1-55 | `isSubmitting.value = false` **не в `finally`** | `app/pages/[locale]/auth/register.vue:75` | При отклонении `register()` флаг остаётся `true` → **все элементы формы навсегда `:disabled`**, форма мертва без перезагрузки. (`profile/edit.vue:145-147` и `groups/edit/[slug].vue:139` делают правильно) | `finally` |
| P1-56 | Жёстко зашитый текст: бренд `PsyGroup` в 3 местах, юридическая дата `2026-09-01`, 7 placeholder-URL соцсетей, и **ключ конкретной страницы внутри «универсального» примитива** (`profile.edit.experienceYears`) | `UiLogo.vue:18`; `AppFooter.vue`; `PageLoader.vue`; `InfoPageLayout.vue:15`; `profile/edit.vue:445-484`; `forms/Slider.vue` | Бренд нельзя перевести/переименовать без правки кода; дата «обновления» политики молча устаревает. Слайдер с зашитым доменным ключом нарушает AGENTS.md §5 и при втором потребителе покажет чужой текст | В локали/конфиг; `label` как prop |
| P1-57 | **7 молчаливых `catch {}`** превращают сбой в пустое состояние: `groups/my.vue:83-87,101-103`; `groups/applications/[slug].vue:59-62,89-91`; `favorites.vue`; `applications/my.vue`; все 5 админ-вкладок в mutation-обработчиках. `catalog/index.vue` и `organizers/index.vue` вообще не деструктурируют `error` из `useFetch` | перечисленные | 500 или обрыв сети рендерится как «Групп пока нет» / «Заявок нет» / «Нет избранного». **Для организатора сбой бэкенда выглядит как удаление его опубликованных групп.** Помечено комментарием `// Silent by design`, но дизайн смешивает «пусто» и «сломано» | Деструктурировать `error`; отдельное состояние ошибки с повтором |

---

## 3. Средние проблемы (P2)

| # | Проблема | Файл | Влияние | Рекомендация |
|---|---|---|---|---|
| P2-1 | `getUser` — неатомарные read-then-`create`; нет проверки `email_verified`; всегда `include: { organizerProfile: true }` | `server/utils/auth.ts:21-37` | P2002 при двух одновременных первых запросах одного пользователя; over-fetch на каждом запросе | `upsert`; `include` по необходимости |
| P2-2 | `permissions: Record<string, PermissionCheck>` → `Permission = keyof typeof permissions` вырождается в `string`; `can(permission: string, ...)` | `shared/utils/permissions.ts`; `app/composables/usePermissions.ts` | Опечатка в ключе компилируется и **молча** возвращает `false` (fail-closed без сигнала) | `as const satisfies Record<...>` |
| P2-3 | `application.create: ctx => !!ctx.user` **противоречит** публичному неаутентифицированному `apply.post.ts` | `shared/utils/permissions.ts`; `server/api/groups/[slug]/apply.post.ts` | Карта разрешений описывает несуществующее правило; при её реальном подключении заявки без регистрации сломаются | Привести к продуктовой модели (заявки без регистрации) |
| P2-4 | `group.view` разрешает публичный доступ **только при `status === 'PUBLISHED'`**; `group.viewMyList` и `application.viewMyApplications` исключают ADMIN | `shared/utils/permissions.ts` | Группы в FULL/COMPLETED/CANCELLED отдают 404 всем, включая владельца; админ не видит списки | Разделить «публичный просмотр» и «просмотр владельцем» |
| P2-5 | `updateData: Record<string, unknown>`; `updateData.capacity = data.maxParticipants ?? 10`; `if (ctx.organizerId && ctx.isAdmin)` — параметр назван `organizerId`, но используется как **userId** | `server/services/groupService.ts:126,143,147` | Нетипизированный update; выдуманное значение по умолчанию 10; вводящее в заблуждение имя параметра — прямой путь к ошибке авторизации | `Prisma.GroupUpdateInput`; явная константа; переименовать |
| P2-6 | `status`/`coOrganizers` молча удаляются из payload соорганизатора, но возвращается `success: true` | `server/services/groupService.ts:87-90` | Клиент считает, что изменение применено | 400 при недопустимых полях |
| P2-7 | Соорганизаторы исключены из управления заявками, хотя право редактирования группы им дано | `server/services/applicationService.ts:118` vs `groupService.ts:79-83` | Непротиворечивая на вид модель ролей на деле рассогласована | Зафиксировать в `docs/domain.md` и выровнять |
| P2-8 | Проверки вместимости нет нигде; метода `withdraw` нет; `applicationStatusSchema` допускает только APPROVED\|REJECTED | `server/services/applicationService.ts`; `server/validators/application.ts` | `GroupStatus.FULL` и `ApplicationStatus.WITHDRAWN` **недостижимы** — мёртвые значения enum, а заявитель не может отозвать заявку | Реализовать оба сценария либо убрать значения |
| P2-9 | При отсутствии `RESEND_API_KEY` ставится `error`, но `status` остаётся `'PENDING'`; `await import('resend')` динамический; таймаута нет | `server/utils/notifications.ts:36-42,45` | Письмо навсегда «в ожидании»; риск, что nft-трейсинг Vercel не упакует модуль | `FAILED`; статический импорт; таймаут |
| P2-10 | В `Notification.title`/`message` хранятся **уже отрендеренные переведённые строки**; `rejectionReason` заявителю не передаётся; типа `APPLICATION_WITHDRAWN` нет | `server/utils/notifications.ts`; `database/schema.prisma` | Перевод заморожен на момент создания: смена локали пользователя не перечитывает уведомление | Хранить `type` + payload, переводить при чтении |
| P2-11 | `buildPublishedWhere` **молча игнорирует** невалидные `type`/`format` и молча отбрасывает нераспарсенный `dateFrom` | `server/repositories/groupRepository.ts:48-73` | Фильтр выглядит применённым, но не работает → soft-404 и дубли URL | 400 на невалидное значение |
| P2-12 | `where.title = { contains, mode: 'insensitive' }` без pg_trgm-индекса; то же для `OrganizerProfile.city` | `server/repositories/groupRepository.ts` | Seq scan на каждом поиске | GIN trgm-индекс |
| P2-13 | `findAllAdmin` приводит `where as Prisma.GroupWhereInput`, `take = 50` по умолчанию и **без верхнего предела** | `server/repositories/groupRepository.ts:255-281` | `?take=1000000` выгружает всю таблицу | Cap |
| P2-14 | Две расходящиеся реализации пагинации: `paginationQuerySchema` (default 50, max 100) и `parsePagination` (default 20, cap 100, **никем не импортируется**). У `organizersQuerySchema` и `groupApplicationsQuerySchema` пагинации **нет вовсе** | `server/validators/query.ts`; `server/utils/*` | Несогласованные лимиты; неограниченные выборки | Оставить одну реализацию |
| P2-15 | Нет схемы создания группы; нет кросс-проверки `endDate > startDate`; нет проверки «startDate в будущем»; `location` без `.max()`; `options` ограничивает массив (10), но не длину строк; `coOrganizers[].userId`/`tagIds[]` без проверки формата | `server/validators/group.ts` | Невалидные данные проходят в БД; массив строк неограниченной длины | `superRefine`; `.max()` |
| P2-16 | В `applySchema` **нет поля `message`**, хотя колонка `Application.message String?` существует, а `admin/applications.get.ts:62` её возвращает; `phone` без проверки формата | `server/validators/application.ts`; `server/api/admin/applications.get.ts:62` | Мёртвая колонка, которая всегда `null` и при этом отдаётся в админку | Либо добавить поле, либо убрать колонку |
| P2-17 | `loginSchema.password.min(8)` раскрывает политику паролей; `organizerData.bio`/`qualification` без `.max()`; `preferredLocale: z.enum(['ua','en'])`, тогда как колонка БД — свободный `String` | `server/validators/auth.ts`; `database/schema.prisma` | Помощь брутфорсу; неограниченный текст; расхождение схемы и БД | Generic-сообщение; лимиты; enum в БД |
| P2-18 | **Ни одного CHECK-ограничения во всей схеме**: нет `rating BETWEEN 1 AND 5`, `priceAmount >= 0`, `endsAt > startsAt`, `capacity > 0`, `preferredLocale IN ('ua','en')`, ISO-набора валют. У `Application` нет `@@unique([groupId,email])`, у `Review` — `@@unique([userId,groupId])` | `database/schema.prisma` | Целостность данных держится исключительно на прикладном слое; любой прямой запрос или пропущенная ветка ломают инварианты | CHECK + уникальные индексы миграцией |
| P2-19 | Отсутствуют индексы: `Group(startsAt)` (сортировка каталога по умолчанию), `Group(createdAt)`, `OrganizerProfile(verificationStatus)`, `User(role)` (используется fan-out уведомлений) | `database/schema.prisma` | Sort + seq scan на главной публичной странице | Создать |
| P2-20 | Избыточные префиксные индексы: `Group @@index([status])` (префикс от `[status,type]`), `GroupCoOrganizer @@index([groupId])`, `ApplicationAnswer @@index([applicationId])`, `Notification @@index([userId])`, `Favorite @@index([userId])` | `database/schema.prisma` | Усиление записи без пользы | Удалить |
| P2-21 | RLS-миграция — это `DO $$`-цикл по `pg_tables` на момент времени с **нулём политик**; `GroupCoOrganizer` создана на 4 дня позже и RLS **не получила** | `database/migrations/20260826120000_enable_rls` | Default-deny корректен (Prisma ходит под владельцем таблиц), но новая таблица выпала из того же режима | Явная миграция на все таблицы + тест-инвариант |
| P2-22 | Только **одна** из 30 миграций использует `IF EXISTS` (и там `RENAME COLUMN` на строке 11 не защищён) | `database/migrations/20260901120000_remove_system_specializations:11` | Миграции неидемпотентны; повторный прогон падает | Единый стиль |
| P2-23 | `20260825150000_group_form` **перевёл все цены RUB→UAH без конвертации курса**; `20260827172029_remove_group_category` делает необратимый `DROP TABLE "GroupCategory"`; `20260919125336_add_cascade_deletes` смешивает 3 несвязанных изменения, ставит `Application.groupId → ON DELETE CASCADE`, переводит все 3 FK `Review` из RESTRICT в CASCADE и расширяет `priceAmount` до `DECIMAL(65,30)`; `20260919150000_fix_price_decimal_precision` сужает обратно | `database/migrations/*` | Исторические данные цен искажены; удаление категории безвозвратно; риск тихого округления или прерывания `numeric field overflow` при сужении | Задокументировать в `docs/database.md`; проверить данные |
| P2-24 | `app/generated/prisma/` — 8 git-отслеживаемых файлов (21 авг), **никто их не импортирует**; `enums.ts` буквально содержит «This file is empty because there are no enums in the schema»; встроенная `inlineSchema` в `internal/class.ts:23` использует `provider = "prisma-client"` + `output = "../app/generated/prisma"` и **ноль моделей**; корневой `prisma/` пуст; `.gitignore` каталог не исключает | `app/generated/prisma/*`; `.gitignore` | Вторая, противоречащая конфигурация генератора в репозитории. Риск, что кто-то подключит её и получит клиент без моделей | Удалить каталог и добавить в `.gitignore` |
| P2-25 | В git отслеживается `executed` — транскрипт BSD `script(1)` с содержимым «Command: successfully. / Script: successfully.: No such file or directory»; `.gitignore` не покрывает `.qwen/`, `.claude/`, `.agents/`, `.windsurf/` | `executed`; `.gitignore` | Мусор в истории; локальные конфигурации агентов могут попасть в коммит | Удалить, расширить `.gitignore` |
| P2-26 | Нет `engines`, нет `packageManager`, `typescript` не объявлен (только транзитивно через Nuxt); рассинхрон `@prisma/adapter-pg ^7.9.1` / `@prisma/client ^7.10.0` / `prisma ^7.9.1`; устаревший блок `"prisma": { "seed": ... }`, который Prisma 7 игнорирует | `package.json` | Невоспроизводимые сборки между локальной машиной и Vercel; ложная конфигурация seed | Зафиксировать версии и менеджер пакетов |
| P2-27 | Ключа `sourcemap` нет → в прод уезжает **212 файлов `.map`** (все в `.output/server/`, клиентских 0); `compatibilityDate: '2025-07-15'` (~14 мес. назад); в `app.head` нет `htmlAttrs.lang` и нет `description` по умолчанию | `nuxt.config.ts` | Раскрытие исходников сервера + вес деплоя; устаревшая дата совместимости Nitro; HTML без `lang` до гидрации | `sourcemap: { server: false }`; обновить дату; дефолты в head |
| P2-28 | Заголовок `X-XSS-Protection: 1; mode=block` | `nuxt.config.ts` (`routeRules['/**'].headers`) | Директива устарела; OWASP рекомендует `0` — legacy-аудитор сам вносил XSS в старых браузерах | `X-XSS-Protection: 0` либо удалить |
| P2-29 | ESLint не обеспечивает ни одного собственного жёсткого правила проекта: нет проверки BEM/kebab-case (stylelint отсутствует entirely), нет `no-restricted-imports` для запрещённых зависимостей, нет запрета raw `fetch`, нет запрета Prisma в `app/`, нет правила против жёсткого i18n-текста, нет требования `<style scoped>`; `vue/no-v-html` — только warn; **`database/` в `ignores`** | `eslint.config.mjs` (проверено через `--print-config`: 180 правил) | Все архитектурные запреты AGENTS.md держатся на ревью. `database/seed.ts` (содержащий понижение sslmode) **не линтится никогда** | Включить соответствующие правила; убрать `database/` из ignores |
| P2-30 | `environment: 'happy-dom'` глобально, хотя все тесты серверные; `coverage.exclude: ['server/routes/**']` скрывает `sitemap.xml.ts` | `vitest.config.ts` | Лишняя зависимость и окружение; целая категория маршрутов не измеряется | `environment: 'node'` по умолчанию |
| P2-31 | `types/index.ts` лежит в **корневом `types/`**, а не в `shared/types/`, как требует AGENTS.md §4; рукописные дубликаты Prisma-моделей с `status: string` вместо union'ов enum'ов; в `GroupFormData.status` нет FULL/COMPLETED/CANCELLED; `Notification.read: boolean` против БД-`readAt DateTime?`; `MyApplication.group.startsAt: string` (non-null) против `Group.startsAt: string \| null` | `types/index.ts` (290 строк) | Типы расходятся с БД и не ловят ошибки; дубликаты устаревают молча | Генерировать из Prisma (`z.infer`/`Prisma.ModelGetPayload`) |
| P2-32 | В «общей» константе зашиты **hex-значения палитры Tailwind** (`#D1FAE5`, `#FEF3C7`, `#FEE2E2`, `#065F46`, `#92400E`, `#991B1B`) в проекте, который Tailwind запрещает и требует CSS-переменные. В `APPLICATION_STATUS_COLORS` нет WITHDRAWN; в `GROUP_STATUS_COLORS` нет DRAFT/FULL/COMPLETED/CANCELLED, и `groups/my.vue:19-21` доопределяет их локально | `shared/constants/statusColors.ts`; `app/pages/[locale]/groups/my.vue:19-21` | «Единый источник истины» таковым не является; потребители получают серые бейджи через `?.`-fallback | CSS-переменные; покрыть все значения enum |
| P2-33 | Доменные интерфейсы переобъявлены локально в 5 местах вместо импорта из `~~/types`: `Organizer` в `OrganizerCard.vue` и 4-я копия в `organizers/index.vue`; `AdminApplication`/`ApplicationStats`; `PendingProfile`; `UserProfile` | перечисленные + `app/pages/[locale]/profile/index.vue:6-22` | Одна сущность имеет 5 расходящихся форм. Добавление поля сервером не ломает компиляцию — копии молча рендерят `undefined`. `profile/index.vue:66` требует **18 приведений `as string`** именно потому, что ответ типизирован как `Record<string, unknown>` | Импортировать общие DTO |
| P2-34 | Пять рукописных контрактов `defineExpose` с **тремя разными именами одной операции**: `loadProfiles`, `loadData`, `loadData`, `loadGroups`, `loadApplications`; дополнительно экспонируются никем не читаемые `loading`/`stats`/`loaded` | `app/pages/[locale]/admin/index.vue:13-17`; `AdminApplicationsTab.vue:104` | Отсутствие единого контракта вкладок — причина P0-6 | `interface AdminTab { load(): Promise<void> }` |
| P2-35 | Нарушения AGENTS.md §10: `forceHide()` не вызывается перед `navigateTo()` в guard'ах; локальные полностраничные спиннеры | `admin/index.vue:46` (файл даже не импортирует `usePageLoading`); `register.vue:81,84`; `login.vue` через `useUser.ts:63`; `groups/edit/[slug].vue:124,132,157`; `index.vue`; спиннеры — `admin/index.vue:60-66` и `auth/callback.vue:62` (последний рендерится **одновременно** с глобальным PageLoader) | Редирект при ненулевом счётчике оставляет полноэкранный лоадер поверх целевой страницы | `forceHide()` перед каждым guard-редиректом |
| P2-36 | **6 файлов создают таймеры, не очищаемые при размонтировании** (ни в одной странице нет `onUnmounted`/`onBeforeUnmount`; среди компонентов он есть только у `UiModal.vue:73`, `UiDrawer.vue:73`, `AppHeader.vue:38`) | `Combobox.vue:24-28` + голый `setTimeout` на `:86`; `CoOrganizersPicker.vue:23-33`; `FavoriteButton.vue:57`; `register.vue:81`; `catalog/index.vue:42-50`; `catalog/[type].vue:56-64` | Колбэки срабатывают на размонтированных компонентах; таймер в `register.vue:81` (3 с) **уводит пользователя даже после того, как он ушёл со страницы** | Хранить handle, чистить в `onBeforeUnmount` |
| P2-37 | Нет индикатора загрузки на деструктивных/submit-действиях | `AdminGroupsTab.vue` (`approveGroup` — двойной клик = два PATCH); `groups/edit/[slug].vue:152-160` (`confirmDeleteDraft` без флага и без `:loading` у `UiConfirmModal`, в отличие от `groups/my.vue`); `login.vue:37-48` (кнопка Google заблокирована флагом **парольной** формы); `groups/edit/[slug].vue:466-471` (Publish disabled, но без спиннера и без смены подписи) | Двойные отправки; «зависший» вид при медленной операции | Флаги submitting + `:loading` |
| P2-38 | **7 `console.error` выводят сырые объекты ошибок в консоль браузера**, в т.ч. ошибку OAuth (может содержать authorization `code`) | `auth/callback.vue:31`; `groups/edit/[slug].vue:138,165`; `groups/new.vue:41`; `profile/edit.vue:108,149`; `AvatarUploader.vue:92`; `useGroupForm.ts:158` | AGENTS.md §15 запрещает раскрывать стектрейсы и внутренние детали клиенту. Консоль читается любым расширением | Логировать только серверно |
| P2-39 | Слот ошибки **отправки** использован для ошибки **загрузки**, с другим i18n-ключом, чем у пути отправки | `app/pages/[locale]/profile/edit.vue:105-108` vs `:148` | Баннер ошибки над незаполненной формой; несогласованные сообщения | Раздельные состояния |
| P2-40 | Пустые состояния без призыва к действию: `notifications.vue`; `groups/applications/[slug].vue:130-135`; `organizers/index.vue`; `GroupSection.vue` (при пустом массиве не рендерит **ничего**); все 5 админ-вкладок | перечисленные | Тупик без подсказки следующего шага. Правильный образец уже есть — `favorites.vue`, `applications/my.vue`, `groups/my.vue:136-155` | Общий компонент empty-state (текст + CTA) |
| P2-41 | Три страницы вкладывают второй `<main>` внутрь `<main id="main-content">` из лейаута | `groups/[slug].vue:285`; `organizers/index.vue:43`; `organizers/[slug].vue:169`; лейаут — `layouts/default.vue:59` | Два landmark `main` в документе; «перейти к основному» неоднозначно. WCAG 1.3.1 | `<section>`/`<div>` |
| P2-42 | `UiModal.vue` **не возвращает фокус** при закрытии (нет сохранённого `document.activeElement`), хотя `UiDrawer.vue:73` это делает | `app/components/ui/UiModal.vue` | После закрытия модалки заявки (`groups/[slug].vue:404`) или любого админ-подтверждения фокус падает в `<body>` → следующий Tab начинает с верха документа. WCAG 2.4.3. Задевает 5 + 3 потребителя | Перенести паттерн из `UiDrawer` |
| P2-43 | `UiTabs.vue`: `role="tablist"`/`"tab"` есть, но **нет `aria-controls`, `role="tabpanel"`, `aria-labelledby`, roving tabindex и стрелок**; при сокращении списка остаются протухшие ref | `app/components/ui/UiTabs.vue` (потребители `admin/index.vue:71`, `groups/applications/[slug].vue:126`) | Паттерн вкладок реализован наполовину | APG Tabs |
| P2-44 | `UiAutocomplete.vue` и `Combobox.vue` — почти дубликаты; у обоих нет `aria-activedescendant`, `aria-controls` и `id` у опций; строка загрузки не является `role="option"` внутри listbox | `app/components/ui/UiAutocomplete.vue` (308); `app/components/forms/Combobox.vue` (204) | Скринридер не объявляет активный вариант; два компонента под одну задачу | Объединить в один |
| P2-45 | `role="radiogroup"` + два `<button role="radio">` **без стрелочной навигации и roving tabindex**; `UiRadio.vue` существует и здесь не использован | `app/pages/[locale]/auth/register.vue:123-149` | Взяв ARIA-роль, автор принял на себя клавиатурный контракт APG и не выполнил его | Либо `UiRadio`, либо полная реализация |
| P2-46 | Структура заголовков: пропуски уровней (`groups/edit/[slug].vue` h1→h3, `AdminApplicationsTab.vue` h2→h4, `notifications.vue` h1→h3); 10 соседних `<h2>` на 9 групп в `groups/my.vue`; `<h2>` для названий колонок в `AppFooter.vue`; `<h2>` в `GroupCard.vue` внутри `GroupSection`; **в `groups/new.vue` и `auth/callback.vue` заголовков нет вообще** | перечисленные | Навигация по заголовкам для скринридера сломана | Исправить иерархию |
| P2-47 | Изменения состояния не объявляются: нет `role="status"`/`aria-live` у индикатора автосохранения (`groups/edit/[slug].vue:426-437`), спиннеров админ-вкладок, счётчика непрочитанных в шапке, текста загрузки `profile/index.vue:60`, смены статуса после approve/reject. `PageLoader.vue` ставит `aria-label` на область `aria-live` (не объявляется) | перечисленные | Асинхронная обратная связь невидима. Корректно сделано в `register.vue:105`, `profile/edit.vue:200,208`, `groups/edit/[slug].vue:524`, `ApplicationForm` | Добавить live-регионы |
| P2-48 | Нет `<NuxtRouteAnnouncer>`; цель skip-link `<main>` без `tabindex="-1"` | `app/app.vue`; `layouts/default.vue:59` | Клиентские переходы немы для скринридера; skip-link может не перемещать фокус | Добавить |
| P2-49 | `prefers-reduced-motion` обнуляет только `--transition-base`/`--transition-slow`; все `animation` продолжают работать | `app/assets/css/variables.css:158-163`; спиннер `PageLoader`, 5 дублей `@keyframes spin`, `UiAccordion`, `router.options.ts:6` `behavior: 'smooth'` | Провал WCAG 2.3.3 | Обнулять и анимации; учитывать настройку в scroll behavior |
| P2-50 | Нет медиа-запросов там, где они нужны: `CoOrganizersPicker.vue` (многоколоночный пикер), `applications/my.vue`, `profile/index.vue` (`.profile-page__row { justify-content: space-between }` с длинным email и без `min-width: 0`/`overflow-wrap`); **4 админ-таблицы без обёртки горизонтального скролла** | перечисленные | Переполнение на 375 px; 6-колоночная таблица вылезает за viewport телефона | Медиа-запросы; `overflow-x: auto` |
| P2-51 | Липкая CTA `position: fixed; bottom: 0` **без компенсирующего нижнего padding** контента | `app/pages/[locale]/groups/[slug].vue:388-401` | На мобильном навсегда закрывает последние строки описания группы и футер | `padding-bottom` на контейнер |
| P2-52 | Формы: `<fieldset>` вне `<form>` (`groups/edit/[slug].vue:184`) → нет события submit, нет нативной валидации, `required` на `:232,240,250,313` инертны. `ApplicationForm.vue` хранит мультивыбор как **строку через запятую**. `register.vue:224-303` — смена роли уничтожает введённые имя/квалификацию/bio без предупреждения. `groups/edit/[slug].vue:62-67` — снятие «Бесплатно» обнуляет цену. `:87-93` — кросс-правило молча стирает `endDate`. `login.vue:31` защищён только `:disabled`. **Три разных самодельных regex для email** | перечисленные | Вариант, содержащий запятую, неотличим от двух вариантов → **необратимая порча сохранённых ответов** (чувствительные данные). Потеря введённого. Быстрый двойной клик проходит до ре-рендера. Валидация не выведена из Zod-схемы | `<form>`; массив значений; подтверждение при потере данных; guard на входе в функцию; общая валидация |
| P2-53 | `window.open(url, '_blank')` **без `noopener`**; `window.location.href = response.url` присваивает URL, пришедший с сервера, без проверки хоста | `app/pages/[locale]/groups/edit/[slug].vue:141`; `app/pages/[locale]/auth/login.vue:45` | Reverse tabnabbing; примитив open redirect при ошибке конфигурации `google-start` | `'noopener'`; allowlist хостов |
| P2-54 | Запросы и мутации внутри презентационных компонентов; опрос каждые 30 с без проверки `document.visibilityState`, причём забирается **полный список** уведомлений только чтобы посчитать непрочитанные | `CoOrganizersPicker.vue:33`; `OrganizersTable.vue`; `AppHeader.vue:27`; `FavoriteButton.vue` | Нарушение AGENTS.md §3; компоненты невозможно отрендерить в тесте без живого API; лишний трафик в фоновой вкладке | Вынести в composables; использовать `countUnread` (метод **уже существует и мёртв**) |
| P2-55 | Бизнес-правила зашиты в элементы UI: счётчик capped на **99**; максимум **10** вопросов с валидацией через **нативный `alert()`**; `:max="50"` лет опыта; время начала по умолчанию **10:00**; молчаливый лимит 60 символов; минимум пароля 8 как литерал в двух файлах | `GroupFilters.vue`; `GroupQuestionsBuilder.vue:34`; `profile/edit.vue:290,67`; `groups/edit/[slug].vue:38`; `login.vue:22`/`register.vue:32` | `alert()` не переводится, не стилизуется и блокирует поток. Каждое магическое число — серверное правило без общей константы → клиент и сервер расходятся молча | Inline-валидация; константы в `shared/constants` |
| P2-56 | Вывод доменного состояния из косвенных данных: `isRejected = !!formData.rejectionReason`; `isNewGroup = status === 'DRAFT' && title === ''`; `isCoOrganizer` выводится из `groupOwnerId !== user.id` и до загрузки равен `false` | `app/pages/[locale]/groups/edit/[slug].vue:164,168,15-19,358` | Устаревшая причина отклонения показывает баннер «отклонено» на **опубликованной** группе; во время окна загрузки баннер соорганизатора и секция `v-if="!isCoOrganizer"` рендерятся неверно | Использовать `status` напрямую; не вычислять до загрузки |
| P2-57 | `navigateForNotification` сопоставляет типы уведомлений с маршрутами внутри страницы, включая `ORGANIZER_PENDING_REVIEW → /admin` | `app/pages/[locale]/notifications.vue` | Неверно для организаторов-не-админов, которые это уведомление и получают | Карта маршрутов в общем модуле с проверкой прав |
| P2-58 | Логика форматирования дат внутри UI-примитива | `app/components/ui/UiInput.vue:41-61` | Примитив решает, как呈现 доменные даты — AGENTS.md §5 | Вынести в `utils/format` |
| P2-59 | Composables вызываются вне setup: `useRoute()` **внутри колбэка map в computed**; `useNuxtApp()` внутри геттера computed; `useCookie()` внутри `setLocale()`; `useLocale()` внутри `login()` | `AppBreadcrumbs.vue`; `composables/useBreadcrumbs.ts`; `composables/useLocale.ts`; `composables/useUser.ts:63` | Работает только потому, что контекст Nuxt случайно активен; ломается на `async`-границах и невидимо для компилятора | Передавать контекст явно |
| P2-60 | Индекс-ключи на изменяемых списках (4 реально опасных из 9): вопросы и варианты в конструкторе (добавляются, удаляются, переставляются) и специализации (удаляются по индексу) | `GroupQuestionsBuilder.vue:105,182,231`; `profile/edit.vue:337,74-76` | Удаление элемента 0 переключает всех соседей → Vue патчит не те поля: введённый текст и тип `SINGLE_CHOICE`/`MULTIPLE` могут прикрепиться к другому вопросу | Стабильный id (`crypto.randomUUID()` при создании) |
| P2-61 | `pendingCount.value = pendingGroups.value.length` (длина **страницы**) вместо серверного total, тогда как `:67` корректно использует `pendingResult.total` | `app/components/admin/AdminGroupsTab.vue:44` | Бейдж падает, например, с 47 до 19 сразу после первого действия | Единый источник |
| P2-62 | `:show-type="false"` — **не объявленный prop** `GroupFilters` | `app/pages/[locale]/catalog/[type].vue:195` | Молча игнорируется → фильтр по типу показывается на странице конкретного типа, где он бессмыслен. Сама страница — ~90% копия `catalog/index.vue` (~270 общих строк); `AdminUsersTab`/`AdminOrganizersTab` — ~95%; `login`/`register` делят ~150 строк CSS; `formatLabel` существует в **4** файлах (только `organizers/[slug].vue:70` обрабатывает `MIXED` → один enum отображается по-разному); карта locale→`uk-UA`/`en-US` дублируется в **7** местах; `@keyframes` спиннера — **5** раз | Объявить prop; вынести общее |
| P2-63 | `useLocale.ts:38` возвращает сырой ключ при промахе; динамические ключи (`t(`groupTypes.${type}`)`, `t(`groups.my.statuses.${status}`)`, `t(`users.roles.${role}`)`, `t(`profile.verification.${status}`)`, `t(`applications.my.statuses.${status}`)`) + `String.replace` с параметрами, на которые влияет пользователь | `app/composables/useLocale.ts` | **Механизм** подтверждён: любое новое значение enum покажет в проде буквально точечный ключ. Все существующие пространства ключей на месте (проверено: `groupTypes`, `statuses`, `roles`, `verification` incl. `REJECTED`, `currencies` — паритет 518/518 и 56/56), так что сейчас это **латентный**, а не активный дефект. `replace` допускает инъекцию regex/`$`-шаблона | CI-проверка покрытия всех значений enum; экранировать параметры |
| P2-64 | `UsersTable.vue` рендерит **сырой enum `user.role`** пользователю и жёстко задаёт локаль `'ua'` для `formatDate` | `app/components/features/admin/UsersTable.vue` | Англоязычный админ видит украинские даты и нетронутые enum-значения — ровно то, что AGENTS.md §9 запрещает (в обратную сторону) | `t(`users.roles.${role}`)`; текущая локаль |
| P2-65 | Два разных разделителя заголовков; пустой `og:image`; жёстко зашитый английский внутри JSON-LD для всех локалей | `groups/[slug].vue:123` (`\|`) vs `organizers/[slug].vue:61` (`—`); `organizers/[slug].vue:65`; `groups/[slug].vue:103` (`'name': g.location \|\| 'Online'`) | Несогласованные сниппеты в выдаче; сломанный превью-карточки; английский в структурированных данных украинской страницы | Единый разделитель; абсолютный OG; локализованное значение |
| P2-66 | Middleware редиректит **всех**, включая краулеров, на локаль из cookie и **теряет query string и hash** | `app/middleware/locale.global.ts` | AGENTS.md §9 говорит, что `ua` — язык по умолчанию «для первых посетителей и SEO-краулеров», но middleware не отличает «нет cookie» от `locale=ua` → краулер, однажды получивший `locale=en`, навсегда обслуживается английским. Теряются UTM и фильтры при редиректе | Различать отсутствие cookie; сохранять query/hash |
| P2-67 | `consumeBackTo()` **удаляет** ключ при чтении; доступ к `sessionStorage` без try/catch; приведение без проверки | `app/utils/backTo.ts:5-10` | Обновление `groups/[slug].vue` теряет ссылку «назад»; в приватном режиме Safari **бросается исключение**. `organizers/[slug].vue` рендерит `<GroupCard>` без `back-source` → группы, открытые со страницы организатора, ссылки «назад» не имеют | try/catch; не удалять при чтении |
| P2-68 | Неопределённые CSS-токены без fallback: `var(--shadow-xl)` (в `variables.css` есть только `-sm/-md/-lg`) и `var(--color-text-secondary)` в 3 местах | `UiDrawer.vue:142`; `catalog/[type].vue:237`; `AdminProfilesTab.vue:257`; `AdminApplicationsTab.vue:522` | Объявление невалидно на этапе computed-value → `box-shadow` становится `none`: мобильное меню рисуется **без тени**, его край невидим. Цвет текста наследует полный основной цвет → задуманная иерархия молча исчезает | Определить токены либо использовать существующие |
| P2-69 | Потеряно `position: sticky`: заданы `top:` + `align-self: start` и `position: static` в медиа-запросе, но базового `position: sticky` нет | `groups/[slug].vue:551-552`; `organizers/[slug].vue:496` (корректный вариант — `groups/edit/[slug].vue:699-701`) | Боковая панель с ценой/датой/вместимостью уходит при прокрутке именно тогда, когда пользователь принимает решение | Добавить одну строку в каждом файле |
| P2-70 | Стили `UiButton` вручную повторены **≥8 раз**, в т.ч. **поверх** `<UiButton>` (оба набора правил конфликтуют) и дословно продублированы между двумя страницами; в одном месте с зашитым `height: 40px`, подогнанным под внутреннюю метрику `UiInput` | `groups/my.vue` ×2; `groups/[slug].vue`; `favorites.vue` + `applications/my.vue`; `profile/index.vue`; `profile/edit.vue`; `AdminGroupsTab.vue`; `OrganizersTable.vue`; `GroupQuestionsBuilder.vue` ×3 | Корень — `UiButton.vue` поддерживает только `<button>`: нет `to`/`href` и нет `loading`. Любая ссылка-кнопка делается вручную | Добавить `to`/`href` + `loading`, затем удалить копии |
| P2-71 | Клиентский JS **517.41 kB / 52 файла** (крупнейший `_nuxt/CLCDh1Fj.js` 159.10 kB, затем 94.54 kB); клиентский CSS **139.30 kB / 36 файлов**; серверный бандл 13 MB; Σ **5.99 MB (1.52 MB gzip)** | вывод `npm run build` | Вес первого экрана на мобильной сети; крупнейший чанк не разделён по маршрутам | `nuxt analyze` (не запускался — см. §9); manual chunks |
| P2-72 | Бейдж «Verified» рендерится **безусловно**; `hasSidebar` учитывает только 3 из 7 соцсетей | `app/pages/[locale]/organizers/[slug].vue:126`, `hasSidebar` | Неверифицированный организатор отображается как верифицированный (доверие пользователей). Организатор только с WhatsApp теряет **всю** боковую панель | `v-if="verificationStatus === 'VERIFIED'"`; учесть все 7 |
| P2-73 | `groups/[slug].vue` — soft-404 (`createError` не вызывается), тогда как `organizers/[slug].vue:13-18` бросает настоящий 404 | `app/pages/[locale]/groups/[slug].vue` | Несуществующая группа отдаёт 200 → Google индексирует пустую страницу | Единый паттерн |
| P2-74 | Страница создаёт группу POST-запросом **при своём посещении**; `isCreating` не сбрасывается при ошибке; проверка `VERIFIED` отсутствует, несмотря на комментарий о ней | `app/pages/[locale]/groups/new.vue` | Каждый визит плодит брошенный черновик с `title: ''`; при сбое страница застревает | Создавать черновник по явному действию |
| P2-75 | Локальный спиннер одновременно с глобальным PageLoader; нет `role="alert"`; мёртвый ref `errorMessage` | `app/pages/[locale]/auth/callback.vue:17-33,30,62` | Двойная индикация загрузки; ошибка OAuth не объявлена | Убрать локальный спиннер |

---

## 4. Мелкие проблемы (P3)

| # | Проблема | Файл | Рекомендация |
|---|---|---|---|
| P3-1 | Мёртвый код сервера: `requireRole` не импортируется нигде; `parsePagination` не импортируется; **8 мёртвых методов репозиториев** — `applicationRepository.findByEmail`, `applicationRepository.findGroupBasic`, `favoriteRepository.findByUserAndGroup`, `groupRepository.findWithOrganizerLocale`, `groupRepository.findProfileByUserId`, `notificationRepository.countUnread`, `organizerRepository.findProfileByUserId`, `userRepository.findByEmail` | `server/utils/auth.ts:68`; `server/repositories/*` | Удалить либо подключить (часть из них — готовые замены inline-запросам, см. P1-33) |
| P3-2 | ~30 мёртвых CSS-правил (селектор есть, соответствующего элемента в шаблоне того же файла нет), включая **4 правила удалённой фичи тегов** | `groups/edit/[slug].vue` (`.group-edit__tags`, `__tag`, `__tag--active`, `__tag-checkbox`); `profile/edit.vue` (`__field-value`, `__row--three` + override 640px); `AppFooter.vue` ×5; `HowItWorksSection.vue`; `GroupFilters.vue` (`__input--with-icon`); `groups/[slug].vue` (`__organizer-bio` + поле `bio: null` на `:174-175`); `AppHeader.vue` (`:deep()` на scoped-класс потомка — не может совпасть никогда) | Удалить; добавить stylelint `no-unused-selector` для SFC |
| P3-3 | Мёртвые computed/ветки: `visibleSpecializations` возвращает вход без изменений; `presets` всегда `[]`; `onTabChange` переприсваивает то, что уже сделал `v-model`; недостижимый `v-if`; вторая ветка `v-else-if` рендерит то же, что предыдущая; избыточный ref; недостижимый `DEFAULT_OG_IMAGE` | `OrganizerCatalogCard.vue`; `GroupQuestionsBuilder.vue`; `admin/index.vue:29-31`; `organizers/[slug].vue:95-99`; `profile/edit.vue:186-190`; `auth/callback.vue:30`; `useSeoPage.ts` | Удалить |
| P3-4 | Мёртвые токены дизайна: `--transition-slow`, `--color-secondary`, `--color-accent` (определены, ни разу не использованы — проверено полным сканом `var(--*)`) | `app/assets/css/variables.css:152` и др. | Удалить либо применить вместо зашитых `300ms`/`all` |
| P3-5 | Мёртвые/избыточные зависимости: `@iconify-json/lucide` (**0 ссылок** вне `package.json`, хотя он решил бы P0-5); `pg` и `@types/pg` (транзитивны для `@prisma/adapter-pg`); `happy-dom` и `@nuxt/test-utils` (установлены, DOM-тестов нет) | `package.json` | Удалить, кроме `@iconify-json/lucide` — его стоит задействовать |
| P3-6 | Мусор в git: `executed` (транскрипт `script(1)`), `app/generated/prisma/` (8 файлов) | корень; `app/generated/prisma/` | Удалить и добавить в `.gitignore` |
| P3-7 | Props без значений по умолчанию, где они нужны для корректности: `options` (обязательный, без default), `name` (без default → radio вне группы), все props опциональны, что делает неоднозначным API | `UiSelect.vue`; `UiRadio.vue`; `OrganizerCard.vue` | Задать defaults / сузить типы |
| P3-8 | `UiPill.vue` принимает произвольные CSS-строки цвета (`background`, `color`) и используется с литералами `'var(--color-primary)'` | `app/components/ui/UiPill.vue`; `groups/my.vue` | Лазейка мимо дизайн-токенов → заменить на именованные варианты |
| P3-9 | Нарушения BEM: **модификатор без класса блока** (`checklist-item--done`, при этом `checklist-item` не применяется вовсе — работает только благодаря descendant-селектору); компонент стилизует себя классами чужого блока | `groups/edit/[slug].vue:445-460`, `:~758`; `UiLogo.vue` (`app-header__logo*`) | Исправить именование |
| P3-10 | Обход токенов: `border: 1px solid` вместо `var(--border-width)` (6 мест); `border-radius: 50%` вместо `var(--radius-full)`; литерал `color: white`; зашитые `rgba(23,58,58,…)`; `%235a7a7a` внутри SVG data-URI; `transition: all` ×4 | `profile/edit.vue:536,546`; `groups/[slug].vue` ×3; `groups/edit/[slug].vue`; `HowItWorksSection.vue`; `auth/callback.vue:95`; `profile/index.vue`; `UiModal.vue:128`; `AvatarUploader.vue`; `variables.css:135-137`; `UiSelect.vue` | Заменить на токены |
| P3-11 | `{{ org.firstName[0] }}{{ org.lastName[0] }}` при пустой строке даёт `undefined` → в кружке аватара **буквально печатается «undefined»**; не `aria-hidden` (имя объявляется дважды). Та же логика инициалов продублирована в 3 других файлах | `groups/[slug].vue:357`; `UiAutocomplete.vue:88`; `CoOrganizersPicker.vue:96`; `OrganizerCatalogCard.vue:23` | Общая утилита инициалов с guard |
| P3-12 | `UiAccordion.vue` держит свёрнутый контент в DOM → фокусируемые элементы внутри свёрнутого ответа FAQ доступны по Tab, будучи невидимыми; `max-height: 500px` обрезает длинные ответы (используется для всех 8 вопросов) | `app/components/ui/UiAccordion.vue`; `app/pages/[locale]/faq.vue` | `hidden`/`v-if`; высота по содержимому |
| P3-13 | Сетки `minmax(300px, 1fr)`: на 375 px минус 2×24 px padding остаётся 327 px — впритык, ~15 px запаса | `GroupSection.vue`; `organizers/[slug].vue` | `minmax(min(300px, 100%), 1fr)` |
| P3-14 | `.group-edit-sidebar { order: -1 }` ниже 1024 px перемещает «Опубликовать / Предпросмотр / **Удалить**» **выше всей формы** — на телефоне пользователь встречает деструктивные действия раньше любого поля ввода | `app/pages/[locale]/groups/edit/[slug].vue:695-698` | Убрать `order: -1` либо перенести действия вниз |
| P3-15 | Hero-изображение скачивается, но скрыто ниже 1199 px; у `<img>` нет `width`/`height` → CLS | `app/components/sections/HeroSection.vue` | `<picture>`/`srcset` либо не грузить; задать размеры |
| P3-16 | `utils/languages.ts:4` при загрузке модуля eagerly строит **184 языка** | `app/utils/languages.ts` | Ленивая инициализация |
| P3-17 | `en-GB` здесь против `en-US` в других местах; нет `Intl.NumberFormat`; символ валюты ставится после суммы для всех валют | `app/utils/format.ts` (22 потребителя) | Единая локаль форматирования |
| P3-18 | `name="given-name"` / `name="family-name"` — это токены `autocomplete`, а не имена полей (сами `autocomplete` заданы отдельно и верно) | `app/pages/[locale]/auth/register.vue:249,268` | Заменить на осмысленные `firstName`/`lastName` |
| P3-19 | 5 внутренних ссылок через `<a :href>` вместо `<NuxtLink>` (все `target="_blank"`, т.е. намеренно) — полный перезагруз страницы, потеря SPA-состояния и prefetch, обход middleware локали | `AdminGroupsTab.vue:190,204,290,303`; `OrganizersTable.vue:87` | `NuxtLink` с `target="_blank"` |
| P3-20 | Нет `aria-current="page"` на активном пункте меню и хлебных крошек; при этом `aria-current="page"` проставлен **многоточию** | `DrawerMenuItem.vue`; `AppBreadcrumbs.vue:84` | Перенести на активный элемент |
| P3-21 | `behavior: 'smooth'` игнорирует `prefers-reduced-motion`; assertion типа вместо `satisfies` | `app/router.options.ts:6` | Учитывать настройку |
| P3-22 | Guard'ы `beforeEach` регистрируются без очистки; regex локали зашит | `app/layouts/default.vue` | Вынести |
| P3-23 | Смешанные стили импортов: 198 относительных против 53 `~~/`, 5 `~/` и 4 `#app`; **57 импортов глубиной 3+ уровня** | весь `app/` и `server/` | Единый алиас |
| P3-24 | Смешанные языки комментариев в одном файле (русский `:37`; украинские `:71,96,104,141,148`); русский TODO; русские комментарии и сообщение `throw` в конфигурации Prisma | `groups/edit/[slug].vue`; `index.vue:85`; `prisma.config.ts` | Единый язык (AGENTS.md §2: технический английский) |
| P3-25 | `AUDIT-REPORT.md` изменён и не закоммичен; содержит **2 вывода, опровергнутых текущим кодом**: m9 (утверждал отсутствие `public/robots.txt` — файл есть) и M8 (утверждал отсутствие валидации в `groups.get.ts` — `groupsQuerySchema` применяется на `:2,:8`) | `AUDIT-REPORT.md` | Актуализировать и закоммитить |
| P3-26 | Мёртвые переменные в локальном `.env`: `SUPABASE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`; `RESEND_API_KEY` — 8-символьный placeholder. На строке 3 — **случайно вставленная shell-команда `npx prisma generate`**. Файл в git не отслеживается (проверено по всем веткам) | `.env` | Очистить; удалить строку 3 |
| P3-27 | Две побайтово идентичные функции (`openRejectionModal` и `returnToRevision`, обе шлют `status: 'REJECTED'`); флаг `loaded` блокирует любое обновление на всё время жизни компонента | `app/components/admin/AdminGroupsTab.vue:139-148`, `:47` | Объединить; убрать флаг |
| P3-28 | `AppFooter.vue` жёстко задаёт `PsyGroup`/`©`/`💚` и использует `<h2>` для названий колонок (загрязняет outline документа) | `app/components/layout/AppFooter.vue` | В локали; `<h3>`/`<p>` |
| P3-29 | `close()` эмитит и `update:modelValue`, и `cancel`, а Escape и клик по подложке — только `update:modelValue` → обработчики `@cancel` срабатывают на одних путях закрытия и не срабатывают на других | `app/components/ui/UiConfirmModal.vue` | Унифицировать семантику закрытия |
| P3-30 | `<component :is>` при неаутентифицированном пользователе эмитит `type="button"` на `<span>` (невалидный атрибут) | `app/components/features/FavoriteButton.vue` | Условный рендер |
| P3-31 | `GroupCard.vue` использует `<h2>`, находясь внутри `GroupSection`; `groups/my.vue` рендерит 10 соседних `<h2>` на 9 групп | `GroupCard.vue`; `groups/my.vue` | `<h3>` |
| P3-32 | Сервис вызывается **до** проверки разрешений | `server/api/groups/[slug].get.ts` | Сначала авторизация |
| P3-33 | `components: [{ path: '~/components', pathPrefix: false }]` — коллизий basenames сегодня нет (проверено), но защита отключена | `nuxt.config.ts` | Вернуть `pathPrefix` либо добавить проверку коллизий |
| P3-34 | `Inter 600` **не загружен**, хотя `--font-weight-semibold: 600` используется → faux bold; `Lora` только в 700 | `app/assets/css/fonts.css` | Загрузить нужные начертания |
| P3-35 | `UiIcon.vue` не предоставляет механизма доступного имени для недекоративных иконок и является единственным компонентом без блока `<style>` | `app/components/ui/UiIcon.vue` | Prop `label` → `aria-label` |
| P3-36 | `var(--spacing-3xl, 4rem)` — fallback есть (безвредно), но токена не существует; шаги оформлены `<div>`, а не `<ol>/<li>` | `app/components/home/HowItWorksSection.vue:66` | Определить токен; семантический список |
| P3-37 | Адреса email вшиты в сами строки перевода | `app/pages/[locale]/contacts.vue` | Интерполяция параметром |
| P3-38 | Жёсткий набор ключей `q1`–`q8` | `app/pages/[locale]/faq.vue` | Массив объектов |
| P3-39 | Дубли CSS-свойства `left` | `app/components/ui/UiInput.vue:207,209` | Удалить |
| P3-40 | Лишний явный импорт в корневом компоненте | `app/app.vue:2` | Удалить (auto-import) |
| P3-41 | `PageLoader.vue`: `z-index: 9999`, нет focus trap/`inert`, нет учёта `prefers-reduced-motion`, index-ключ на `:26` | `app/components/layout/PageLoader.vue` | `inert` на контент под оверлеем |
| P3-42 | `HowItWorksSection.vue` `border-radius: 50%` вместо токена; `minmax(300px,1fr)` | `app/components/home/HowItWorksSection.vue` | Токены |

---

## 5. Что работает хорошо

### Архитектура и стиль (подтверждено инструментально и программно)

- **68 из 68 SFC** используют `<script setup>` + TypeScript + Composition API; **68 из 68** соблюдают порядок `script → template → style`; **каждый блок `<style>` — `scoped`** (ноль unscoped).
- **Ноль точек с запятой** в TS; везде одинарные кавычки; BEM-именование последовательно; **ровно один `!important`** на 17 тысяч строк (`UiDrawer.vue:216`).
- **Запрещённых зависимостей нет вообще**: ни Tailwind, ни Bootstrap/UI-фреймворка, ни CSS-in-JS, ни Axios, ни jQuery. **0 сырых `fetch(`** в `app/` — всё через `$fetch`/`useFetch`/`useAsyncData` (50 использований `$fetch`).
- **Реальная система дизайн-токенов, а не клон Tailwind**: `variables.css` — 87 осмысленных свойств с документирующими комментариями, секционными баннерами, адаптивным `--header-height` (`:165-169`) и блоком `prefers-reduced-motion` (`:158-163`). Мёртвых токенов всего 3, неопределённых ссылок — 4.
- **0 `$queryRaw`/`$executeRaw`** во всём проекте — SQL-инъекций через сырые запросы нет.
- **0 импортов Prisma в `app/`** — база строго серверная (AGENTS.md §12).
- **0 коллизий basenames** компонентов при `pathPrefix: false`; **ни одного неиспользуемого компонента** из 44 (у всех ≥1 потребитель; `UiButton` — 20, `UiIcon` — 12, `useLocale` — 59).
- `as any` / `@ts-ignore` / `@ts-expect-error` в `app/`+`server/`+`shared/` — **0** (все 6 `as any` находятся в тестах, на строках `globalThis.prisma`). `debugger` — 0.
- **18 inline `eslint-disable-next-line`, все с обоснованием `--`, ноль файловых/репозиторных отключений.** `npm run lint` → **0 ошибок, 0 предупреждений** на 180 файлах.

### Безопасность

- **Все 8 секретов находятся в приватном `runtimeConfig`** — в `public` только `siteUrl` и `supabaseUrl`. **Утечки секретов на клиент нет** — это главный потенциальный P0, и он отсутствует.
- **Аватар-эндпоинт корректно исключает SVG** из MIME-allowlist, ограничивает 5 MB и **генерирует имя файла на сервере** (`${user.id}-${Date.now()}.${ext}`) — path traversal невозможен.
- **Каждая ссылка с `target="_blank"` несёт `rel="noopener"`/`"noopener noreferrer"`** — все 7 соцсетей в `organizers/[slug].vue:262-330` и все 5 админ-ссылок. Исключений не найдено.
- `role: z.enum(['VISITOR','ORGANIZER'])` в `server/validators/auth.ts` **корректно исключает ADMIN** — эскалация привилегий при регистрации невозможна.
- `login.vue` и `register.vue` — **самые доступные формы в проекте**: `autocomplete="username"/"current-password"/"new-password"/"given-name"/"family-name"`, `aria-describedby` на каждом поле, `role="alert"` на каждой ошибке, `role="status"` на сообщении о модерации, `novalidate` + собственная валидация, все элементы `:disabled` во время отправки, корректные пары `:focus`/`:focus-visible`.
- `.env` **никогда не коммитился ни в одной ветке** (проверено по истории); `.gitignore` покрывает `.env`/`.env.*` с исключением `!.env.example`, `.DS_Store`, `coverage/`. **Ни один используемый в коде env-var не отсутствует в `.env.example`.**
- RLS-миграция `20260826120000_enable_rls` — осознанный default-deny (Prisma подключается как владелец таблиц), подход методологически верен.
- `20260901130000_languages_to_iso_codes` написана образцово (fallback `ELSE lower(l)`); `20260824220000_add_organizer_slug` использует учебный паттерн nullable → backfill → NOT NULL.
- **Обработка чувствительных данных осознанна**: ответы заявителей рендерятся только за гейтом организатора, все страницы заявок помечены `noindex`, `groups/applications/[slug].vue` никогда не логирует содержимое ответов.
- **Все приватные страницы устанавливают `noindex, nofollow`** (admin, profile, groups/my, applications, favorites, notifications, auth) — корректная SEO-гигиена аутентифицированных поверхностей.

### Проверено эмпирически, а не по допущению

- **JSON-LD через `innerHTML` безопасен.** Предполагался stored XSS в `useSeoPage.ts:51` и `AppBreadcrumbs.vue:70`, но чтение исходников показало: `node_modules/unhead/dist/shared/unhead.CfKy3Kuq.mjs:83` экранирует `</script>`. **Находка снята.**
- `pg-connection-string/index.js:153-154` — подтверждено, что `no-verify` действительно отключает проверку сертификата (P0-1 не домысел).
- `npx prisma validate` — **проходит**. Схема валидна.
- `notifications.vue:143-149` — условная интерактивность реализована **правильно** (`:role`, `:tabindex`, `@keydown.enter`, `@keydown.space.prevent` + matching `:focus-visible`). Самый сложный ARIA-кейс в проекте сделан лучше всех.
- `useGroupForm.ts` — **архитектурный эталон**: состояние формы, дебаунс автосохранения с корректным `clearTimeout` и при перепланировании (`:70`), и при flush (`:126`), чеклист, `isReadyToPublish`, `flushSave`, `currentSlug` — всё инкапсулировано, потребитель (`groups/edit/[slug].vue:9`) остаётся одной строкой деструктуризации.
- `UiInput.vue` и `UiTextarea.vue` — **образцовые примитивы форм**: автогенерация id, связь `<label for>`, `aria-invalid`, `aria-describedby`, `role="alert"`, корректная последовательность `:focus` → `outline: none` → `:focus-visible` → видимое кольцо. **8 из 9** мест с `outline: none` в проекте следуют этому паттерну (исключение — P1-47).
- `UiDrawer.vue:73` **возвращает фокус** при закрытии; `UiModal.vue` реализует настоящий focus trap и Escape. Сложные части доступности диалогов присутствуют.
- `UiAccordion.vue` корректен по ARIA: `aria-expanded`, `aria-controls`, `role="region"`.
- `register.vue:52-84` и `profile/edit.vue:110-148` используют `isSubmitting` + `finally` **правильно**; `profile/edit.vue:346,409` задают `aria-label` иконочным кнопкам — тот паттерн, которого не хватает админ-таблицам.
- `groups/edit/[slug].vue` — **единственная страница, использующая `<fieldset>`/`<legend>`** (`:216,258,348,358`), и **единственная, где параметр маршрута реактивен** (`:7`).
- `favorites.vue`, `applications/my.vue` и `groups/my.vue:136-155` реализуют **идеальное пустое состояние** (текст + основной CTA) и **корректный паттерн `usePageLoading`** из AGENTS.md §10.

### Локализация

- **Паритет идеален.** `ua.json` = 518 ключей, `en.json` = 518, **diff = 0**. `seo.ua.json` = 56, `seo.en.json` = 56, **diff = 0**, обе подключены в `useLocale.ts:4-13`.
- Все динамические пространства ключей существуют: `groupTypes`, `groups.my.statuses`, `users.roles`, `profile.verification` (включая `REJECTED`), `applications.my.statuses`, `currencies`.
- Серверная локализация уведомлений реализована (`server/i18n/notifications/{ua,en}.ts`).

### Документация и домен

- `docs/` — **21 документ**, покрывающий все области из AGENTS.md: `accessibility`, `agent-workflow`, `api`, `architecture`, `authentication`, `authorization`, `components`, `css`, `database`, `domain`, `error-handling`, `forms`, `git`, `i18n`, `loading`, `project-structure`, `security`, `seo`, `testing`, `todo`, `validation`.
- `moderateGroup` (`groupService.ts:266-331`) реализует **настоящую машину состояний** группы — единственное место, где переходы проверяются корректно.
- Миграция `20260919125336_add_cascade_deletes` и тест `tests/integration/cascade-deletes.test.ts` показывают, что каскады **осознавались и тестировались** (проблема в P0-8 — побочный эффект, а не невнимательность).

---

## 6. Статистика

### Объём проанализированного

| Категория | Количество |
|---|---|
| Компоненты (`app/components/`) | **44** (15 UI-примитивов, 11 feature, 5 admin-таблиц, 5 admin-вкладок, 10 layout/sections/home, 3 forms) |
| Страницы (`app/pages/[locale]/`) | **24** `.vue` (+1 `.DS_Store`, не отслеживается) |
| Composables | **8** |
| Utils (`app/utils/`) | **3** |
| Layouts / middleware / app shell | 1 / 1 / `app.vue` + `router.options.ts` |
| Глобальные CSS | 2 (`variables.css` 229 строк, `fonts.css` 46 строк) |
| **LOC `app/`** | **17 221** |
| API-эндпоинты (`server/api/`) | **41** `.ts` (+1 `.DS_Store`) |
| Services / repositories / validators | 3 / 7 / 5 |
| Server utils / plugins / routes | 12 / 2 / 1 |
| Prisma-моделей / enum'ов | **14** / **11** |
| Миграций (`migration.sql`) | **30** файлов в 31 папке |
| Ключей локализации | 518 + 518 (`ua`/`en`) + 56 + 56 (`seo.ua`/`seo.en`) |
| Документов `docs/` | **21** |
| Файлов, проверенных ESLint | **180** (70 `.vue`, 109 `.ts`, 1 `.mjs`) |

### Результаты реальных прогонов (не оценки)

| Проверка | Результат |
|---|---|
| `npm run lint` (`eslint .`) | ✅ exit 0 — **0 ошибок, 0 предупреждений** |
| `npx nuxi typecheck` | ❌ **exit 2 — 5 ошибок** |
| `npx vue-tsc --noEmit` (команда из README) | ⚠️ exit 0, **нулевой вывод — ложно-зелёный** |
| `npx vitest run --reporter=verbose` | ✅ exit 0 — 13 файлов, **224 теста, 224 passed**, 3.45 s |
| `npx vitest run --coverage` | ✅ exit 0 — **33.93%** stmts / 35.11% branch / 32.20% funcs / 33.40% lines |
| `npm run build` | ✅ exit 0, ~7 s, preset **`node-server`** (не `vercel`), Σ **5.99 MB (1.52 MB gzip)** |
| `npx prisma validate` | ✅ проходит |

#### 5 ошибок typecheck дословно

```
app/components/forms/AvatarUploader.vue(145,10): error TS2322: Type '(el: HTMLInputElement | null) => void' is not assignable to type 'VNodeRef | undefined'.
app/pages/[locale]/groups/edit/[slug].vue(117,9): error TS2322: Type '"PATCH"' is not assignable to type '"get" | "GET" | undefined'.
app/pages/[locale]/groups/edit/[slug].vue(130,9): error TS2322: Type '"PATCH"' is not assignable to type '"get" | "GET" | undefined'.
app/pages/[locale]/groups/edit/[slug].vue(161,56): error TS2322: Type '"DELETE"' is not assignable to type '"get" | "GET" | undefined'.
app/pages/[locale]/groups/my.vue(100,61): error TS2322: Type '"DELETE"' is not assignable to type '"get" | "GET" | undefined'.
```

### Покрытие по директориям

| Директория | Stmts | Branch |
|---|---|---|
| `server/services` | 72.34% | 71.89% |
| `server/validators` | 71.42% | 100% |
| `shared/utils` | 84.48% | 95.45% |
| `shared/constants` | 70% | 100% |
| `server/utils` | 41.96% | — |
| `server/api/groups` | 38.59% | — |
| `server/api/auth` | 36.69% | — |
| `server/api` | 33.33% | — |
| `server/repositories` | 25.22% | **3.38%** |
| **`app/` (весь фронтенд)** | **не измеряется** (исключён в `coverage.include`) | — |

**51 из 77** инструментированных файлов — ровно **0%**. В их числе: весь `server/api/admin` (10 файлов), `server/api/{applications,favorites,notifications,organizers,user}`, `server/plugins`, `errorHandler.ts`, `notifications.ts` (34 stmts), `avatar.post.ts` (32), `organizers/me.patch.ts` (40), оба непроверенных валидатора, `favoriteRepository`, `notificationRepository`, `repositories/types.ts`, `sitemap.xml.ts` (исключён конфигом).

### Сборка

| Метрика | Значение |
|---|---|
| Клиентский JS | **517.41 kB / 52 файла** (крупнейший `_nuxt/CLCDh1Fj.js` 159.10 kB, затем 94.54 kB) |
| Клиентский CSS | **139.30 kB / 36 файлов** (крупнейший `_slug_.1g3vqZWX.css` 17.59 kB) |
| Серверный бандл | 13 MB |
| Sourcemap'ов в проде | **212**, все в `.output/server/`, клиентских 0 |
| Nitro preset | `node-server` |

### Счётчики качества кода

| Метрика | Значение |
|---|---|
| `as any` / `@ts-ignore` / `@ts-expect-error` в проде | **0** (6 `as any` — только в тестах) |
| `debugger` | **0** |
| `console.*` | 17 вызовов, все `error`/`warn`, кроме одного намеренно подавленного startup-лога |
| ESLint-disable | 18, все `next-line` с обоснованием |
| Мёртвых методов репозиториев (0 вызовов) | **8** |
| Мёртвых utils | **2** (`parsePagination`, `requireRole`) |
| Handlers с прямым импортом `prisma` | **14 из 40** |
| `createError`/`statusCode` внутри сервисов | **44** (23 в одном `groupService`) |
| Ключей разрешений, используемых только в тестах | **9 из 20** |
| Ключей разрешений, enforced сервером | **7 из 20** |
| Самодельных проверок ролей в обход `usePermissions` | **16 в 9 файлах** |
| Мёртвых CSS-правил | ~**30** |
| Дубликатов `formatLabel` | **4** (только один обрабатывает `MIXED`) |
| Дубликатов карты locale→`uk-UA`/`en-US` | **7** |
| Дубликатов `@keyframes spin` | **5** |
| Самодельных regex для email | **3** разных |
| Ручных повторений `UiButton` | **≥8** |
| `!important` | **1** |
| Unscoped `<style>` | **0** |
| SFC с нарушением порядка блоков | **0 из 68** |
| Отслеживаемого мусора в git | **3** позиции (`executed`, `app/generated/prisma/` ×8; `.DS_Store` корректно не отслеживается) |
| Стилей импортов (относительные / `~~/` / `~/` / `#app`) | 198 / 53 / 5 / 4; **57** глубиной 3+ уровня |
| Тестов / e2e-тестов | **224 / 0** |
| Плейсхолдеров/заглушек в проде | 2 `TODO: review with lawyer` + 1 русский TODO (`index.vue:85`) |

### Расхождение с брифом (проверено)

| В брифе | Фактически |
|---|---|
| 40 API-эндпоинтов | **41** |
| 23 страницы | **24** |
| 31 миграция | **30** `migration.sql` |

### Проблемы по приоритетам

| Приоритет | Количество |
|---|---|
| **P0** | **18** |
| **P1** | **57** |
| **P2** | **75** |
| **P3** | **42** |
| **ИТОГО** | **192** |

Распределение по областям: безопасность **31**, база данных/миграции **28**, фронтенд/компоненты **62**, доступность **24**, SEO/i18n **19**, конфигурация/сборка/тесты **21**, архитектура/мёртвый код **7**.

---

## 7. Рекомендации по рефакторингу

Упорядочено по соотношению «устранённый риск / объём работы». **Ничего из этого не выполнено** — только рекомендации.

**1. Свести три источника правды о Prisma-клиенте к одному.** Сейчас их три: `database/schema.prisma` (актуальная), `database/seed.schema.prisma` (устаревшая на 14 полей, 3 enum'а и 1 модель) и `app/generated/prisma/` (8 отслеживаемых файлов с нулём моделей и другой конфигурацией генератора). Все три генерируют в разные или пересекающиеся места, и ни одна не вызывается при установке. Это порождает P0-2, P0-3 и P2-24 одновременно.
*Почему:* один генератор + один `output` + `prisma generate` в `postinstall` устраняет целый класс сбоев деплоя, а не один баг.

**2. Вынести HTTP из сервисов.** 44 вхождения `createError`/`statusCode` в доменном слое делают сервисы непригодными для переиспользования вне HTTP и заставляют дублировать правила в handlers.
*Почему:* пока сервисы бросают HTTP-коды, невозможно написать ни один интеграционный тест без HTTP-контекста — что и объясняет 0% покрытия `server/api/admin`.

**3. Заменить «whitelist по случайности» на явный `select`.** `groups/[slug].get.ts:42-56` публикует всё, что включил репозиторий.
*Почему:* это единственный паттерн, при котором добавление чувствительного поля в репозиторий **молча** делает его публичным. `rejectionReason` и `organizer.userId` уже утекают.

**4. Унифицировать клиентскую авторизацию.** `usePermissions` с 20 ключами существует, но используется в одном месте, а 16 самодельных проверок в 9 файлах противоречат друг другу.
*Почему:* админ-соорганизатор не видит заявки своей группы — это уже случившийся баг, а не гипотетический. Плюс 9 ключей разрешений покрыты тестами, но никогда не вызываются, что создаёт ложную уверенность.

**5. Обобщить `UiButton` (`to`/`href` + `loading`) и удалить ≥8 ручных копий.**
*Почему:* это крупнейший источник дублирования стилей в проекте, и именно отсутствие `loading` порождает P2-37 (двойные отправки модерации).

**6. Вынести общие DTO из 5 локальных копий интерфейсов.**
*Почему:* 18 приведений `as string` в `profile/index.vue:66` существуют исключительно потому, что ответ типизирован как `Record<string, unknown>`. Типизация устраняет и приведения, и молчаливый `undefined` при добавлении поля сервером.

**7. Разделить «пусто» и «сломано».** 7 молчаливых `catch {}` + 2 страницы, не деструктурирующие `error`.
*Почему:* для организатора сбой бэкенда выглядит как удаление его опубликованных групп. Это самый дорогой для доверия дефект в UI.

**8. Сделать реактивными `useLocaleHead` и `useSeoPage`.** Оба резолвят значения однократно.
*Почему:* вся SEO-надстройка проекта (hreflang, canonical, OG, JSON-LD) заморожена на первом посещённом маршруте — то есть при SPA-навигации работает неправильно по построению.

**9. Объединить `catalog/index.vue` и `catalog/[type].vue` (~270 общих строк), `AdminUsersTab` и `AdminOrganizersTab` (~95%), `UiAutocomplete` и `Combobox`, CSS `login`/`register` (~150 строк).**
*Почему:* `catalog/[type].vue:195` уже передаёт prop, которого не существует, — прямое следствие копирования.

**10. Ввести e2e-слой.**
*Почему:* P0-6 (вкладка админа не грузится), P0-13 (нереактивный slug), P0-14 (модалка до загрузки вопросов), P0-15 (недоступные radio), P0-17 (`common.noResults` на публичной странице) — **каждый** обнаруживается одним прогоном браузера. 224 unit-теста их не видят по построению, а `app/` вообще исключён из покрытия.

**11. Заменить `Record<string, PermissionCheck>` на `as const satisfies` и типизировать `can()`.**
*Почему:* сейчас опечатка в ключе разрешений компилируется и молча возвращает `false`.

**12. Включить архитектурные запреты в ESLint.** Ни одно правило AGENTS.md не обеспечено инструментом: нет `no-restricted-imports` для запрещённых зависимостей, нет запрета Prisma в `app/`, нет запрета raw `fetch`, нет требования `<style scoped>`, нет stylelint для BEM, а `database/` вообще в `ignores`.
*Почему:* 14 handlers с прямым Prisma — следствие того, что правило существует только в документе.

---

## 8. Top 10 приоритетов перед продакшеном

1. **Убрать `sslmode=no-verify`** (`server/utils/prisma.ts:8`, `database/seed.ts:15`, `tests/integration/cascade-deletes.test.ts:5`). Проверка TLS-сертификата БД отключена для трафика с данными о психотерапии. Три строки.
2. **Добавить `prisma generate` в `postinstall` и удалить `seed.schema.prisma`** (`package.json:8`, `prisma.config.ts`). Без этого деплой на Vercel либо падает, либо поднимается с битым/устаревшим клиентом.
3. **Защитить `database/seed.ts` от прода** (`:64-74`, `:29-37`, `:51-58`). Одна случайно запущенная команда уничтожает данные и реальных auth-пользователей Supabase безвозвратно.
4. **Добавить `api.iconify.design` в CSP либо бандлить иконки локально** (`server/plugins/csp.ts`, `UiIcon.vue`). Все иконки исчезнут **только после деплоя** — локально CSP выключен, дефект невоспроизводим в dev.
5. **`{ immediate: true }` в watcher админ-панели** (`admin/index.vue:34`). Одна строка; сейчас очередь модерации организаторов молча выглядит пустой.
6. **Закрыть утечки PII и перечисления**: `email` в поиске организаторов, полная строка `User` + отсутствие проверки `isActive` в `google.post.ts`, `statusMessage`-оракул в `groupService.ts:223`, `rejectionReason`/`organizer.userId` через whitelist-по-случайности в `groups/[slug].get.ts:42-56`.
7. **Починить ядро подачи заявки**: обязательные вопросы обходятся `answers: []` (`applicationService.ts:29-66`), модалка открывается до загрузки вопросов и кэширует провал как успех (`groups/[slug].vue:50-60`), правка вопросов удаляет ответы всех заявителей (`groupService.ts:184`), нереактивный `slug` позволяет отправить заявку не в ту группу (`groups/[slug].vue:9`).
8. **Исправить блокирующие дефекты доступности**: `--line-height-normal: 1` (`variables.css:102`), недоступные radio формата (`groups/edit/[slug].vue:272-283`), отсутствие индикатора фокуса у поиска в каталоге (`GroupFilters.vue:331-340`), нераскрываемая с клавиатуры строка заявки (`groups/applications/[slug].vue:145-152`), контраст палитры 2.48–3.96:1 (`variables.css:5,6,11,17,18`). Продукт, ориентированный на психотерапию, не может быть недоступен.
9. **Починить SEO-инфраструктуру**: `hreflang="ua"` вместо `uk` в 6 местах, `robots.txt:2-3` блокирует опубликованные слагы, sitemap перечисляет 404-URL, `useLocaleHead`/`useSeoPage` нереактивны, пустые `canonical`/`og:image`, 2 отсутствующих ключа локализации на публичной странице. Для каталога SEO — это и есть продукт.
10. **Разблокировать удаление данных (GDPR Art. 17)**: `Group.organizerId` и `Report.reporterId` без `onDelete` → RESTRICT делают `userRepository.delete` структурно невозможным для любого организатора с группой и любого пользователя с жалобой. Требует проектного решения (анонимизация vs `SetNull`) и миграции — нельзя отложить «на потом».

**Отдельно, до деплоя:** юридическая вычитка `terms.vue` и `privacy.vue` (авторы сами оставили `TODO: review with lawyer before production`) и удаление `ADMIN_PASSWORD=admin123456` из `.env.example` и README.

---

## 9. Что НЕ проверено

### Требует доступа к сети / реальной БД

| Что | Причина |
|---|---|
| Реальный выбор Vercel-пресета | Локальная сборка сообщает `node-server`. Nuxt определяет Vercel по переменной `VERCEL=1`, которую я не симулировал — намеренно, чтобы не изменять окружение |
| `prisma migrate status` и состояние `_prisma_migrations` | Требует сетевого доступа к БД |
| Распознаётся ли папка `20260826210841-add-rejection-reason` (единственная с дефисом) Rust-резолвером Prisma | Статически не определяется; P1-40 основан на несоответствии конвенции, а не на наблюдении |
| Фактическое состояние RLS по таблицам (`pg_class.relrowsecurity`) | Требует подключения к БД |
| Дрейф схема↔БД (`prisma migrate diff`) | Требует подключения к БД. P1-38 (nullability) выведен из чтения миграций, а не из дампа реальной схемы |
| Планы запросов (`EXPLAIN ANALYZE`) | Все выводы об отсутствии индексов (P2-12, P2-19) сделаны по схеме, не по планам |
| Реальная ёмкость пула `pg` под нагрузкой Vercel | `new PrismaPg({ connectionString })` без опций пула (default max 10); поведение при serverless-масштабировании не измерялось |

### Требует браузера / запущенного сервера

| Что | Причина |
|---|---|
| Отрендеренный HTML `<head>` (hreflang, canonical, OG, JSON-LD) | Нужен запущенный сервер + `curl` |
| Устаревание hreflang при клиентской навигации | P1-23 выведено из чтения кода (`useLocaleHead` возвращает plain object); в браузере не наблюдалось |
| Мобильная адаптивность на 375 / 768 / 1024 / 1440 px | Все находки P2-50, P2-51, P3-13, P3-14 — рассуждения по CSS, не измерения |
| Коэффициенты контраста | **Вычислены вручную** по формуле относительной яркости WCAG из hex-значений `variables.css` (все шесть перепроверены дважды). Это **не** измерения axe/Lighthouse |
| Реальный CLS, порядок фокуса, поведение `showPicker()` | `groups/edit/[slug].vue:44` вызывает `showPicker()` после `await nextTick()`, что может разорвать цепочку user-activation и бросить `SecurityError` — рассуждение по коду |
| Размер touch-target ≥44×44 px | Требует вычисленных стилей |
| Состояние Search Console / индексация | Нет доступа |
| Валидность JSON-LD на validator.schema.org | Структура прочитана, валидатор не вызывался |

### Требует внешних систем / людей

| Что | Причина |
|---|---|
| Задан ли `SITE_URL` в дашборде Vercel | Нет доступа к дашборду. P1-7 описывает отсутствие валидации, а не факт неверного значения |
| Работоспособность Resend / корректность `RESEND_API_KEY` | Локальный ключ — 8-символьный placeholder; отправка не тестировалась |
| Настроен ли Sentry / мониторинг / uptime | В проекте их нет (подтверждено). Внешние сервисы не проверялись |
| Качество перевода носителем языка | Паритет ключей проверен программно (518/518, 56/56), **качество текста — нет** |
| Юридическая корректность `terms.vue` / `privacy.vue` | Требует юриста |
| Являются ли найденные проблемы уже известными | `docs/todo.md` существует, но в рамках этого аудита не читался |
| Поведение OAuth `state`/CSRF | `auth/callback.vue:11-24` читает только `route.query.code`; проверяет ли `google.post.ts` параметр `state` — отдельно не верифицировалось |
| Сохраняется ли аватар при сохранении профиля | `profile/edit.vue:113-131` **не включает `avatarUrl`** в PATCH-payload. Корректно это или аватар теряется, зависит от того, сохраняет ли `avatar.post.ts` URL в БД — связка не проверялась сквозным прогоном |
| Должен ли «вернуть на доработку» быть отдельным статусом | `AdminGroupsTab.vue:139-148` — две идентичные функции, обе шлют `status: 'REJECTED'`. Это доменный вопрос к `docs/domain.md` |
| Документация API (OpenAPI/справочник эндпоинтов) | `docs/api.md` существует, но наличие в нём описания всех 41 эндпоинта не сверялось построчно |

---

## 10. Чеклист полноты

| # | Область | Статус | Комментарий |
|---|---|---|---|
| 1 | Все 41 API-эндпоинт | ✅ | Все прочитаны; 14 с прямым Prisma, 1 с `sanitizeError` |
| 2 | Все 24 страницы | ✅ | Все прочитаны целиком (в брифе указано 23) |
| 3 | Все 8 composables | ✅ | `useLocale`, `useLocaleHead`, `usePageLoading`, `usePermissions`, `useSeoPage`, `useBreadcrumbs`, `useUser`, `useGroupForm` |
| 4 | Все 44 компонента | ✅ | Ни одного неиспользуемого |
| 5 | Все 7 repositories | ✅ | Покрытие 25.22% stmts / **3.38%** branch; 8 мёртвых методов |
| 6 | Все 5 validators | ✅ | 2 из них — 0% покрытия |
| 7 | Все 14 Prisma-моделей | ✅ | 0 CHECK-ограничений во всей схеме |
| 8 | Все 11 enum'ов | ✅ | 2 мёртвых значения (`GROUP_STARTING`, `CANCELLED`); `FULL` и `WITHDRAWN` недостижимы |
| 9 | Все 30 миграций | ✅ | Все `migration.sql` прочитаны (в брифе указано 31) |
| 10 | Все ключи локализации | ✅ | Программная сверка: 518/518 + 56/56, diff 0; найдено 2 отсутствующих `common.*` |
| 11 | Security headers | ✅ | HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy присутствуют; `X-XSS-Protection` устарел (P2-28) |
| 12 | CSP policy | ✅ | Прочитана построчно; P0-5 + мёртвые origin'ы |
| 13 | Rate limiting | ✅ | 4 из 41 эндпоинта, memory-only, XFF spoofable |
| 14 | Поток auth/authz | ✅ | Supabase SSR, `getUser`/`requireAuth`/`requireRole`, карта из 20 разрешений; 9 ключей test-only, 7 enforced |
| 15 | SEO | ✅ | meta, hreflang, JSON-LD, sitemap, robots, canonical, OG — всё прочитано; rendered HTML не проверялся (§9) |
| 16 | Accessibility | ⚠️ **частично** | Код прочитан полностью, контраст вычислен вручную. **Без браузера**: реальные размеры touch-target, порядок фокуса, CLS, axe/Lighthouse |
| 17 | Мобильная адаптивность | ⚠️ **частично** | Все CSS и медиа-запросы прочитаны (19 из 68 SFC). **Без браузера** на 375/768/1024/1440 px |
| 18 | Производительность | ⚠️ **частично** | Реальная сборка прогнана (517.41 kB JS / 139.30 kB CSS / 5.99 MB Σ). **`nuxt analyze` не запускался**; планов запросов нет |
| 19 | Обработка ошибок | ✅ | `errorHandler.ts`, отсутствие `server/middleware/`, `nitro.errorHandler` и `app/error.vue` подтверждены |
| 20 | Документация | ✅ | 21 файл в `docs/`, README, AGENTS.md, AUDIT-REPORT.md. `HANDOFF.md` **не существует** |
| 21 | Сборка и деплой | ⚠️ **частично** | `npm run build` прогнан успешно (exit 0). **Реальный Vercel-деплой не выполнялся**, пресет `vercel` не подтверждён |

**Итог по чеклисту: 17 из 21 полностью, 4 частично** (a11y, мобильная адаптивность, производительность, деплой) — во всех четырёх случаях причина одна и та же: **отсутствие браузера и реального Vercel-окружения**, а не пропуск области анализа.

---

# SUMMARY

## Найдено проблем: **192**

| Приоритет | Количество |
|---|---|
| 🔴 **P0 — критические** | **18** |
| 🟠 **P1 — серьёзные** | **57** |
| 🟡 **P2 — средние** | **75** |
| ⚪ **P3 — мелкие** | **42** |

## Готов ли проект к продакшену?

# ❌ НЕТ

Не из-за количества находок, а из-за характера пяти из них:

1. **Он не задеплоится корректно.** `prisma generate` отсутствует в `postinstall` (P0-2), а команда сида генерирует клиент из **устаревшей на 14 полей схемы** в тот же каталог (P0-3). Локально это не проявляется.
2. **Он сломается визуально только в проде.** CSP применяется исключительно при `NODE_ENV === 'production'` и не содержит origin, с которого тянутся все иконки (P0-5). В dev дефект невоспроизводим.
3. **Он теряет и портит данные основного сценария.** Обязательные вопросы обходятся пустым массивом (P0-7), модалка кэширует провал загрузки как успех (P0-14), правка вопросов каскадно удаляет ответы всех заявителей (P0-8), нереактивный `slug` позволяет подать заявку не в ту группу (P0-13).
4. **Он не может выполнить требование закона.** `Group.organizerId` и `Report.reporterId` без `onDelete` делают удаление пользователя структурно невозможным (P0-9). Для продукта, обрабатывающего данные о психотерапии, это блокер GDPR, а не техдолг.
5. **Одна команда может уничтожить прод.** `database/seed.ts` делает `deleteMany()` по 9 моделям и удаляет реальных auth-пользователей Supabase **без `NODE_ENV`-guard** (P0-4).

Плюс два дефекта, ломающих доверие к продукту на старте: админ-панель **навсегда** показывает пустую очередь модерации (P0-6), а на публичной странице каталога буквально выводится `common.noResults` (P0-17).

**Что важно:** фундамент при этом крепкий. Ноль запрещённых зависимостей, ноль `as any` в проде, ноль unscoped-стилей, ноль сырых SQL, идеальный паритет локалей (518/518 и 56/56), 0 ошибок линтера, 224 passing теста, успешная сборка, все секреты в приватном `runtimeConfig`, образцовая доступность auth-форм. **Проблема не в качестве кода, а в отсутствии проверок, которые ловят интеграционные дефекты**: 0 e2e-тестов, `app/` исключён из покрытия, `vue-tsc --noEmit` ложно-зелёный. Именно поэтому 18 P0 дожили до финального аудита.

## Top 5 критичных фиксов

| # | Фикс | Файлы | Объём |
|---|---|---|---|
| **1** | Удалить `.replace('sslmode=require', 'sslmode=no-verify')` | `server/utils/prisma.ts:8`, `database/seed.ts:15`, `tests/integration/cascade-deletes.test.ts:5` | **3 строки** — возвращает проверку TLS-сертификата БД для всего трафика с чувствительными данными |
| **2** | `"postinstall": "prisma generate && nuxt prepare"` + удалить `seed.schema.prisma` и `prisma generate` из seed-команды + выровнять версии `prisma`/`@prisma/client` | `package.json:8,29-30`, `prisma.config.ts`, `database/seed.schema.prisma` | **~4 строки** — делает деплой на Vercel вообще возможным и устраняет перезапись живого клиента устаревшим |
| **3** | `if (process.env.NODE_ENV === 'production') throw` + allowlist хостов + подтверждение в seed | `database/seed.ts:64-74,29-37,51-58` | **~6 строк** — убирает единственный сценарий безвозвратной потери продакшн-данных |
| **4** | `{ immediate: true }` в watcher вкладок + добавить `common.close`/`common.noResults` в обе локали + `api.iconify.design` в CSP (или локальный бандл иконок) | `admin/index.vue:34`, `app/locales/{ua,en}.json`, `server/plugins/csp.ts` | **~5 строк** — разблокирует очередь модерации, убирает сырые ключи с публичной страницы, возвращает иконки в проде |
| **5** | `const slug = computed(() => route.params.slug)` + загружать вопросы **до** открытия модалки и не ставить `questionsLoaded = true` в ветке провала + итерировать валидацию по вопросам группы, а не по присланным ответам | `groups/[slug].vue:9,50-60` (+ `organizers/[slug].vue:6`, `groups/applications/[slug].vue:10`, `catalog/[type].vue`), `applicationService.ts:29-66` | **~25 строк** — закрывает все четыре дефекта потери/порчи данных на основном конверсионном сценарии |

**После этих пяти** проект переходит из состояния «не задеплоится / потеряет данные» в состояние «деплоится, но требует P1-волны»: ошибки типов (5), rate limiting, утечка email, `hreflang="uk"`, `robots.txt`, контраст палитры и `line-height: 1`, юридическая вычитка и первый e2e-набор.
