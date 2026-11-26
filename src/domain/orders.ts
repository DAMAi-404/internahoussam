/**
 * Order state machine (PRD §8). Pure functions over a mutable draft of an Order.
 * The demo backend calls them directly; the SQL RPCs implement the same rules (supabase/migrations).
 * Every mutation appends an OrderEvent and, where the docs say so, bumps `version`.
 */
import { LIMITS, textLength, type LimitKey } from '@/lib/limits'
import { isValidQuantity } from '@/lib/quantity'
import { businessDate } from '@/lib/time'
import { DomainError } from './errors'
import type {
  Actor,
  CartLineInput,
  Catalog,
  Note,
  Order,
  OrderEvent,
  OrderLine,
  OrderStatus,
  Prep,
  ReviewDecision,
  Shop,
  Team,
} from './types'

export const REVIEW_LOCK_MINUTES = 10

export type IdFactory = () => string

const iso = (d: Date) => d.toISOString()

function checkText(text: string | null | undefined, key: LimitKey): void {
  if (text && textLength(text) > LIMITS[key]) throw new DomainError('text_too_long', { limit: String(LIMITS[key]) })
}

function expectStatus(order: Order, allowed: OrderStatus[]): void {
  if (!allowed.includes(order.status)) throw new DomainError('invalid_state', { status: order.status })
}

function expectVersion(order: Order, version: number): void {
  if (order.version !== version) throw new DomainError('stale_version')
}

function expectRole(actor: Actor, roles: Actor['role'][]): void {
  if (!roles.includes(actor.role)) throw new DomainError('forbidden')
}

function pushEvent(
  order: Order,
  newId: IdFactory,
  now: Date,
  actor: Actor,
  type: OrderEvent['type'],
  from: OrderStatus | null,
  extra: Partial<OrderEvent> = {},
): OrderEvent {
  const event: OrderEvent = { id: newId(), type, at: iso(now), actor, from, to: order.status, ...extra }
  order.events.push(event)
  return event
}

/** Builds snapshot lines from cart input. Rejects inactive products/packs and invalid quantities. */
export function buildLines(catalog: Catalog, input: CartLineInput[], newId: IdFactory): OrderLine[] {
  if (input.length === 0) throw new DomainError('empty_order')
  const seen = new Set<string>()
  return input.map((l) => {
    const p = catalog.products.find((x) => x.id === l.productId)
    if (!p || !p.active) throw new DomainError('product_unavailable', { productId: l.productId })
    const pack = p.mode === 'pack' ? p.packs.find((k) => k.id === l.packId) : null
    if (p.mode === 'pack' && (!pack || !pack.active)) throw new DomainError('product_unavailable', { productId: p.id })
    if (p.mode !== 'pack' && l.packId) throw new DomainError('invalid_quantity')
    if (!isValidQuantity({ mode: p.mode, step: p.step, max: p.max }, l.qty)) throw new DomainError('invalid_quantity')
    const key = `${p.id}:${pack?.id ?? ''}`
    if (seen.has(key)) throw new DomainError('invalid_quantity')
    seen.add(key)
    return {
      id: newId(),
      productId: p.id,
      packId: pack?.id ?? null,
      name: { ...p.name },
      categoryId: p.categoryId,
      mode: p.mode,
      step: p.mode === 'pack' ? 1 : p.step,
      packLabel: pack?.label ?? null,
      requested: l.qty,
      approved: l.qty,
      decision: 'accepted',
      refusalReason: null,
      prep: 'todo',
      preparedQty: null,
      laboReason: null,
      prepTeam: null,
      changedByShop: false,
    }
  })
}

export function orderCode(shop: Shop, bizDate: string, sequence: number): string {
  const [, m, d] = bizDate.split('-')
  return `${shop.code}-${m}${d}-${String(sequence).padStart(2, '0')}`
}

export function createOrder(args: {
  id: string
  shop: Shop
  lines: CartLineInput[]
  shopNote: string
  catalog: Catalog
  actor: Actor
  now: Date
  sequence: number // nth order of this shop today
  newId: IdFactory
}): Order {
  expectRole(args.actor, ['shop'])
  checkText(args.shopNote, 'orderNote')
  const biz = businessDate(args.now)
  const order: Order = {
    id: args.id,
    code: orderCode(args.shop, biz, args.sequence),
    shopId: args.shop.id,
    status: 'submitted',
    businessDate: biz,
    version: 1,
    team: null,
    shopNote: args.shopNote.trim(),
    notes: [],
    lines: buildLines(args.catalog, args.lines, args.newId),
    events: [],
    reviewer: null,
    editedDuringReview: false,
    at: { submitted: iso(args.now) },
  }
  pushEvent(order, args.newId, args.now, args.actor, 'submitted', null)
  return order
}

/** Shop edits while waiting (PRD SHP-11 / TRK-3). Unchanged lines keep the reviewer's decisions. */
export function updatePending(
  order: Order,
  a: { version: number; lines: CartLineInput[]; shopNote: string; catalog: Catalog; actor: Actor; now: Date; newId: IdFactory },
): void {
  expectRole(a.actor, ['shop'])
  expectStatus(order, ['submitted', 'in_review'])
  expectVersion(order, a.version)
  checkText(a.shopNote, 'orderNote')
  const fresh = buildLines(a.catalog, a.lines, a.newId)
  const inReview = order.status === 'in_review'
  order.lines = fresh.map((nl) => {
    const same = order.lines.find((ol) => ol.productId === nl.productId && ol.packId === nl.packId && ol.requested === nl.requested)
    if (same) return same
    return { ...nl, changedByShop: inReview }
  })
  order.shopNote = a.shopNote.trim()
  if (inReview) order.editedDuringReview = true
  order.version++
  pushEvent(order, a.newId, a.now, a.actor, 'shop_edited', order.status)
}

/** Shop deletes while waiting, or reviewer cancels a validated order that the labo has not started. */
export function cancelOrder(order: Order, a: { version: number; actor: Actor; now: Date; newId: IdFactory }): Actor | null {
  expectVersion(order, a.version)
  if (a.actor.role === 'shop') expectStatus(order, ['submitted', 'in_review'])
  else {
    expectRole(a.actor, ['owner', 'deputy'])
    expectStatus(order, ['validated'])
  }
  const heldBy = order.status === 'in_review' ? order.reviewer : null
  const from = order.status
  order.status = 'cancelled'
  order.at.cancelled = iso(a.now)
  order.version++
  pushEvent(order, a.newId, a.now, a.actor, 'cancelled', from)
  return heldBy
}

function lockExpired(order: Order, now: Date): boolean {
  if (!order.at.reviewStarted) return true
  return now.getTime() - new Date(order.at.reviewStarted).getTime() > REVIEW_LOCK_MINUTES * 60_000
}

export function startReview(order: Order, a: { actor: Actor; now: Date; newId: IdFactory }): void {
  expectRole(a.actor, ['owner', 'deputy'])
  expectStatus(order, ['submitted', 'in_review'])
  if (order.status === 'in_review') {
    if (order.reviewer?.role === a.actor.role) return // already mine
    if (!lockExpired(order, a.now)) throw new DomainError('locked', { by: order.reviewer?.name ?? '' })
  }
  const from = order.status
  order.status = 'in_review'
  order.reviewer = a.actor
  order.at.reviewStarted = iso(a.now)
  pushEvent(order, a.newId, a.now, a.actor, 'review_started', from)
}

export function releaseReview(order: Order, a: { actor: Actor; now: Date; newId: IdFactory }): void {
  if (order.status !== 'in_review' || order.reviewer?.role !== a.actor.role) return
  order.status = 'submitted'
  order.reviewer = null
  pushEvent(order, a.newId, a.now, a.actor, 'review_released', 'in_review')
}

export function decideOrder(
  order: Order,
  a: { version: number; decisions: ReviewDecision[]; labNote: string; team: Team; actor: Actor; now: Date; newId: IdFactory },
): void {
  expectRole(a.actor, ['owner', 'deputy'])
  expectStatus(order, ['in_review'])
  if (order.reviewer?.role !== a.actor.role) throw new DomainError('locked', { by: order.reviewer?.name ?? '' })
  expectVersion(order, a.version)
  checkText(a.labNote, 'orderNote')
  for (const line of order.lines) {
    const d = a.decisions.find((x) => x.lineId === line.id)
    if (!d) throw new DomainError('invalid_state', { line: line.id })
    checkText(d.note, 'lineNote')
    checkText(d.refusalReason, 'lineNote')
    if (d.decision === 'refused') {
      if (!d.refusalReason?.trim()) throw new DomainError('reason_required')
      line.decision = 'refused'
      line.approved = 0
      line.refusalReason = d.refusalReason.trim()
    } else {
      const approved = d.decision === 'accepted' ? line.requested : d.approved
      const valid = approved >= line.step && approved <= line.requested && approved % line.step === 0
      if (!valid) throw new DomainError('invalid_quantity')
      line.approved = approved
      line.decision = approved < line.requested ? 'reduced' : 'accepted'
      line.refusalReason = null
    }
    line.changedByShop = false
    if (d.note?.trim()) order.notes.push(note(a.newId, line.id, d.note.trim(), a.actor, a.now))
  }
  if (a.labNote.trim()) order.notes.push(note(a.newId, null, a.labNote.trim(), a.actor, a.now))
  order.editedDuringReview = false
  order.version++
  const allRefused = order.lines.every((l) => l.decision === 'refused')
  if (allRefused) {
    order.status = 'refused'
    order.at.refused = iso(a.now)
    pushEvent(order, a.newId, a.now, a.actor, 'refused', 'in_review')
  } else {
    order.status = 'validated'
    order.team = a.team
    order.at.validated = iso(a.now)
    pushEvent(order, a.newId, a.now, a.actor, 'validated', 'in_review', { detail: a.team })
  }
}

function note(newId: IdFactory, lineId: string | null, body: string, author: Actor, now: Date): Note {
  return { id: newId(), lineId, audience: 'labo', body, author, at: iso(now) }
}

/** Owner/deputy adds a note after validation (PRD OWN-6). Quantities never change. */
export function addNote(order: Order, a: { lineId: string | null; body: string; actor: Actor; now: Date; newId: IdFactory }): Note {
  expectRole(a.actor, ['owner', 'deputy'])
  expectStatus(order, ['validated', 'in_preparation'])
  const body = a.body.trim()
  if (!body) throw new DomainError('reason_required')
  checkText(body, a.lineId ? 'lineNote' : 'orderNote')
  if (a.lineId && !order.lines.some((l) => l.id === a.lineId)) throw new DomainError('not_found')
  const n = note(a.newId, a.lineId, body, a.actor, a.now)
  order.notes.push(n)
  pushEvent(order, a.newId, a.now, a.actor, 'note_added', order.status, { lineId: a.lineId })
  return n
}

/** Labo marks a line. Idempotent: applying the same state twice gives the same result. */
export function setLinePrep(
  order: Order,
  a: { lineId: string; prep: Prep; preparedQty: number | null; reason: string | null; team: Team; actor: Actor; now: Date; newId: IdFactory },
): void {
  expectRole(a.actor, ['labo'])
  expectStatus(order, ['validated', 'in_preparation'])
  const line = order.lines.find((l) => l.id === a.lineId)
  if (!line || line.decision === 'refused') throw new DomainError('not_found')
  if (a.prep === 'partial' || a.prep === 'not_done') {
    if (!a.reason?.trim()) throw new DomainError('reason_required')
    checkText(a.reason, 'laboReason')
  }
  if (a.prep === 'partial') {
    const q = a.preparedQty ?? 0
    if (!(q > 0 && q < line.approved && q % line.step === 0)) throw new DomainError('invalid_quantity')
  }
  if (
    line.prep === a.prep &&
    line.preparedQty === (a.prep === 'partial' ? a.preparedQty : null) &&
    (line.laboReason ?? null) === (a.reason?.trim() || null)
  ) {
    return // idempotent replay
  }
  line.prep = a.prep
  line.preparedQty = a.prep === 'partial' ? a.preparedQty : null
  line.laboReason = a.prep === 'partial' || a.prep === 'not_done' ? (a.reason?.trim() ?? null) : null
  line.prepTeam = a.prep === 'todo' ? null : a.team
  const actor = { ...a.actor, team: a.team }
  if (order.status === 'validated') {
    order.status = 'in_preparation'
    order.at.prepStarted = iso(a.now)
    pushEvent(order, a.newId, a.now, actor, 'prep_started', 'validated')
  }
  const type = a.prep === 'partial' || a.prep === 'not_done' ? 'line_problem' : 'line_prepped'
  pushEvent(order, a.newId, a.now, actor, type, order.status, { lineId: line.id, detail: a.prep })
}

export function closeOrder(order: Order, a: { version: number; team: Team; actor: Actor; now: Date; newId: IdFactory }): void {
  expectRole(a.actor, ['labo'])
  expectStatus(order, ['in_preparation'])
  expectVersion(order, a.version)
  if (order.lines.some((l) => l.decision !== 'refused' && l.prep === 'todo')) throw new DomainError('invalid_state', { reason: 'lines_todo' })
  order.status = 'ready'
  order.at.ready = iso(a.now)
  order.version++
  pushEvent(order, a.newId, a.now, { ...a.actor, team: a.team }, 'ready', 'in_preparation', { detail: a.team })
}

export function confirmReceived(order: Order, a: { actor: Actor; now: Date; newId: IdFactory }): void {
  expectRole(a.actor, ['shop'])
  if (order.status === 'received') return // idempotent
  expectStatus(order, ['ready'])
  order.status = 'received'
  order.at.received = iso(a.now)
  order.version++
  pushEvent(order, a.newId, a.now, a.actor, 'received', 'ready')
}

/** Lines the labo has to prepare (refused lines are hidden from the labo). */
export const laboLines = (o: Order) => o.lines.filter((l) => l.decision !== 'refused')
export const preparedCount = (o: Order) => laboLines(o).filter((l) => l.prep !== 'todo').length
export const hasProblem = (o: Order) => o.lines.some((l) => l.prep === 'partial' || l.prep === 'not_done')
