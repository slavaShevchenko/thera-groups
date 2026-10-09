import { describe, it, expect, vi } from 'vitest'
import { findAuthUsersByEmail } from '~~/server/utils/supabase'
import type { AdminClient } from '~~/server/utils/supabase'

type FakeUser = { id: string, email?: string, identities?: { provider: string }[] }

/**
 * GoTrue's /admin/users: pages of at most 50, whatever perPage was asked for.
 */
function makeClient(users: FakeUser[], maxPerPage = 50) {
  const listUsers = vi.fn(async (params?: { page?: number, perPage?: number }) => {
    const perPage = Math.min(params?.perPage ?? maxPerPage, maxPerPage)
    const page = params?.page ?? 1
    const start = (page - 1) * perPage
    const lastPage = Math.max(1, Math.ceil(users.length / perPage))

    return {
      data: {
        users: users.slice(start, start + perPage),
        aud: 'authenticated',
        nextPage: page < lastPage ? page + 1 : null,
        lastPage,
        total: users.length,
      },
      error: null,
    }
  })

  return {
    listUsers,
    client: { auth: { admin: { listUsers } } } as unknown as AdminClient,
  }
}

function fillers(count: number): FakeUser[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `filler-${i + 1}`,
    email: `filler${i + 1}@test.com`,
  }))
}

describe('findAuthUsersByEmail', () => {
  it('finds a record that sits past the first GoTrue page', async () => {
    const { client, listUsers } = makeClient([
      ...fillers(60),
      { id: 'target', email: 'target@test.com' },
    ])

    await expect(findAuthUsersByEmail(client, 'target@test.com'))
      .resolves
      .toEqual([{ id: 'target', providers: [] }])
    expect(listUsers).toHaveBeenCalledTimes(2)
    expect(listUsers).toHaveBeenNthCalledWith(1, { page: 1, perPage: 1000 })
    expect(listUsers).toHaveBeenNthCalledWith(2, { page: 2, perPage: 1000 })
  })

  it('returns every match and compares case-insensitively', async () => {
    const { client } = makeClient([
      { id: 'a', email: 'Dupe@Test.com' },
      ...fillers(55),
      { id: 'b', email: ' dupe@test.com ' },
      { id: 'c', email: 'other@test.com' },
    ])

    await expect(findAuthUsersByEmail(client, 'dupe@test.com')).resolves.toEqual([
      { id: 'a', providers: [] },
      { id: 'b', providers: [] },
    ])
  })

  // The caller deletes what this returns. Reporting the provider is what lets it refuse to
  // delete an account somebody signs in to through Google.
  it('reports which providers an address is linked to', async () => {
    const { client } = makeClient([
      { id: 'google-only', email: 'target@test.com', identities: [{ provider: 'google' }] },
      { id: 'password', email: 'TARGET@test.com', identities: [{ provider: 'email' }] },
      { id: 'no-identities', email: 'target@test.com' },
    ])

    await expect(findAuthUsersByEmail(client, 'target@test.com')).resolves.toEqual([
      { id: 'google-only', providers: ['google'] },
      { id: 'password', providers: ['email'] },
      { id: 'no-identities', providers: [] },
    ])
  })

  it('ignores records without an email', async () => {
    const { client } = makeClient([{ id: 'no-email' }, { id: 'target', email: 'target@test.com' }])

    await expect(findAuthUsersByEmail(client, 'target@test.com'))
      .resolves
      .toEqual([{ id: 'target', providers: [] }])
  })

  it('stops at the first empty page', async () => {
    const { client, listUsers } = makeClient(fillers(30))

    await expect(findAuthUsersByEmail(client, 'absent@test.com')).resolves.toEqual([])
    // Page 1 is short only because the directory is short — GoTrue may also cap
    // perPage — so the walk ends on the empty page 2, not on the short page 1.
    expect(listUsers).toHaveBeenCalledTimes(2)
  })

  it('walks an exact multiple of the page size and then stops', async () => {
    const { client, listUsers } = makeClient(fillers(100))

    await expect(findAuthUsersByEmail(client, 'absent@test.com')).resolves.toEqual([])
    expect(listUsers).toHaveBeenCalledTimes(3)
    expect(listUsers).toHaveBeenNthCalledWith(3, { page: 3, perPage: 1000 })
  })

  it('reports an empty directory as no match', async () => {
    const { client } = makeClient([])

    await expect(findAuthUsersByEmail(client, 'absent@test.com')).resolves.toEqual([])
  })

  it('throws when the admin API reports an error instead of guessing', async () => {
    const listUsers = vi.fn(async () => ({
      data: { users: [] },
      error: { message: 'Invalid API key' },
    }))
    const client = { auth: { admin: { listUsers } } } as unknown as AdminClient

    await expect(findAuthUsersByEmail(client, 'target@test.com'))
      .rejects
      .toMatchObject({ message: 'Invalid API key' })
  })
})
