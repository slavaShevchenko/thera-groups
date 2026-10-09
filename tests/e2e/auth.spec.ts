import { loginAsOrganizer } from './helpers/auth'
import { credentials, hasCredentials, missingCredentials } from './helpers/env'
import { expect, test } from './helpers/fixtures'
import { t } from './helpers/text'

// Every route below is listed in app/middleware/auth.global.ts. The guard resolves the
// session during SSR, so an anonymous visitor is redirected by the server rather than
// after hydration — which is what makes a hard load, a bookmark or a link from an email
// behave the same as an in-app navigation.
const PROTECTED_PATHS = [
  '/ua/admin',
  '/ua/applications/my',
  '/ua/favorites',
  '/ua/groups/applications/any-slug',
  '/ua/groups/edit/any-slug',
  '/ua/groups/my',
  '/ua/groups/new',
  '/ua/notifications',
  '/ua/profile',
  '/ua/profile/edit',
]

test.describe('login page', () => {
  test('renders the form with email and password fields', async ({ page }) => {
    await page.goto('/ua/auth/login')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('common.login'))
    await expect(page.locator('#login-email')).toBeVisible()
    await expect(page.locator('#login-password')).toBeVisible()
    await expect(page.getByRole('button', { name: t('common.login'), exact: true })).toBeEnabled()
  })

  test('is excluded from indexing', async ({ page }) => {
    await page.goto('/ua/auth/login')

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
  })

  test('shows inline errors without calling the API', async ({ page }) => {
    const requests: string[] = []
    page.on('request', request => requests.push(request.url()))

    await page.goto('/ua/auth/login')
    await page.locator('#login-email').fill('not-an-email')
    await page.locator('#login-password').fill('short')
    await page.getByRole('button', { name: t('common.login'), exact: true }).click()

    await expect(page.locator('#login-email-error')).toHaveText(t('auth.errors.emailInvalid'))
    await expect(page.locator('#login-password-error')).toHaveText(t('auth.errors.passwordMin'))
    expect(requests.filter(url => url.includes('/api/auth/login'))).toEqual([])
  })

  test('reports invalid credentials returned by the API', async ({ page }) => {
    await page.goto('/ua/auth/login')
    await page.locator('#login-email').fill('e2e-absent@example.com')
    await page.locator('#login-password').fill('e2e-not-a-real-password')

    await page.getByRole('button', { name: t('common.login'), exact: true }).click()

    await expect(page.locator('.auth-card__error')).toHaveText(t('auth.errors.credentialsInvalid'))
    await expect(page).toHaveURL(/\/ua\/auth\/login$/)
  })

  test('links to the registration page', async ({ page }) => {
    await page.goto('/ua/auth/login')

    await page.getByRole('link', { name: t('common.register') }).click()

    await expect(page).toHaveURL(/\/ua\/auth\/register$/)
  })
})

test.describe('route guards', () => {
  for (const path of PROTECTED_PATHS) {
    test(`sends an anonymous visitor from ${path} to the login page with returnTo`, async ({ page }) => {
      await page.goto(path)

      await expect(page).toHaveURL(/\/ua\/auth\/login\?returnTo=/)
      // Read through URLSearchParams so the assertion does not depend on whether the
      // redirect percent-encoded the slashes.
      expect(new URL(page.url()).searchParams.get('returnTo')).toBe(path)
    })
  }

  test('guards a private route requested without a locale prefix', async ({ page }) => {
    await page.goto('/groups/my')

    await expect(page).toHaveURL(/\/auth\/login\?returnTo=/)
  })

  test('leaves a public route alone', async ({ page }) => {
    await page.goto('/ua/catalog')

    await expect(page).toHaveURL(/\/ua\/catalog$/)
  })
})

test.describe('signed-in session', () => {
  test.skip(
    !hasCredentials,
    `set ${missingCredentials.join(', ')} to run the authenticated auth specs`,
  )

  test('keeps the session across a hard reload of a private page', async ({ page }) => {
    await loginAsOrganizer(page)

    await page.goto('/ua/groups/my')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('common.myGroups'))

    // The regression this pins: SSR used to see no session, so the reload bounced a
    // signed-in organizer back to the login page.
    await page.reload()

    await expect(page).toHaveURL(/\/ua\/groups\/my$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('common.myGroups'))
  })

  test('returns to the guarded route after signing in', async ({ page }) => {
    await page.goto('/ua/groups/my')
    await expect(page).toHaveURL(/\/ua\/auth\/login\?returnTo=/)

    await page.locator('#login-email').fill(credentials.email)
    await page.locator('#login-password').fill(credentials.password)
    await page.getByRole('button', { name: t('common.login'), exact: true }).click()

    await expect(page).toHaveURL(/\/ua\/groups\/my$/)
  })

  test('refuses a returnTo that points off-site', async ({ page }) => {
    await page.goto('/ua/auth/login?returnTo=%2F%2Fevil.example%2Fua')

    await page.locator('#login-email').fill(credentials.email)
    await page.locator('#login-password').fill(credentials.password)
    await page.getByRole('button', { name: t('common.login'), exact: true }).click()

    await expect(page).toHaveURL(/\/ua\/?$/)
  })

  // These pages load their data in onMounted, so the failure is only observable in a
  // browser. Both used to swallow the error and render an empty shell, which reads as
  // "no data" rather than "not here". A slug that cannot exist keeps the specs
  // independent of the database; signing in first is what lets the request reach the
  // fetch that produces the 404 instead of bouncing off the route guard.
  for (const area of ['edit', 'applications']) {
    test(`renders the 404 page instead of an empty groups/${area} shell`, async ({ page }) => {
      await loginAsOrganizer(page)

      await page.goto(`/ua/groups/${area}/e2e-not-a-real-group`)

      await expect(page.locator('.error-page__code')).toHaveText('404')
      await expect(page.locator('.error-page__message')).toHaveText(t('errors.notFound'))
    })
  }
})
