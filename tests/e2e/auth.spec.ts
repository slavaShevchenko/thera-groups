import type { Page } from '@playwright/test'
import { loginAsOrganizer } from './helpers/auth'
import { credentials, hasCredentials, missingCredentials } from './helpers/env'
import { expect, test } from './helpers/fixtures'
import { stubGoogleAuthFailure } from './helpers/network'
import { t } from './helpers/text'
import { AUTH_SESSION_DISABLED } from '../../shared/constants/auth'
import { PROFILE_LIMITS } from '../../shared/constants/limits'

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

  /**
   * `validate()` refuses to submit without either field, so both carry the marker the
   * register form uses — `aria-hidden` because `aria-required` is what assistive tech reads,
   * and the glyph exists for sighted readers only.
   */
  test('marks both of its required fields with an asterisk', async ({ page }) => {
    await page.goto('/ua/auth/login')

    await expect(page.locator('.auth-form__required')).toHaveCount(2)
    await expect(page.locator('#login-email')).toHaveAttribute('aria-required', 'true')
    await expect(page.locator('#login-password')).toHaveAttribute('aria-required', 'true')
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

    // Scoped to the page, not the header: an anonymous visitor also gets a permanent
    // Register button in the desktop header, so the name alone resolves twice.
    await page.locator('#main-content').getByRole('link', { name: t('common.register') }).click()

    await expect(page).toHaveURL(/\/ua\/auth\/register$/)
  })

  // Both the route guard and the notification poll land a revoked session here with the
  // reason attached. Without it the visitor is signed out in silence and retries their
  // password straight into a 403.
  test('explains a session that ended because the account was deactivated', async ({ page }) => {
    await page.goto(`/ua/auth/login?reason=${AUTH_SESSION_DISABLED}`)

    await expect(page.getByRole('alert')).toHaveText(t('auth.errors.accountDisabled'))
  })

  test('ignores a reason it does not recognise', async ({ page }) => {
    await page.goto('/ua/auth/login?reason=SOMETHING_ELSE')

    await expect(page.locator('.auth-card__error')).toHaveCount(0)
  })
})

test.describe('register page', () => {
  const ORGANIZER_FIELDS = [
    { id: 'register-firstName', label: 'common.firstName' },
    { id: 'register-lastName', label: 'common.lastName' },
    { id: 'register-qualification', label: 'common.qualification' },
    { id: 'register-professionalOrganization', label: 'common.professionalOrganization' },
    { id: 'register-professionalOrganizationStatus', label: 'common.professionalOrganizationStatus' },
  ]

  async function chooseOrganizer(page: Page) {
    await page.getByRole('radio', { name: t('auth.register.role.organizer') }).click()
  }

  /**
   * The defect this pins: registration used to collect only a name, an optional
   * qualification and a bio, so every PENDING profile reached the moderation queue missing
   * the fields `moderateProfile` checks — an entry no admin could approve, while the
   * organizer had been told the profile was "under review".
   */
  test('asks an organizer for every field verification needs, before any API call', async ({ page }) => {
    const requests: string[] = []
    page.on('request', request => requests.push(request.url()))

    await page.goto('/ua/auth/register')
    await chooseOrganizer(page)

    for (const field of ORGANIZER_FIELDS) {
      await expect(page.locator(`#${field.id}`)).toBeVisible()
      await expect(page.locator(`label[for="${field.id}"]`)).toContainText(t(field.label))
    }

    await page.locator('#register-email').fill('e2e-absent@example.com')
    await page.locator('#register-password').fill('a-long-enough-password')
    await page.locator('#register-password-confirm').fill('a-long-enough-password')
    await page.getByRole('button', { name: t('common.register'), exact: true }).click()

    for (const field of ORGANIZER_FIELDS) {
      await expect(page.locator(`#${field.id}-error`)).toHaveText(t('common.required'))
    }

    expect(requests.filter(url => url.includes('/api/auth/register'))).toEqual([])
  })

  test('rejects a one-character answer the server would reject too', async ({ page }) => {
    await page.goto('/ua/auth/register')
    await chooseOrganizer(page)

    await page.locator('#register-email').fill('e2e-absent@example.com')
    await page.locator('#register-password').fill('a-long-enough-password')
    await page.locator('#register-password-confirm').fill('a-long-enough-password')
    await page.locator('#register-firstName').fill('І')
    await page.getByRole('button', { name: t('common.register'), exact: true }).click()

    await expect(page.locator('#register-firstName-error')).toHaveText(
      t('errors.fieldTooShort', { min: PROFILE_LIMITS.REQUIRED_TEXT_MIN }),
    )
  })

  /**
   * The marker is `aria-hidden` because the field already carries `aria-required`, so this
   * is the sighted reader's only cue — and the count is what is being pinned: a required
   * field nobody marked is the defect, whichever role is selected.
   */
  test('marks every required field with an asterisk', async ({ page }) => {
    await page.goto('/ua/auth/register')

    // Email and the two password fields, for every role.
    await expect(page.locator('.auth-form__required')).toHaveCount(3)

    await chooseOrganizer(page)

    // Plus firstName, lastName, qualification and the two professional fields.
    await expect(page.locator('.auth-form__required')).toHaveCount(8)
  })

  /**
   * Google signs an account in; it cannot create one, so the button has no business on this
   * page — clicking it there could only end in "register with email and password first".
   */
  test('offers no Google sign-up', async ({ page }) => {
    await page.goto('/ua/auth/register')

    await expect(page.locator('.google-auth')).toHaveCount(0)
  })

  test('still offers Google on the login page', async ({ page }) => {
    await page.goto('/ua/auth/login')

    await expect(page.locator('.google-auth__btn')).toBeVisible()
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

// The callback exchanges the code in onMounted, so what it renders on failure is only
// observable in a browser. It used to throw createError() instead, and app/error.vue maps
// by status code alone — every failure looked the same and the specific message was lost.
test.describe('google callback', () => {
  test('names the other provider when the address already belongs to one', async ({ page }) => {
    await stubGoogleAuthFailure(page, 409, 'CONFLICT')

    await page.goto('/ua/auth/callback?code=e2e-not-a-real-code')

    // The copy lives in its own paragraph: the alert container also holds the button.
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.locator('.auth-page__error-text')).toHaveText(t('auth.callbackProviderConflict'))
    await expect(page.getByRole('link', { name: t('auth.callbackTryAnotherWay') })).toBeVisible()
  })

  // Google signs an account in; it never creates one. Without this branch the visitor sees
  // a generic "try again" and retries the same provider forever.
  test('offers registration when the Google identity has no account', async ({ page }) => {
    await stubGoogleAuthFailure(page, 404, 'NOT_FOUND')

    await page.goto('/ua/auth/callback?code=e2e-not-a-real-code')

    await expect(page.locator('.auth-page__error-text')).toHaveText(t('auth.errors.accountNotFound'))
    // Scoped to the alert: an anonymous visitor also gets a Register button in the header.
    await expect(
      page.locator('.auth-page__error').getByRole('link', { name: t('common.register') }),
    ).toBeVisible()
  })

  test('keeps the generic wording for any other failure', async ({ page }) => {
    await stubGoogleAuthFailure(page, 400, 'VALIDATION_FAILED')

    await page.goto('/ua/auth/callback?code=e2e-not-a-real-code')

    await expect(page.locator('.auth-page__error-text')).toHaveText(t('auth.callbackError'))
  })
})
