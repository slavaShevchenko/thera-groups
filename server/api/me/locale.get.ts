export default defineEventHandler(async (event) => {
  // TODO: Добавить проверку авторизации через Supabase, когда будет реализован модуль логина
  // Пока возвращаем null, чтобы middleware использовал localStorage
  return null
})
