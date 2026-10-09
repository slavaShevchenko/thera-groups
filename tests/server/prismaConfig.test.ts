import { describe, it, expect } from 'vitest'
import { buildPrismaConfig } from '../../prisma.config'

describe('buildPrismaConfig', () => {
  it('points the CLI at the schema and the seed command', () => {
    const config = buildPrismaConfig('postgresql://user:pass@localhost:5432/app')

    expect(config.schema).toBe('database/schema.prisma')
    expect(config.migrations?.seed).toBe('tsx database/seed.ts')
  })

  it('passes the URL through for the commands that need a database', () => {
    const config = buildPrismaConfig('postgresql://user:pass@localhost:5432/app')

    expect(config.datasource).toEqual({ url: 'postgresql://user:pass@localhost:5432/app' })
  })

  // `postinstall` runs `prisma generate`, so a CI job or a Preview build with no database
  // configured evaluates this file. It used to throw on import and take the install down
  // before `nuxt build` ever ran.
  it('omits the datasource entirely when there is no URL', () => {
    const config = buildPrismaConfig(undefined)

    expect('datasource' in config).toBe(false)
    expect(config.schema).toBe('database/schema.prisma')
  })

  it('treats an empty URL the same as a missing one, rather than as a host to connect to', () => {
    expect('datasource' in buildPrismaConfig('')).toBe(false)
  })
})
