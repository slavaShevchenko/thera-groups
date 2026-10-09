import { describe, it, expect } from 'vitest'
import { createDbConnectionConfig } from '~~/server/utils/dbConnection'
import { SUPABASE_ROOT_CA } from '~~/server/utils/supabaseCa'

/**
 * pg-connection-string drops an explicit `ssl` whenever the URL carries a `sslmode`, so the
 * pinned Supabase root CA has to be re-attached by hand — otherwise node-pg verifies the
 * pooler's self-signed chain against the system store and fails with SELF_SIGNED_CERT_IN_CHAIN.
 */
describe('createDbConnectionConfig', () => {
  const supabaseUrl
    = 'postgresql://postgres.abc:se%2Fcret@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require'

  it('splits the URL into pg connection fields', () => {
    const config = createDbConnectionConfig(supabaseUrl)

    expect(config).toMatchObject({
      host: 'aws-0-eu-central-1.pooler.supabase.com',
      port: 5432,
      user: 'postgres.abc',
      password: 'se/cret',
      database: 'postgres',
    })
  })

  it('defaults to the port pg uses when the URL omits one', () => {
    expect(createDbConnectionConfig('postgresql://u:p@db.internal/app').port).toBe(5432)
  })

  it('verifies TLS against the pinned Supabase root CA for sslmode=require', () => {
    expect(createDbConnectionConfig(supabaseUrl).ssl).toEqual({
      ca: SUPABASE_ROOT_CA,
      rejectUnauthorized: true,
    })
  })

  it('keeps verified TLS when the URL says nothing about sslmode', () => {
    expect(createDbConnectionConfig('postgresql://u:p@db.internal/app').ssl).toEqual({
      ca: SUPABASE_ROOT_CA,
      rejectUnauthorized: true,
    })
  })

  it('honours an explicit sslmode=disable opt-out, which a local throwaway database needs', () => {
    const config = createDbConnectionConfig(
      'postgresql://qc:qctest@localhost:5433/groupthera_test?sslmode=disable',
    )

    expect(config.ssl).toBe(false)
    expect(config).toMatchObject({ host: 'localhost', port: 5433, database: 'groupthera_test' })
  })

  it('does not treat any other sslmode value as an opt-out', () => {
    for (const mode of ['prefer', 'allow', 'verify-ca', 'DISABLE', '']) {
      const config = createDbConnectionConfig(`postgresql://u:p@db.internal/app?sslmode=${mode}`)
      expect(config.ssl, `sslmode=${mode || '(empty)'}`).toEqual({
        ca: SUPABASE_ROOT_CA,
        rejectUnauthorized: true,
      })
    }
  })
})
