import { defineConfig, type PrismaConfig } from 'prisma/config'
import { config } from 'dotenv'

// The Prisma CLI injects `.env` before evaluating this file, but the module is also
// imported directly — by tests and by `tsx database/seed.ts` — where nothing else would
// have read it.
config()

/**
 * Builds the CLI configuration for a given database URL, or for none.
 *
 * The datasource is omitted entirely when the URL is absent rather than filled with a
 * placeholder. `prisma generate` — which `postinstall` runs on every install, including a
 * CI job or a Preview build that has no database — needs no URL at all, and a dummy one
 * would turn a missing variable into a connection error pointing at a host nobody owns.
 * Commands that do need a database (`migrate`, `db pull`, `studio`) then fail with
 * Prisma's own missing-datasource message, which names the real problem.
 */
export function buildPrismaConfig(databaseUrl: string | undefined): PrismaConfig {
  return {
    schema: 'database/schema.prisma',

    ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),

    migrations: {
      seed: 'tsx database/seed.ts',
    },
  }
}

export default defineConfig(buildPrismaConfig(process.env.DATABASE_URL))
