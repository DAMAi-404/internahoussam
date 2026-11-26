/**
 * Demo backend: the whole app works in the browser with realistic data until Supabase keys are set.
 * - Data in localStorage (shared by all tabs = all "devices" on this computer).
 * - Session per tab (sessionStorage), so one tab can be a shop and another the owner.
 * - Cross-tab realtime through BroadcastChannel, mutations serialised with the Web Locks API.
 * Business rules come from src/domain (same rules as the SQL RPCs).
 */
import * as rules from '@/domain/orders'
import { DomainError } from '@/domain/errors'
import { notificationsFor } from '@/domain/notifications'
import { computeStats } from '@/domain/stats'
import type {
  Actor,
  AppNotification,
  Catalog,
  LaboState,
  Order,
  Product,
  Role,
  Session,
  Shop,
  Team,
} from '@/domain/types'
import { businessDate, teamAt } from '@/lib/time'
import { DEMO_CATALOG, DEMO_SHOP_PIN, DEMO_TEAM_PINS, SHOPS } from './seed'
import type { Backend, Topic } from './types'

export interface KV {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

interface DemoDb {
  v: 1
  catalog: Catalog
  orders: Order[]
  notifications: AppNotification[]
  labo: LaboState
  scheduled: string[] // keys of already-sent scheduled notifications
}

const DB_KEY = 'mahroussa-demo-db'
const SESSION_KEY = 'mahroussa-demo-session'
const CHANNEL = 'mahroussa-demo'

export const uid = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

const staffName: Record<Exclude<Role, 'shop'>, string> = { owner: 'Patron', deputy: 'Adjoint', labo: 'Labo' }

/* ---------------- seed history (deterministic) ---------------- */

function prng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seedDb(now = new Date()): DemoDb {
  const rnd = prng(20261126)
  const pick = <T,>(xs: T[]): T => {
    const v = xs[Math.floor(rnd() * xs.length)]
    if (v === undefined) throw new Error('seed: empty list')
    return v
  }
  const catalog: Catalog = structuredClone(DEMO_CATALOG)
  const active = catalog.products.filter((p) => p.active)
  const orders: Order[] = []
  const owner: Actor = { role: 'owner', name: staffName.owner }
  const seq = new Map<string, number>()
  const minutes = (base: Date, m: number) => new Date(base.getTime() + m * 60_000)

  const randomLines = () => {
    const n = 3 + Math.floor(rnd() * 4)
    const chosen = new Set<Product>()
    while (chosen.size < n) chosen.add(pick(active))
    return [...chosen].map((p) => {
      const pack = p.mode === 'pack' ? pick(p.packs.filter((k) => k.active)) : null
      const mult = 1 + Math.floor(rnd() * (p.mode === 'pack' ? 3 : 8))
      return { productId: p.id, packId: pack?.id ?? null, qty: p.step * mult }
    })
  }

  const make = (shop: Shop, at: Date) => {
    const biz = businessDate(at)
    const k = `${shop.id}|${biz}`
    const sequence = (seq.get(k) ?? 0) + 1
    seq.set(k, sequence)
    return rules.createOrder({
      id: uid(),
      shop,
      lines: randomLines(),
      shopNote: rnd() < 0.15 ? 'Urgent pour ce soir' : '',
      catalog,
      actor: { role: 'shop', name: shop.name.fr },
      now: at,
      sequence,
      newId: uid,
    })
  }

  const review = (o: Order, at: Date, allRefuse = false) => {
    rules.startReview(o, { actor: owner, now: at, newId: uid })
    const decisions = o.lines.map((l, i) => {
      if (allRefuse || (i === 1 && rnd() < 0.2)) return { lineId: l.id, decision: 'refused' as const, approved: 0, refusalReason: 'Rupture', note: null }
      if (i === 0 && rnd() < 0.25 && l.requested > l.step)
        return { lineId: l.id, decision: 'reduced' as const, approved: l.requested - l.step, refusalReason: null, note: null }
      return { lineId: l.id, decision: 'accepted' as const, approved: l.requested, refusalReason: null, note: null }
    })
    rules.decideOrder(o, { version: o.version, decisions, labNote: '', team: teamAt(at), actor: owner, now: minutes(at, 2), newId: uid })
  }

  const prepare = (o: Order, at: Date, upTo = Infinity) => {
    const team = teamAt(at)
    const labo: Actor = { role: 'labo', name: staffName.labo, team }
    rules.laboLines(o).slice(0, upTo).forEach((l, i) => {
      const problem = rnd() < 0.08
      const halfway = Math.floor(l.approved / 2 / l.step) * l.step
      if (problem && halfway > 0) {
        rules.setLinePrep(o, { lineId: l.id, prep: 'partial', preparedQty: halfway, reason: 'Rupture', team, actor: labo, now: minutes(at, i * 4), newId: uid })
      } else {
        rules.setLinePrep(o, { lineId: l.id, prep: 'done', preparedQty: null, reason: null, team, actor: labo, now: minutes(at, i * 4), newId: uid })
      }
    })
  }

  // 20 past business days of finished orders (feeds statistics)
  for (let d = 20; d >= 1; d--) {
    const day = new Date(now.getTime() - d * 86_400_000)
    day.setUTCHours(6, 0, 0, 0)
    const count = 4 + Math.floor(rnd() * 6)
    for (let i = 0; i < count; i++) {
      const at = minutes(day, Math.floor(rnd() * 13 * 60))
      const o = make(pick(SHOPS), at)
      if (rnd() < 0.06) {
        review(o, minutes(at, 5 + rnd() * 20), true)
      } else {
        review(o, minutes(at, 4 + Math.floor(rnd() * 20)))
        prepare(o, minutes(at, 30))
        rules.closeOrder(o, { version: o.version, team: teamAt(at), actor: { role: 'labo', name: staffName.labo }, now: minutes(at, 70 + rnd() * 60), newId: uid })
        rules.confirmReceived(o, { actor: { role: 'shop', name: '' }, now: minutes(at, 130 + rnd() * 90), newId: uid })
      }
      orders.push(o)
    }
  }

  // Today: live orders in every state, so each role has something to do.
  const shop = (id: string): Shop => {
    const s = SHOPS.find((x) => x.id === id)
    if (!s) throw new Error(`seed: unknown shop ${id}`)
    return s
  }
  const ago = (m: number) => new Date(now.getTime() - m * 60_000)
  const live: Order[] = []
  const ready = make(shop('madania'), ago(190))
  review(ready, ago(180))
  prepare(ready, ago(150))
  rules.closeOrder(ready, { version: ready.version, team: teamAt(ago(40)), actor: { role: 'labo', name: staffName.labo }, now: ago(35), newId: uid })
  live.push(ready)
  const preparing = make(shop('kitani'), ago(70))
  review(preparing, ago(45))
  prepare(preparing, ago(25), 2)
  live.push(preparing)
  const accepted = make(shop('boulevard'), ago(30))
  review(accepted, ago(12))
  live.push(accepted)
  const waitingMine = make(shop('madania'), ago(9))
  live.push(waitingMine)
  live.push(make(shop('kouba'), ago(6)))
  live.push(make(shop('rouiba'), ago(2)))

  const notifications: AppNotification[] = []
  for (const o of live) {
    for (const e of o.events) {
      for (const n of notificationsFor(e, o)) {
        notifications.push({ id: uid(), recipient: n.recipient, type: n.type, orderId: o.id, params: n.params, push: n.push, at: e.at, readAt: null })
      }
    }
  }
  orders.push(...live)

  return { v: 1, catalog, orders, notifications, labo: { team: teamAt(now), since: ago(95).toISOString() }, scheduled: [] }
}

/* ---------------- backend ---------------- */

export interface DemoOptions {
  store?: KV
  sessionStore?: KV
  now?: () => Date
  latencyMs?: number
}

function browserKV(kind: 'local' | 'session'): KV | undefined {
  try {
    const s = kind === 'local' ? globalThis.localStorage : globalThis.sessionStorage
    if (!s) return undefined
    s.getItem('__probe')
    return s
  } catch {
    return undefined
  }
}

export function memoryKV(): KV {
  const m = new Map<string, string>()
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) }
}

export function createDemoBackend(opts: DemoOptions = {}): Backend {
  const store = opts.store ?? browserKV('local') ?? memoryKV()
  const sessionStore = opts.sessionStore ?? browserKV('session') ?? memoryKV()
  const now = opts.now ?? (() => new Date())
  const latency = opts.latencyMs ?? 60
  const listeners = new Set<(t: Topic) => void>()
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null
  channel?.addEventListener('message', (e: MessageEvent<Topic[]>) => e.data.forEach((t) => listeners.forEach((l) => l(t))))

  const emit = (topics: Topic[]) => {
    topics.forEach((t) => listeners.forEach((l) => l(t)))
    channel?.postMessage(topics)
  }
  const wait = () => (latency ? new Promise((r) => setTimeout(r, latency)) : Promise.resolve())

  const load = (): DemoDb => {
    const raw = store.getItem(DB_KEY)
    if (raw) {
      try {
        const db = JSON.parse(raw) as DemoDb
        if (db.v === 1) return db
      } catch {
        /* corrupted: reseed below */
      }
    }
    const db = seedDb(now())
    store.setItem(DB_KEY, JSON.stringify(db))
    return db
  }
  const save = (db: DemoDb) => store.setItem(DB_KEY, JSON.stringify(db))

  async function locked<T>(fn: () => T): Promise<T> {
    const locks = (globalThis.navigator as Navigator | undefined)?.locks
    return locks ? locks.request(DB_KEY, () => fn()) : fn()
  }

  function readSession(): Session | null {
    const raw = sessionStore.getItem(SESSION_KEY) ?? store.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  }
  function writeSession(s: Session | null) {
    for (const kv of [sessionStore, store]) {
      if (s) kv.setItem(SESSION_KEY, JSON.stringify(s))
      else kv.removeItem(SESSION_KEY)
    }
  }
  function requireSession(roles?: Role[]): Session {
    const s = readSession()
    if (!s) throw new DomainError('not_signed_in')
    if (roles && !roles.includes(s.role)) throw new DomainError('forbidden')
    return s
  }
  const actorOf = (s: Session, db?: DemoDb): Actor => ({ role: s.role, name: s.name, team: s.role === 'labo' ? (db?.labo.team ?? null) : undefined })

  function visibleTo(s: Session, o: Order): boolean {
    if (s.role === 'owner' || s.role === 'deputy') return true
    if (s.role === 'shop') return o.shopId === s.shopId
    return ['validated', 'in_preparation', 'ready'].includes(o.status) || (o.status === 'received' && !!o.at.ready)
  }

  /** Strips what a role must not see (ROLES.md): labo never sees refused lines or the shop's note. */
  function project(s: Session, o: Order): Order {
    if (s.role !== 'labo') return o
    return { ...o, shopNote: '', lines: o.lines.filter((l) => l.decision !== 'refused') }
  }

  function notify(db: DemoDb, order: Order, fromIndex: number) {
    for (const e of order.events.slice(fromIndex)) {
      for (const n of notificationsFor(e, order)) {
        db.notifications.push({ id: uid(), recipient: n.recipient, type: n.type, orderId: order.id, params: n.params, push: n.push, at: e.at, readAt: null })
      }
    }
  }

  /** Scheduled reminders (pg_cron in Supabase): waiting > 15 min, handover not confirmed. */
  function runScheduled(db: DemoDb): boolean {
    const t = now()
    let changed = false
    for (const o of db.orders) {
      if (o.status !== 'submitted') continue
      const key = `waiting:${o.id}`
      if (t.getTime() - new Date(o.at.submitted).getTime() > 15 * 60_000 && !db.scheduled.includes(key)) {
        db.scheduled.push(key)
        for (const r of ['owner', 'deputy']) {
          db.notifications.push({ id: uid(), recipient: r, type: 'order_waiting', orderId: o.id, params: { code: o.code, shopId: o.shopId, lines: o.lines.length }, push: true, at: t.toISOString(), readAt: null })
        }
        changed = true
      }
    }
    const boundary = new Date(t)
    const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Algiers', hour: '2-digit', hourCycle: 'h23' }).format(t))
    const shiftHour = h >= 16 ? 16 : h >= 4 ? 4 : -8
    boundary.setTime(t.getTime() - ((h - shiftHour) * 60 + t.getUTCMinutes()) * 60_000)
    const key = `handover:${boundary.toISOString().slice(0, 13)}`
    const since = db.labo.since ? new Date(db.labo.since).getTime() : 0
    if (since < boundary.getTime() && t.getTime() - boundary.getTime() > 15 * 60_000 && !db.scheduled.includes(key)) {
      db.scheduled.push(key)
      db.notifications.push({ id: uid(), recipient: 'owner', type: 'handover_missing', orderId: null, params: { team: teamAt(t) }, push: true, at: t.toISOString(), readAt: null })
      changed = true
    }
    return changed
  }

  async function mutateOrder(id: string, roles: Role[], fn: (o: Order, s: Session, db: DemoDb) => void): Promise<Order> {
    await wait()
    const result = await locked(() => {
      const s = requireSession(roles)
      const db = load()
      const o = db.orders.find((x) => x.id === id)
      if (!o || !visibleTo(s, o)) throw new DomainError('not_found')
      const before = o.events.length
      fn(o, s, db)
      notify(db, o, before)
      save(db)
      return project(s, structuredClone(o))
    })
    emit(['orders', 'notifications'])
    return result
  }

  const sessionKeyOf = (s: Session) => (s.role === 'shop' ? `shop:${s.shopId}` : s.role)

  const backend: Backend = {
    kind: 'demo',

    async listShops() {
      return structuredClone(SHOPS)
    },
    async getSession() {
      return readSession()
    },
    async signInShop(shopId, pin) {
      await wait()
      const shop = SHOPS.find((s) => s.id === shopId)
      if (!shop || pin !== DEMO_SHOP_PIN) throw new DomainError('wrong_pin')
      const s: Session = { userId: `shop:${shop.id}`, role: 'shop', name: shop.name.fr, shopId: shop.id }
      writeSession(s)
      return s
    },
    async signInStaff() {
      throw new DomainError('forbidden') // demo uses signInDemo
    },
    async signInDemo(role, shopId) {
      if (role === 'shop') return backend.signInShop(shopId ?? 'madania', DEMO_SHOP_PIN)
      const s: Session = { userId: role, role, name: staffName[role], shopId: null }
      writeSession(s)
      return s
    },
    async signOut() {
      writeSession(null)
    },

    async getCatalog() {
      await wait()
      return structuredClone(load().catalog)
    },
    async saveProduct(product) {
      await wait()
      const saved = await locked(() => {
        requireSession(['owner'])
        const db = load()
        const i = db.catalog.products.findIndex((p) => p.id === product.id)
        if (i >= 0) db.catalog.products[i] = structuredClone(product)
        else db.catalog.products.push({ ...structuredClone(product), sort: db.catalog.products.length + 1 })
        save(db)
        return product
      })
      emit(['catalog'])
      return saved
    },
    async setProductActive(productId, activeFlag) {
      await locked(() => {
        requireSession(['owner', 'deputy'])
        const db = load()
        const p = db.catalog.products.find((x) => x.id === productId)
        if (!p) throw new DomainError('not_found')
        p.active = activeFlag
        save(db)
      })
      emit(['catalog'])
    },
    async setPackActive(productId, packId, activeFlag) {
      await locked(() => {
        requireSession(['owner', 'deputy'])
        const db = load()
        const pack = db.catalog.products.find((x) => x.id === productId)?.packs.find((k) => k.id === packId)
        if (!pack) throw new DomainError('not_found')
        pack.active = activeFlag
        save(db)
      })
      emit(['catalog'])
    },
    async uploadPhoto(_productId, file) {
      requireSession(['owner'])
      return await new Promise<string>((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result))
        r.onerror = () => reject(new DomainError('network'))
        r.readAsDataURL(file)
      })
    },

    async listOrders() {
      await wait()
      const s = requireSession()
      const db = load()
      if (runScheduled(db)) {
        save(db)
        emit(['notifications'])
      }
      return db.orders.filter((o) => visibleTo(s, o)).map((o) => project(s, structuredClone(o)))
    },

    async submitOrder(input) {
      await wait()
      const order = await locked(() => {
        const s = requireSession(['shop'])
        const db = load()
        const existing = db.orders.find((o) => o.id === input.id)
        if (existing) return structuredClone(existing) // idempotent retry
        const shop = SHOPS.find((x) => x.id === s.shopId)
        if (!shop) throw new DomainError('not_found')
        const biz = businessDate(now())
        const sequence = db.orders.filter((o) => o.shopId === shop.id && o.businessDate === biz).length + 1
        const o = rules.createOrder({ id: input.id, shop, lines: input.lines, shopNote: input.shopNote, catalog: db.catalog, actor: actorOf(s), now: now(), sequence, newId: uid })
        db.orders.push(o)
        notify(db, o, 0)
        save(db)
        return structuredClone(o)
      })
      emit(['orders', 'notifications'])
      return order
    },
    updatePendingOrder: (id, version, lines, shopNote) =>
      mutateOrder(id, ['shop'], (o, s, db) =>
        rules.updatePending(o, { version, lines, shopNote, catalog: db.catalog, actor: actorOf(s), now: now(), newId: uid }),
      ),
    cancelOrder: (id, version) => mutateOrder(id, ['shop', 'owner', 'deputy'], (o, s) => void rules.cancelOrder(o, { version, actor: actorOf(s), now: now(), newId: uid })),
    startReview: (id) => mutateOrder(id, ['owner', 'deputy'], (o, s) => rules.startReview(o, { actor: actorOf(s), now: now(), newId: uid })),
    async releaseReview(id) {
      await mutateOrder(id, ['owner', 'deputy'], (o, s) => rules.releaseReview(o, { actor: actorOf(s), now: now(), newId: uid }))
    },
    decideOrder: (id, version, decisions, labNote, team) =>
      mutateOrder(id, ['owner', 'deputy'], (o, s) => rules.decideOrder(o, { version, decisions, labNote, team, actor: actorOf(s), now: now(), newId: uid })),
    addNote: (orderId, lineId, body) =>
      mutateOrder(orderId, ['owner', 'deputy'], (o, s) => void rules.addNote(o, { lineId, body, actor: actorOf(s), now: now(), newId: uid })),
    setLinePrep: (orderId, lineId, prep, preparedQty, reason) =>
      mutateOrder(orderId, ['labo'], (o, s, db) => {
        if (!db.labo.team) throw new DomainError('forbidden')
        rules.setLinePrep(o, { lineId, prep, preparedQty, reason, team: db.labo.team, actor: actorOf(s, db), now: now(), newId: uid })
      }),
    closeOrder: (id, version) =>
      mutateOrder(id, ['labo'], (o, s, db) => {
        if (!db.labo.team) throw new DomainError('forbidden')
        rules.closeOrder(o, { version, team: db.labo.team, actor: actorOf(s, db), now: now(), newId: uid })
      }),
    confirmReceived: (id) => mutateOrder(id, ['shop'], (o, s) => rules.confirmReceived(o, { actor: actorOf(s), now: now(), newId: uid })),

    async getLaboState() {
      requireSession(['labo', 'owner', 'deputy'])
      return structuredClone(load().labo)
    },
    async switchTeam(team: Team, pin: string) {
      await wait()
      const state = await locked(() => {
        requireSession(['labo'])
        if (DEMO_TEAM_PINS[team] !== pin) throw new DomainError('wrong_pin')
        const db = load()
        db.labo = { team, since: now().toISOString() }
        save(db)
        return db.labo
      })
      emit(['labo'])
      return state
    },

    async listNotifications() {
      const s = requireSession()
      const key = sessionKeyOf(s)
      return load()
        .notifications.filter((n) => n.recipient === key)
        .sort((a, b) => b.at.localeCompare(a.at))
    },
    async markNotificationsRead(ids) {
      await locked(() => {
        const s = requireSession()
        const key = sessionKeyOf(s)
        const db = load()
        const t = now().toISOString()
        db.notifications.forEach((n) => {
          if (n.recipient === key && !n.readAt && (ids === 'all' || ids.includes(n.id))) n.readAt = t
        })
        save(db)
      })
      emit(['notifications'])
    },

    async getStats(query) {
      await wait()
      const s = requireSession(['owner', 'deputy', 'shop'])
      const q = s.role === 'shop' ? { ...query, shopId: s.shopId } : query
      return computeStats(load().orders, q, SHOPS)
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  return backend
}

/** Wipes the demo data (Settings > reset demo). */
export function resetDemo(store: KV | undefined = browserKV('local')): void {
  store?.removeItem(DB_KEY)
}
