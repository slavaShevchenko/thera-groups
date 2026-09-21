import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'node',
    globals: true,
    include: [
      'tests/unit/**/*.test.ts',
      'tests/integration/**/*.test.ts',
      'tests/shared/**/*.test.ts',
      'tests/server/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['server/**/*.ts', 'shared/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.d.ts', 'server/routes/**'],
    },
    setupFiles: ['tests/setup.ts'],
  },
})
