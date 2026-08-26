import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    ignores: [
      '.nuxt/',
      'dist/',
      'node_modules/',
      'prisma/',
      'prisma.config.ts',
      'coverage/',
      'app/generated/**',
      'database/',
    ],
  },
  {
    rules: {
    // 1. Точки с запятой строго запрещены
      'semi': ['error', 'never'],

      // 2. Одинарные кавычки для строк
      'quotes': ['error', 'single', { avoidEscape: true, allowTemplateLiterals: true }],

      // 3. Предупреждать о console.log (чтобы не забыть в продакшене), но не ломать сборку
      'no-console': 'warn',

      // 4. Запрет неиспользуемых переменных (игнорируем те, что начинаются с _)
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      // 5. Vue: строгий порядок блоков <script>, <template>, <style>
      'vue/block-order': ['error', { order: ['script', 'template', 'style'] }],

      // 6. Vue: самозакрывающиеся теги для компонентов и void-элементов
      'vue/html-self-closing': [
        'error',
        {
          html: { void: 'always', normal: 'never', component: 'always' },
        },
      ],

      // 7. Vue: отключаем требование multi-word для компонентов (для pages/layouts это избыточно)
      'vue/multi-word-component-names': 'off',

      // 8. Безопасность: предупреждать об использовании v-html
      'vue/no-v-html': 'warn',
    },
  })
