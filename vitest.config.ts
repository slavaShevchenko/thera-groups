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
      thresholds: {
        statements: 30,
        branches: 30,
        functions: 30,
        lines: 30,
      },
    },
    setupFiles: ['tests/setup.ts'],
  },
})
