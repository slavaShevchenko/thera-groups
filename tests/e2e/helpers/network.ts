import type { Page } from '@playwright/test'

export interface WriteStub {
  calls: string[]
}

// Answers every non-GET /api/groups/** request with a canned success so a spec can
// drive form flows that would otherwise autosave into the shared database.
// GET requests (including /api/groups/:slug/edit) pass through untouched.
export async function stubGroupWrites(page: Page, slug: string): Promise<WriteStub> {
  const stub: WriteStub = { calls: [] }

  await page.route('**/api/groups/**', async (route) => {
    const request = route.request()

    if (request.method() === 'GET') {
      await route.continue()
      return
    }

    stub.calls.push(`${request.method()} ${new URL(request.url()).pathname}`)

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ group: { id: 'e2e-stub', slug, status: 'DRAFT' } }),
    })
  })

  return stub
}
