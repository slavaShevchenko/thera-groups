import { expect as baseExpect, test as baseTest, type Page } from '@playwright/test'

const HYDRATION_TIMEOUT = 90_000

// `page.goto()` resolves on the load event, which in Nuxt dev fires before the client
// entry has even been fetched — the route is still being compiled. Clicking an
// SSR-rendered control in that window is silently dropped because Vue has not attached
// its listeners yet, so every navigation waits for hydration to settle first.
async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const target = window as unknown as { useNuxtApp?: () => { isHydrating?: boolean } }
    try {
      return typeof target.useNuxtApp === 'function' && target.useNuxtApp().isHydrating === false
    }
    catch {
      return false
    }
  }, undefined, { timeout: HYDRATION_TIMEOUT })
}

export const test = baseTest.extend({
  page: async ({ page }, use) => {
    const goto = page.goto.bind(page)

    page.goto = async (url, options) => {
      const response = await goto(url, options)
      await waitForHydration(page)
      return response
    }

    await use(page)
  },
})

export const expect = baseExpect
