import { expect, test } from './helpers/fixtures'
import { t } from './helpers/text'

// Every page below redirects to the locale root while useUser() reports no session.
// /ua/admin is deliberately absent: its guard waits for a resolved user, so an
// anonymous visitor is never redirected (the server APIs still enforce admin.panel).
const PROTECTED_PATHS = [
  '/ua/groups/new',
  '/ua/groups/my',
  '/ua/groups/edit/any-slug',
  '/ua/groups/applications/any-slug',
  '/ua/applications/my',
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
    test(`redirects an anonymous visitor away from ${path}`, async ({ page }) => {
      await page.goto(path)

      await expect(page).toHaveURL(/\/ua\/?$/)
    })
  }
})
