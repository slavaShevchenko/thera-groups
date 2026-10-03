import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'node',
    globals: true,
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
