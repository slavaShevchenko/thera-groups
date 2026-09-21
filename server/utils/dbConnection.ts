import { SUPABASE_ROOT_CA } from './supabaseCa'

// pg-connection-string сбрасывает ssl в {} всякий раз, когда в URL присутствует
// sslmode (node_modules/pg-connection-string/index.js:77-78), поэтому явный
// ssl.ca невозможно передать рядом с connectionString — закреплённый CA молча
// теряется, а node-pg 8.x трактует sslmode=require как verify-full и падает с
// SELF_SIGNED_CERT_IN_CHAIN. Раскладываем URL сами и задаём TLS явно: трафик
// остаётся зашифрованным И верифицированным по Supabase Root CA.
export function createDbConnectionConfig(connectionString: string) {
  const url = new URL(connectionString)

  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    ssl: { ca: SUPABASE_ROOT_CA, rejectUnauthorized: true },
  }
}
