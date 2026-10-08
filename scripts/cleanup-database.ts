/* eslint-disable no-console */
// Одноразовий скрипт: повне очищення БД перед ручним тестуванням.
// Видаляє ВСІ дані, окрім одного ADMIN-користувача (ADMIN_USER_ID).
//
//   ADMIN_USER_ID=<id> npx tsx scripts/cleanup-database.ts
//
// Не чіпає: public."_prisma_migrations" (історія міграцій), auth.* та storage.*
// (схеми Supabase).
import { config } from 'dotenv'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { createDbConnectionConfig } from '../server/utils/dbConnection'

config()

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL не знайдено в .env')
}

// Prisma 7 не піднімається без driver adapter, а Supabase вимагає TLS із
// закріпленим Root CA — тому той самий конфіг з'єднання, що й в server/utils/prisma.ts
const adapter = new PrismaPg(createDbConnectionConfig(connectionString))
const prisma = new PrismaClient({ adapter })

// Діти перед батьками. rate_limits та _GroupToGroupTag не описані в Prisma-схемі
// (перша належить rate-limiter-flexible, друга — implicit m2m), тому йдуть raw SQL.
const RAW_TABLES_FIRST = ['_GroupToGroupTag']
const RAW_TABLES_LAST = ['rate_limits']

async function main() {
  const adminId = process.env.ADMIN_USER_ID
  if (!adminId) {
    console.error('❌ ADMIN_USER_ID не заданий')
    process.exit(1)
  }

  // Pre-flight: без цієї перевірки невалідний id у `not: adminId` видалить і адміна.
  const admin = await prisma.user.findUnique({ where: { id: adminId } })
  if (!admin) {
    console.error(`❌ Користувача з id ${adminId} не існує — нічого не видаляю`)
    process.exit(1)
  }
  if (admin.role !== 'ADMIN') {
    console.error(`❌ ${admin.email} має роль ${admin.role}, а не ADMIN — нічого не видаляю`)
    process.exit(1)
  }

  const host = new URL(connectionString).hostname
  console.log(`host:  ${host}`)
  console.log(`admin: ${admin.email} (${admin.id}, authId=${admin.authId ?? 'NULL'})\n`)

  const deleted: Array<[string, number]> = []

  await prisma.$transaction(async (tx) => {
    for (const table of RAW_TABLES_FIRST) {
      const count = await tx.$executeRawUnsafe(`DELETE FROM public."${table}"`)
      deleted.push([table, count])
      console.log(`✓ ${table}: видалено ${count}`)
    }

    const steps = [
      ['applicationAnswer', () => tx.applicationAnswer.deleteMany()],
      ['application', () => tx.application.deleteMany()],
      ['applicationQuestion', () => tx.applicationQuestion.deleteMany()],
      ['review', () => tx.review.deleteMany()],
      ['favorite', () => tx.favorite.deleteMany()],
      ['notification', () => tx.notification.deleteMany()],
      ['report', () => tx.report.deleteMany()],
      ['emailEvent', () => tx.emailEvent.deleteMany()],
      ['groupCoOrganizer', () => tx.groupCoOrganizer.deleteMany()],
      ['group', () => tx.group.deleteMany()],
      ['groupTag', () => tx.groupTag.deleteMany()],
      ['organizerProfile', () => tx.organizerProfile.deleteMany()],
      ['user (окрім admin)', () => tx.user.deleteMany({ where: { id: { not: adminId } } })],
    ] as const

    for (const [label, run] of steps) {
      const { count } = await run()
      deleted.push([label, count])
      console.log(`✓ ${label}: видалено ${count}`)
    }

    for (const table of RAW_TABLES_LAST) {
      const count = await tx.$executeRawUnsafe(`DELETE FROM public."${table}"`)
      deleted.push([table, count])
      console.log(`✓ ${table}: видалено ${count}`)
    }
  })

  const total = deleted.reduce((sum, [, count]) => sum + count, 0)
  console.log(`\n✅ База очищена: видалено ${total} рядків. Залишився admin ${admin.email}`)
}

main()
  .catch((error) => {
    console.error('❌ Очищення не виконано:', error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
