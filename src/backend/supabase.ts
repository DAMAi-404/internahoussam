/**
 * Supabase backend: same interface as the demo, implemented with the Postgres RPCs in supabase/migrations.
 * Selected automatically when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.
 * Business errors arrive as SQLSTATE P0001 with the domain code as message (see _err in the migrations).
 */
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { DomainError, type DomainErrorCode } from '@/domain/errors'
import type { AppNotification, Catalog, LaboState, Order, Session, Shop, StatsResult } from '@/domain/types'
import { getSupabase } from '@/lib/supabase'
import type { Backend, Topic } from './types'

/** Shop accounts are not personal: one login per shop (ROLES §4). Must match scripts/setup-supabase.mjs. */
export const shopEmail = (shopId: string) => `shop-${shopId}@accounts.mahroussa.app`

const CODES: DomainErrorCode[] = [
  'forbidden', 'not_found', 'invalid_state', 'stale_version', 'locked', 'invalid_quantity', 'product_unavailable',
  'empty_order', 'text_too_long', 'reason_required', 'wrong_pin', 'not_signed_in',
]

interface PgError {
  message?: string
  details?: string | null
  code?: string
  status?: number
}

/** Maps a Supabase error to a DomainError. Anything unknown becomes `network`, which the outbox retries. */
export function toDomainError(err: PgError): DomainError {
  const code = err.message as DomainErrorCode
  if (err.code === 'P0001' && CODES.includes(code)) {
    let params: Record<string, string> = {}
    try {
      params = err.details ? (JSON.parse(err.details) as Record<string, string>) : {}
    } catch {
      /* details are optional */
    }
    return new DomainError(code, params)
  }
  if (err.code === '42501') return new DomainError('forbidden')
  if (err.status === 401 || err.code === 'PGRST301' || err.code === 'PGRST303') return new DomainError('not_signed_in')
  if (err.code && /^(22|23)/.test(err.code)) return new DomainError('invalid_state') // a constraint caught bad input
  return new DomainError('network')
}

export function createSupabaseBackend(client: SupabaseClient = getSupabase()): Backend {
  const sb = client

  async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
    let res
    try {
      res = await sb.rpc(fn, args)
    } catch {
      throw new DomainError('network')
    }
    if (res.error) throw toDomainError({ ...res.error, status: res.status })
    return res.data as T
  }

  async function session(): Promise<Session | null> {
    const { data } = await sb.auth.getSession()
    const user = data.session?.user
    if (!user) return null
    const { data: p, error } = await sb.from('profiles').select('role, shop_id, display_name').eq('user_id', user.id).single()
    if (error || !p) return null
    return { userId: user.id, role: p.role, name: p.display_name, shopId: p.shop_id }
  }

  async function signIn(email: string, password: string): Promise<Session> {
    const { error } = await sb.auth.signInWithPassword({ email, password })
    if (error) throw new DomainError(error.status === 400 ? 'wrong_pin' : 'network')
    const s = await session()
    if (!s) {
      await sb.auth.signOut()
      throw new DomainError('forbidden') // account without a profile
    }
    return s
  }

  return {
    kind: 'supabase',

    async listShops() {
      const { data, error } = await sb.from('shops').select('id, code, name_fr, name_ar').eq('active', true).order('sort')
      if (error) throw toDomainError(error)
      return (data ?? []).map((s): Shop => ({ id: s.id, code: s.code, name: { fr: s.name_fr, ar: s.name_ar } }))
    },
    getSession: session,
    signInShop: (shopId, pin) => signIn(shopEmail(shopId), pin),
    signInStaff: (email, password) => signIn(email, password),
    async signOut() {
      await sb.auth.signOut()
    },

    getCatalog: () => rpc<Catalog>('get_catalog'),
    async saveProduct(product) {
      await rpc('save_product', { p: product })
      return product
    },
    setProductActive: (productId, active) => rpc('set_product_active', { p_id: productId, p_active: active }),
    setPackActive: (productId, packId, active) => rpc('set_pack_active', { p_product: productId, p_pack: packId, p_active: active }),
    async uploadPhoto(productId, file) {
      const path = `${productId}/${Date.now()}.webp`
      const { error } = await sb.storage.from('product-photos').upload(path, file, { contentType: 'image/webp', upsert: true })
      if (error) throw new DomainError('network')
      return sb.storage.from('product-photos').getPublicUrl(path).data.publicUrl
    },

    listOrders: () => rpc<Order[]>('list_orders'),
    submitOrder: (input) => rpc<Order>('submit_order', { p_id: input.id, p_lines: input.lines, p_note: input.shopNote }),
    updatePendingOrder: (id, version, lines, shopNote) => rpc<Order>('update_pending_order', { p_id: id, p_version: version, p_lines: lines, p_note: shopNote }),
    cancelOrder: (id, version) => rpc<Order>('cancel_order', { p_id: id, p_version: version }),
    startReview: (id) => rpc<Order>('start_review', { p_id: id }),
    releaseReview: async (id) => {
      await rpc('release_review', { p_id: id })
    },
    decideOrder: (id, version, decisions, labNote, team) =>
      rpc<Order>('decide_order', { p_id: id, p_version: version, p_decisions: decisions, p_lab_note: labNote, p_team: team }),
    addNote: (orderId, lineId, body) => rpc<Order>('add_note', { p_order: orderId, p_line: lineId, p_body: body }),
    setLinePrep: (orderId, lineId, prep, preparedQty, reason) =>
      rpc<Order>('set_line_prep', { p_order: orderId, p_line: lineId, p_prep: prep, p_qty: preparedQty, p_reason: reason }),
    closeOrder: (id, version) => rpc<Order>('close_order', { p_id: id, p_version: version }),
    confirmReceived: (id) => rpc<Order>('confirm_received', { p_id: id }),

    getLaboState: () => rpc<LaboState>('get_labo_state'),
    switchTeam: (team, pin) => rpc<LaboState>('switch_labo_team', { p_team: team, p_pin: pin }),

    listNotifications: () => rpc<AppNotification[]>('list_notifications'),
    markNotificationsRead: async (ids) => {
      await rpc('mark_notifications_read', { p_ids: ids === 'all' ? null : ids })
    },
    async savePushSubscription(sub) {
      await rpc('save_push_subscription', { p_endpoint: sub.endpoint, p_p256dh: sub.keys.p256dh, p_auth: sub.keys.auth })
    },

    getStats: (q) =>
      rpc<StatsResult>('stats_range', { p_from: q.from, p_to: q.to, p_shop: q.shopId ?? null, p_category: q.categoryId ?? null, p_product: q.productId ?? null }),

    subscribe(listener) {
      const tables: [string, Topic][] = [
        ['orders', 'orders'],
        ['order_lines', 'orders'],
        ['order_notes', 'orders'],
        ['notifications', 'notifications'],
        ['products', 'catalog'],
        ['product_packs', 'catalog'],
        ['labo_state', 'labo'],
      ]
      let channel: RealtimeChannel = sb.channel('mahroussa-changes')
      for (const [table, topic] of tables) {
        channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => listener(topic))
      }
      channel.subscribe((status) => {
        // After a reconnect, refetch everything: realtime is a hint, not a delivery guarantee.
        if (status === 'SUBSCRIBED') (['orders', 'notifications', 'catalog', 'labo'] as Topic[]).forEach(listener)
      })
      return () => void sb.removeChannel(channel)
    },
  }
}
