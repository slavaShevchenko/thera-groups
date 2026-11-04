import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'node',
    globals: true,
    // Every integration suite points at the same TEST_DATABASE_URL, and some assert on
    // database-wide state ("the table has zero admins"). Run those files one at a time so
    // they cannot insert under each other; the whole integration run takes seconds anyway.
    fileParallelism: !process.env.TEST_DATABASE_URL,
    include: [
      'tests/unit/**/*.test.ts',
      'tests/shared/**/*.test.ts',
      'tests/server/**/*.test.ts',
      'tests/integration/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['server/**/*.ts', 'shared/**/*.ts', 'app/composables/**/*.ts', 'app/utils/**/*.ts'],
      exclude: ['server/routes/**', '**/*.test.ts', '**/*.d.ts', 'server/plugins/**'],
      // A ratchet, not a target: raise these only after measured coverage has actually
      // climbed past the new number, and never lower one to make a change pass. Measured
      // 2026-11-04 at 64.04 / 62.6 / 63.89 / 64.38, so 55 leaves ~7 points on the
      // tightest metric — enough that an ordinary refactor does not flap the gate.
      thresholds: {
        statements: 55,
        branches: 55,
        functions: 55,
        lines: 55,
      },
    },
    setupFiles: ['tests/setup.ts'],
  },
})
