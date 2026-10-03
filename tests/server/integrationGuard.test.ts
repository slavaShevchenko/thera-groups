import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  integrationSkipReason,
  testConnectionString,
} from '~~/tests/integration/_guard'

const TEST_DB = 'postgresql://test:test@127.0.0.1:5432/groupthera_test'
const APP_DB = 'postgresql://postgres:postgres@aws-1-eu-west-1.pooler.supabase.com:5432/postgres'

describe('integrationSkipReason', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('skips when TEST_DATABASE_URL is not set', () => {
    vi.stubEnv('TEST_DATABASE_URL', '')
    vi.stubEnv('DATABASE_URL', APP_DB)

    expect(integrationSkipReason()).toBe('TEST_DATABASE_URL is not set')
  })

  it('skips when TEST_DATABASE_URL is not a postgres URL', () => {
    vi.stubEnv('TEST_DATABASE_URL', 'mysql://localhost:3306/test')

    expect(integrationSkipReason()).toMatch(/not a postgresql:\/\/ URL/)
  })

  it('refuses to run against the app database even when that is what was configured', () => {
    vi.stubEnv('DATABASE_URL', APP_DB)
    vi.stubEnv('TEST_DATABASE_URL', APP_DB)

    expect(integrationSkipReason()).toMatch(/throwaway database/)
  })

  it('allows a separate throwaway postgres database', () => {
    vi.stubEnv('DATABASE_URL', APP_DB)
    vi.stubEnv('TEST_DATABASE_URL', TEST_DB)

    expect(integrationSkipReason()).toBeNull()
  })
})

describe('testConnectionString', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('never falls back to DATABASE_URL, which is what used to leak tests into the shared database', () => {
    vi.stubEnv('DATABASE_URL', APP_DB)
    vi.stubEnv('TEST_DATABASE_URL', '')

    expect(testConnectionString()).toBeFalsy()
    expect(testConnectionString()).not.toBe(APP_DB)
  })

  it('returns the configured test URL', () => {
    vi.stubEnv('TEST_DATABASE_URL', TEST_DB)

    expect(testConnectionString()).toBe(TEST_DB)
  })
})
