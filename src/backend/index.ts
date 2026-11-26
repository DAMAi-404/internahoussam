/**
 * Picks the backend: Supabase when VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are set, demo otherwise.
 * Nothing else in the app knows which one is running (except the demo login shortcuts).
 */
import { createDemoBackend } from './demo'
import type { Backend } from './types'

let instance: Backend | null = null
let pending: Promise<Backend> | null = null

export const supabaseConfigured = (): boolean =>
  Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)

export async function loadBackend(): Promise<Backend> {
  if (instance) return instance
  pending ??= (async () => {
    if (supabaseConfigured()) {
      const { createSupabaseBackend } = await import('./supabase')
      instance = createSupabaseBackend()
    } else {
      instance = createDemoBackend()
    }
    return instance
  })()
  return pending
}

export function getBackend(): Backend {
  if (!instance) throw new Error('Backend not loaded yet: await loadBackend() first')
  return instance
}
