import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.E2E_PORT ?? 3000)
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Nuxt compiles each route on first request, so a wide worker pool makes every
  // worker wait on the same cold build. Two is enough to stay fast and stable.
  workers: process.env.CI ? 1 : 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  // Generous on purpose: Nuxt dev compiles each route on its first request, so a cold
  // page can take tens of seconds before it hydrates.
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    navigationTimeout: 90_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // reuseExistingServer keeps a developer's already-running `npm run dev` instead of
  // starting a second one — both would write to the same .nuxt/ directory.
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
