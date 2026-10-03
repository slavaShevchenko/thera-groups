import { expect, type Page } from '@playwright/test'
import { credentials } from './env'
import { t } from './text'

export async function loginAsOrganizer(page: Page): Promise<void> {
  await page.goto('/ua/auth/login')
  await page.locator('#login-email').fill(credentials.email)
  await page.locator('#login-password').fill(credentials.password)
  await page.getByRole('button', { name: t('common.login'), exact: true }).click()

  await page.waitForURL(/\/ua\/?$/)
  // The notification bell only renders once useUser() holds an authenticated user.
  await expect(page.locator('.app-header__bell')).toBeVisible()
}
