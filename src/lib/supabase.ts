import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Typed with the generated `Database` type once the schema exists:
//   supabase gen types typescript --local > src/types/database.ts
let client: SupabaseClient | null = null

/** Lazily created so the app shell can load (and show a clear error) without env vars. */
export function getSupabase(): SupabaseClient {
  if (client) return client
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (!url || !anonKey) {
    throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local.')
  }
  client = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'mahroussa-auth' },
  })
  return client
}
