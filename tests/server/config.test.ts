import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  DEFAULT_EMAIL_FROM,
  DEFAULT_ORGANIZER_AVATARS_BUCKET,
  resolveEnvValue,
  resolveServerEnv,
  useServerConfig,
  validateServerEnv,
  type ServerEnv,
} from '~~/server/utils/config'

function fullEnv(overrides: Partial<ServerEnv> = {}): ServerEnv {
  return {
    databaseUrl: 'postgresql://localhost:5432/app',
    supabaseServiceRoleKey: 'service-role',
    supabaseAnonKey: 'anon',
    resendApiKey: 're_test',
    emailFrom: 'noreply@psygroup.org',
    resendWebhookSecret: 'whsec_test',
    adminEmail: 'admin@psygroup.org',
    adminPassword: 'generated',
    siteUrl: 'https://psygroup.org',
    supabaseUrl: 'https://project.supabase.co',
    storageBucketOrganizerAvatars: 'organizer-avatars',
    ...overrides,
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('resolveEnvValue', () => {
  it('prefers runtimeConfig, which is what a NUXT_* override writes to', () => {
    vi.stubEnv('RESEND_API_KEY', 'from-env')

    expect(resolveEnvValue('from-runtime', 'RESEND_API_KEY')).toBe('from-runtime')
  })

  it('falls back to the bare environment name when runtimeConfig is empty', () => {
    vi.stubEnv('RESEND_API_KEY', 'from-env')

    expect(resolveEnvValue('', 'RESEND_API_KEY')).toBe('from-env')
  })

  it('is empty when neither source has it, so validation can tell', () => {
    vi.stubEnv('RESEND_API_KEY', '')

    expect(resolveEnvValue('', 'RESEND_API_KEY')).toBe('')
    expect(resolveEnvValue(undefined, 'RESEND_API_KEY')).toBe('')
  })

  it('ignores a runtime value that is not a string', () => {
    vi.stubEnv('EMAIL_FROM', 'noreply@psygroup.org')

    expect(resolveEnvValue(42, 'EMAIL_FROM')).toBe('noreply@psygroup.org')
  })
})

describe('validateServerEnv', () => {
  it('reports nothing for a fully configured production deployment', () => {
    expect(validateServerEnv(fullEnv(), true)).toEqual({
      missing: [],
      absentOptional: [],
      absentRequiredInProduction: [],
    })
  })

  // The gap this exists for: production used to boot green with no mail configuration at
  // all, and every notification was then silently dropped into a SKIPPED EmailEvent.
  it.each<[string, Partial<ServerEnv>]>([
    ['RESEND_API_KEY', { resendApiKey: '' }],
    ['EMAIL_FROM', { emailFrom: '' }],
    ['RESEND_WEBHOOK_SECRET', { resendWebhookSecret: '' }],
  ])('refuses to start production without %s', (envName, overrides) => {
    const { missing } = validateServerEnv(fullEnv(overrides), true)

    expect(missing).toContain(envName)
  })

  it('lists all three mail variables at once, so one deploy fixes the whole gap', () => {
    const { missing } = validateServerEnv(
      fullEnv({ resendApiKey: '', emailFrom: '', resendWebhookSecret: '' }),
      true,
    )

    expect(missing).toEqual(
      expect.arrayContaining(['RESEND_API_KEY', 'EMAIL_FROM', 'RESEND_WEBHOOK_SECRET']),
    )
  })

  it('warns instead of blocking in dev, where a checkout may have no Resend account', () => {
    const result = validateServerEnv(
      fullEnv({ resendApiKey: '', emailFrom: '', resendWebhookSecret: '' }),
      false,
    )

    expect(result.missing).toEqual([])
    expect(result.absentRequiredInProduction).toEqual(
      expect.arrayContaining(['RESEND_API_KEY', 'EMAIL_FROM', 'RESEND_WEBHOOK_SECRET']),
    )
  })

  it.each<[string, Partial<ServerEnv>]>([
    ['DATABASE_URL', { databaseUrl: '' }],
    ['SUPABASE_SERVICE_ROLE_KEY', { supabaseServiceRoleKey: '' }],
    ['SUPABASE_ANON_KEY', { supabaseAnonKey: '' }],
    ['SUPABASE_URL', { supabaseUrl: '' }],
    ['SITE_URL', { siteUrl: '' }],
  ])('requires %s in every mode', (envName, overrides) => {
    expect(validateServerEnv(fullEnv(overrides), true).missing).toContain(envName)
    expect(validateServerEnv(fullEnv(overrides), false).missing).toContain(envName)
  })

  // nuxt.config.ts falls back to http://localhost:3000, so the emptiness check above can
  // never catch it — and a localhost SITE_URL in production silently builds every
  // canonical, sitemap and Open Graph URL from the wrong host.
  it.each(['http://localhost:3000', 'http://127.0.0.1:3000'])(
    'rejects %s as a production SITE_URL',
    (siteUrl) => {
      expect(validateServerEnv(fullEnv({ siteUrl }), true).missing).toContain('SITE_URL')
    },
  )

  it('accepts localhost in dev, which is the only host a checkout has', () => {
    const { missing } = validateServerEnv(fullEnv({ siteUrl: 'http://localhost:3000' }), false)

    expect(missing).toEqual([])
  })

  it('names SITE_URL once when it is both localhost and the only problem', () => {
    const { missing } = validateServerEnv(fullEnv({ siteUrl: 'http://localhost:3000' }), true)

    expect(missing.filter(name => name === 'SITE_URL')).toHaveLength(1)
  })

  // Canonical URLs, sitemap.xml and every Open Graph tag are built from this one value.
  // An http:// SITE_URL in production publishes all of them at a scheme the site itself
  // refuses — HSTS and the `secure` cookie flag make each one a redirect — and Google
  // treats an http canonical on an https page as a mismatch and does not adopt it.
  it.each([
    'http://psygroup.org',
    'http://www.psygroup.org',
    'psygroup.org',
    'ftp://psygroup.org',
  ])('rejects %s as a production SITE_URL', (siteUrl) => {
    const { missing } = validateServerEnv(fullEnv({ siteUrl }), true)

    expect(missing).toContain('SITE_URL')
    expect(missing.filter(name => name === 'SITE_URL')).toHaveLength(1)
  })

  it('accepts an https SITE_URL in production', () => {
    expect(validateServerEnv(fullEnv({ siteUrl: 'https://psygroup.org' }), true).missing).toEqual([])
  })

  it('accepts plain http in dev, where there is no certificate to have', () => {
    const { missing } = validateServerEnv(fullEnv({ siteUrl: 'http://192.168.1.20:3000' }), false)

    expect(missing).toEqual([])
  })

  it('keeps the bootstrap credentials optional everywhere', () => {
    const result = validateServerEnv(fullEnv({ adminEmail: '', adminPassword: '' }), true)

    expect(result.missing).toEqual([])
    expect(result.absentOptional).toEqual(['ADMIN_EMAIL', 'ADMIN_PASSWORD'])
  })

  it('names environment variables, not internal keys, so the message is actionable', () => {
    const { missing } = validateServerEnv(fullEnv({ resendApiKey: '' }), true)

    expect(missing.join(' ')).not.toMatch(/resendApiKey/)
  })
})

/**
 * `runtimeConfig` now holds empty defaults so no secret is baked into the build output,
 * which makes this resolution the only thing standing between a deployment and an empty
 * configuration. The fake stands in for what Nitro hands `useRuntimeConfig()` in production.
 */
describe('useServerConfig', () => {
  const emptyRuntimeConfig = {
    databaseUrl: '',
    supabaseServiceRoleKey: '',
    supabaseAnonKey: '',
    resendApiKey: '',
    emailFrom: '',
    adminEmail: '',
    adminPassword: '',
    public: {
      siteUrl: 'https://psygroup.org',
      supabaseUrl: 'https://project.supabase.co',
    },
  }

  it('resolves every secret from the environment at runtime', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://prod/db')
    vi.stubEnv('RESEND_API_KEY', 're_prod')
    vi.stubEnv('RESEND_WEBHOOK_SECRET', 'whsec_prod')

    const resolved = useServerConfig(emptyRuntimeConfig)

    expect(resolved.databaseUrl).toBe('postgresql://prod/db')
    expect(resolved.resendApiKey).toBe('re_prod')
    expect(resolved.resendWebhookSecret).toBe('whsec_prod')
  })

  it('lets a NUXT_* runtime override win over the bare name', () => {
    vi.stubEnv('RESEND_API_KEY', 're_from_env')

    const resolved = useServerConfig({ ...emptyRuntimeConfig, resendApiKey: 're_from_runtime' })

    expect(resolved.resendApiKey).toBe('re_from_runtime')
  })

  it('takes the public URLs from runtimeConfig only, matching what the client bundle sees', () => {
    vi.stubEnv('SITE_URL', 'https://rotated.example')

    const resolved = useServerConfig(emptyRuntimeConfig)

    expect(resolved.siteUrl).toBe('https://psygroup.org')
    expect(resolved.supabaseUrl).toBe('https://project.supabase.co')
  })

  it('falls back to the shared sender, so config and transport cannot disagree', () => {
    vi.stubEnv('EMAIL_FROM', '')

    expect(useServerConfig(emptyRuntimeConfig).emailFrom).toBe(DEFAULT_EMAIL_FROM)
  })

  // The validator is given `resolveServerEnv()`, not `useServerConfig()`: the sender default
  // would otherwise make an unset EMAIL_FROM look configured, and production would boot
  // green while sending from an address nobody verified in Resend.
  it('keeps the raw resolver free of the sender default', () => {
    vi.stubEnv('EMAIL_FROM', '')

    const raw = resolveServerEnv(emptyRuntimeConfig)

    expect(raw.emailFrom).toBe('')
    expect(validateServerEnv(raw, true).missing).toContain('EMAIL_FROM')
  })

  it('reads every private key from the environment it names, not from a neighbouring one', () => {
    vi.stubEnv('DATABASE_URL', 'db-url')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role')
    vi.stubEnv('SUPABASE_ANON_KEY', 'anon-key')
    vi.stubEnv('RESEND_API_KEY', 'resend-key')
    vi.stubEnv('EMAIL_FROM', 'from-address')
    vi.stubEnv('RESEND_WEBHOOK_SECRET', 'webhook-secret')
    vi.stubEnv('ADMIN_EMAIL', 'admin-address')
    vi.stubEnv('ADMIN_PASSWORD', 'admin-password')
    vi.stubEnv('STORAGE_BUCKET_ORGANIZER_AVATARS', 'avatars-bucket')

    expect(resolveServerEnv({ public: {} })).toEqual({
      databaseUrl: 'db-url',
      supabaseServiceRoleKey: 'service-role',
      supabaseAnonKey: 'anon-key',
      resendApiKey: 'resend-key',
      emailFrom: 'from-address',
      resendWebhookSecret: 'webhook-secret',
      adminEmail: 'admin-address',
      adminPassword: 'admin-password',
      siteUrl: '',
      supabaseUrl: '',
      storageBucketOrganizerAvatars: 'avatars-bucket',
    })
  })

  // No migration creates a Storage bucket, so a deployment that named its bucket
  // differently has to be able to say so — and one that said nothing must still work.
  it('falls back to the documented bucket name', () => {
    vi.stubEnv('STORAGE_BUCKET_ORGANIZER_AVATARS', '')

    expect(useServerConfig(emptyRuntimeConfig).storageBucketOrganizerAvatars)
      .toBe(DEFAULT_ORGANIZER_AVATARS_BUCKET)
  })

  it('lets a NUXT_* override name the bucket', () => {
    vi.stubEnv('STORAGE_BUCKET_ORGANIZER_AVATARS', 'from-env')

    const resolved = useServerConfig({
      ...emptyRuntimeConfig,
      storageBucketOrganizerAvatars: 'from-runtime',
    })

    expect(resolved.storageBucketOrganizerAvatars).toBe('from-runtime')
  })
})
