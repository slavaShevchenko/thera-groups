/* eslint-disable no-console */
// Одноразовий read-only скрипт діагностики: кількість рядків у кожній таблиці
// public-схеми + список ADMIN-користувачів. Нічого не змінює.
import { config } from 'dotenv'
import pg from 'pg'
import { createDbConnectionConfig } from '../server/utils/dbConnection'

config()

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL не знайдено в .env')
}

const pool = new pg.Pool({ ...createDbConnectionConfig(connectionString), max: 2 })

async function main() {
  console.log(`host: ${new URL(connectionString).hostname}\n`)

  const { rows } = await pool.query(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name`,
  )

  console.log('--- Кількість рядків (public schema) ---')
  for (const { table_name: table } of rows) {
    const res = await pool.query(`SELECT COUNT(*)::int AS n FROM public."${table}"`)
    console.log(`${String(res.rows[0].n).padStart(7)}  ${table}`)
  }

  console.log('\n--- ADMIN користувачі ---')
  const admins = await pool.query(
    `SELECT id, email, role, "authId", "isActive", "createdAt"
       FROM public."User"
      WHERE role = 'ADMIN'
      ORDER BY "createdAt"`,
  )
  if (admins.rows.length === 0) {
    console.log('(немає жодного ADMIN)')
  }
  for (const a of admins.rows) {
    console.log(
      `${a.id}  ${a.email}  authId=${a.authId ?? 'NULL'}  isActive=${a.isActive}  createdAt=${a.createdAt.toISOString()}`,
    )
  }

  console.log('\n--- Ролі всіх користувачів ---')
  const byRole = await pool.query(
    `SELECT role, COUNT(*)::int AS n FROM public."User" GROUP BY role ORDER BY role`,
  )
  for (const r of byRole.rows) {
    console.log(`${String(r.n).padStart(7)}  ${r.role}`)
  }

  console.log('\n--- Supabase Auth (службова схема, скрипт її не чіпає) ---')
  try {
    const authCount = await pool.query('SELECT COUNT(*)::int AS n FROM auth.users')
    console.log(`auth.users: ${authCount.rows[0].n}`)

    const linked = await pool.query(
      `SELECT u.email, u."authId", (a.id IS NOT NULL) AS "authExists", a."email_confirmed_at" IS NOT NULL AS confirmed
         FROM public."User" u
         LEFT JOIN auth.users a ON a.id::text = u."authId"
        WHERE u.role = 'ADMIN'`,
    )
    for (const l of linked.rows) {
      console.log(
        `ADMIN ${l.email}: authId=${l.authId ?? 'NULL'} → запис у auth.users ${l.authExists ? 'Є' : 'ВІДСУТНІЙ'}, email підтверджено: ${l.confirmed}`,
      )
    }
  }
  catch (error) {
    console.log(`auth.users: немає доступу (${(error as Error).message})`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => pool.end())
