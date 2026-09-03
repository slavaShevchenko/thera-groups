// app/plugins/supabase.client.ts
import { createBrowserClient } from '@supabase/ssr'

export default defineNuxtPlugin(() => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
  }

  console.log('[Supabase Plugin] creating client...')

  const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: {
      name: 'sb',
      sameSite: 'lax',
      secure: false, // false для localhost
      path: '/',
    },
  })

  console.log('[Supabase Plugin] client created, checking storage...')

  // Проверяем что есть в localStorage и cookies
  const localStorageKeys = Object.keys(localStorage).filter(k => k.includes('supabase') || k.includes('sb-'))
  console.log('[Supabase Plugin] localStorage keys:', localStorageKeys)
  console.log('[Supabase Plugin] cookies:', document.cookie)

  return {
    provide: {
      supabase,
    },
  }
})
