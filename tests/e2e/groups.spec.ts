import { loginAsOrganizer } from './helpers/auth'
import { groupSlug, hasCredentials, missingCredentials } from './helpers/env'
import { expect, test } from './helpers/fixtures'
import { stubGroupWrites, type WriteStub } from './helpers/network'
import { t } from './helpers/text'

// useGroupForm autosaves 1500ms after a change, so specs that assert "nothing was
// written" have to outlast the debounce before checking the recorded calls.
const AUTOSAVE_DEBOUNCE_MS = 1500
const MISSING = [
  ...(hasCredentials ? [] : missingCredentials),
  ...(groupSlug ? [] : ['E2E_GROUP_SLUG']),
]

test.describe('group editor', () => {
  test.skip(
    MISSING.length > 0,
    `set ${MISSING.join(', ')} to run the authenticated group-editor specs`,
  )

  let writes: WriteStub

  test.beforeEach(async ({ page }) => {
    await loginAsOrganizer(page)
    // The shared development database must not receive autosaves from a test run.
    writes = await stubGroupWrites(page, groupSlug)
  })

  test('shows the create-group entry point', async ({ page }) => {
    await page.goto('/ua/groups/new')

    // Unverified organizers get the verification prompt instead of the create form.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      new RegExp(`${t('groups.new.title')}|${t('groups.new.verificationRequired')}`),
    )
  })

  test('rejects a minimum above the maximum without saving', async ({ page }) => {
    await page.goto(`/ua/groups/edit/${groupSlug}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('groups.edit.title'))

    const min = page.getByLabel(t('groups.minParticipants'))
    const max = page.getByLabel(t('groups.edit.maxParticipants'))

    await max.fill('5')
    await min.fill('10')

    await expect(page.getByText(t('groups.edit.errors.minGreaterThanMax'))).toBeVisible()
    await expect(min).toHaveAttribute('aria-invalid', 'true')

    // The range is invalid from here on, so the debounce must not reach the server.
    writes.calls.length = 0
    await page.waitForTimeout(AUTOSAVE_DEBOUNCE_MS + 500)
    expect(writes.calls).toEqual([])
  })

  test('rejects an end date before the start date without saving', async ({ page }) => {
    await page.goto(`/ua/groups/edit/${groupSlug}`)

    const start = page.getByLabel(t('common.startDate'))
    const end = page.getByLabel(t('common.endDate'))

    // The end field stays disabled until a start date exists, so a group without one
    // needs the start filled first.
    if (await end.isDisabled()) {
      await start.fill('2026-12-01T10:00')
    }

    await end.fill('2026-01-01T10:00')
    await start.fill('2026-12-01T10:00')

    await expect(page.getByText(t('groups.edit.errors.endDateNotAfterStart'))).toBeVisible()
    await expect(end).toHaveAttribute('aria-invalid', 'true')

    writes.calls.length = 0
    await page.waitForTimeout(AUTOSAVE_DEBOUNCE_MS + 500)
    expect(writes.calls).toEqual([])
  })

  test('keeps the co-organizer search working after two are added', async ({ page }) => {
    const query = process.env.E2E_COORGANIZER_QUERY ?? 'а'
    const searchRequests: string[] = []

    page.on('request', (request) => {
      if (request.url().includes('/api/organizers/search')) searchRequests.push(request.url())
    })

    await page.goto(`/ua/groups/edit/${groupSlug}`)

    // The section only renders for the group owner (isCoOrganizer === false).
    const picker = page.locator('.co-organizers-picker')
    await expect(picker).toBeVisible()

    const search = picker.getByPlaceholder(t('groups.edit.searchOrganizers'))
    const options = picker.locator('.ui-autocomplete__item')
    const added = picker.locator('.co-organizers-picker__item')
    const alreadyAdded = await added.count()

    await search.fill(query)
    await expect(options.first()).toBeVisible()
    test.skip(await options.count() < 2, `query "${query}" matched fewer than two organizers`)

    await options.first().click()
    await expect(added).toHaveCount(alreadyAdded + 1)

    await search.fill(query)
    await expect(options.first()).toBeVisible()
    await options.first().click()
    await expect(added).toHaveCount(alreadyAdded + 2)

    // This is the regression under test: the dropdown used to stop opening once two
    // co-organizers were present.
    searchRequests.length = 0
    await search.fill(query)

    await expect(picker.locator('[role="listbox"]')).toBeVisible()
    await expect.poll(() => searchRequests.length).toBeGreaterThan(0)

    // Already-added co-organizers, the owner and the current user are excluded.
    const exclude = new URL(searchRequests[0] ?? '').searchParams.get('exclude') ?? ''
    expect(exclude.split(',').filter(Boolean).length).toBeGreaterThanOrEqual(2)

    // Adding co-organizers is a valid change, so autosave does fire — the stub absorbs it.
    await page.waitForTimeout(AUTOSAVE_DEBOUNCE_MS + 500)
    expect(writes.calls.some(call => call.startsWith('PATCH'))).toBe(true)
  })

  test('adds and removes a language the group runs in', async ({ page }) => {
    await page.goto(`/ua/groups/edit/${groupSlug}`)

    const picker = page.locator('.language-picker')
    await expect(picker).toBeVisible()

    // A missing locale key renders the raw key path, so asserting the resolved copy is what
    // proves `groups.edit.languages*` reached both JSON files.
    await expect(page.getByText(t('groups.edit.languagesHint'))).toBeVisible()

    const search = picker.getByRole('combobox')
    await expect(search).toHaveAttribute('placeholder', t('groups.edit.languagesPlaceholder'))
    // The visible label is a <span> in the page's own form styles, so the input's accessible
    // name comes through this rather than a <label for>.
    await expect(search).toHaveAttribute('aria-labelledby', 'group-languages-label')

    const pills = picker.locator('.language-picker__pill')
    const before = await pills.count()

    await search.fill('укр')
    const option = picker.locator('[role="option"]', { hasText: 'Українська' }).first()
    await expect(option).toBeVisible()
    await option.click()

    await expect(pills).toHaveCount(before + 1)
    await expect(pills.last()).toContainText('Українська')
    await expect(search).toHaveValue('')

    // Selecting the same language again is a no-op, not a duplicate pill.
    await search.fill('укр')
    await expect(option).toBeVisible()
    await option.click()
    await expect(pills).toHaveCount(before + 1)

    // A language change is a valid edit, so autosave fires — the stub absorbs it.
    writes.calls.length = 0
    await page.waitForTimeout(AUTOSAVE_DEBOUNCE_MS + 500)
    expect(writes.calls.some(call => call.startsWith('PATCH'))).toBe(true)

    await pills.last().getByRole('button').click()
    await expect(pills).toHaveCount(before)
  })
})
