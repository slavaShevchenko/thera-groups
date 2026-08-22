import { defineConfig } from 'prisma/config'
import { config } from 'dotenv'

// Загружаем переменные окружения
config()

const dbUrl = process.env.DATABASE_URL

if (!dbUrl) {
  throw new Error('DATABASE_URL не найден в файле .env!')
}

export default defineConfig({
  schema: 'database/schema.prisma',

  // URL для CLI-команд (studio, db push, db pull, format, validate)
  datasource: {
    url: dbUrl,
  },

  // URL для работы с миграциями (migrate dev, migrate deploy)
  migrate: {
    url: dbUrl,
  },

  // Настройка сида
  migrations: {
    seed: 'npx prisma generate --schema=database/seed.schema.prisma && tsx database/seed.ts',
  },
})
