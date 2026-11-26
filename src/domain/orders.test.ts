import { describe, expect, it } from 'vitest'
import { DEMO_CATALOG, SHOPS } from '@/backend/seed'
import * as r from './orders'
import { DomainError } from './errors'
import type { Actor, Order, ReviewDecision } from './types'

let n = 0
const newId = () => `id-${++n}`
const now = new Date('2026-11-26T09:00:00+01:00')
const shopActor: Actor = { role: 'shop', name: 'El Madania' }
const owner: Actor = { role: 'owner', name: 'Patron' }
const deputy: Actor = { role: 'deputy', name: 'Adjoint' }
const labo: Actor = { role: 'labo', name: 'Labo' }
const catalog = structuredClone(DEMO_CATALOG)

const make = (): Order =>
  r.createOrder({
    id: 'o1',
    shop: SHOPS[0]!,
    lines: [
      { productId: 'cornet', packId: null, qty: 150 },
      { productId: 'chantilly', packId: '10l', qty: 2 },
      { productId: 'pistache', packId: null, qty: 500 },
    ],
    shopNote: '',
    catalog,
    actor: shopActor,
    now,
    sequence: 2,
    newId,
  })

const code = (fn: () => unknown) => {
  try {
    fn()
  } catch (e) {
    return (e as DomainError).code
  }
  return 'ok'
}

const acceptAll = (o: Order): ReviewDecision[] => o.lines.map((l) => ({ lineId: l.id, decision: 'accepted' as const, approved: l.requested, refusalReason: null, note: null }))

describe('createOrder', () => {
  it('snapshots lines and builds a readable code', () => {
    const o = make()
    expect(o.code).toBe('EMD-1126-02')
    expect(o.status).toBe('submitted')
    expect(o.lines[1]).toMatchObject({ packLabel: '10 L', requested: 2, name: { fr: 'Crème chantilly' } })
    expect(o.events.map((e) => e.type)).toEqual(['submitted'])
  })

  it('rejects inactive products, off-step quantities, duplicates and long notes', () => {
    const base = { id: 'x', shop: SHOPS[0]!, shopNote: '', catalog, actor: shopActor, now, sequence: 1, newId }
    expect(code(() => r.createOrder({ ...base, lines: [{ productId: 'sorbet-citron', packId: '5l', qty: 1 }] }))).toBe('product_unavailable')
    expect(code(() => r.createOrder({ ...base, lines: [{ productId: 'cornet', packId: null, qty: 15 }] }))).toBe('invalid_quantity')
    expect(code(() => r.createOrder({ ...base, lines: [] }))).toBe('empty_order')
    expect(
      code(() =>
        r.createOrder({ ...base, lines: [{ productId: 'cornet', packId: null, qty: 10 }, { productId: 'cornet', packId: null, qty: 20 }] }),
      ),
    ).toBe('invalid_quantity')
    expect(code(() => r.createOrder({ ...base, shopNote: 'x'.repeat(161), lines: [{ productId: 'cornet', packId: null, qty: 10 }] }))).toBe('text_too_long')
    expect(code(() => r.createOrder({ ...base, actor: owner, lines: [{ productId: 'cornet', packId: null, qty: 10 }] }))).toBe('forbidden')
  })
})

describe('review', () => {
  it('locks the order to one reviewer, released on leave', () => {
    const o = make()
    r.startReview(o, { actor: owner, now, newId })
    expect(o.status).toBe('in_review')
    expect(code(() => r.startReview(o, { actor: deputy, now, newId }))).toBe('locked')
    // lock expires after 10 minutes
    r.startReview(o, { actor: deputy, now: new Date(now.getTime() + 11 * 60_000), newId })
    expect(o.reviewer?.role).toBe('deputy')
    r.releaseReview(o, { actor: deputy, now, newId })
    expect(o.status).toBe('submitted')
  })

  it('validates with reduced and refused lines, and rejects a stale version', () => {
    const o = make()
    r.startReview(o, { actor: owner, now, newId })
    const decisions = acceptAll(o)
    decisions[0] = { ...decisions[0]!, decision: 'reduced', approved: 100 }
    decisions[2] = { ...decisions[2]!, decision: 'refused', approved: 0, refusalReason: 'Rupture', note: null }
    expect(code(() => r.decideOrder(o, { version: 99, decisions, labNote: '', team: 'matin', actor: owner, now, newId }))).toBe('stale_version')
    r.decideOrder(o, { version: o.version, decisions, labNote: 'Chantilly first', team: 'matin', actor: owner, now, newId })
    expect(o.status).toBe('validated')
    expect(o.lines.map((l) => [l.decision, l.approved])).toEqual([['reduced', 100], ['accepted', 2], ['refused', 0]])
    expect(o.notes).toHaveLength(1)
    expect(o.team).toBe('matin')
  })

  it('refuses the order when every line is refused, and requires a reason', () => {
    const o = make()
    r.startReview(o, { actor: owner, now, newId })
    const noReason = o.lines.map((l) => ({ lineId: l.id, decision: 'refused' as const, approved: 0, refusalReason: '', note: null }))
    expect(code(() => r.decideOrder(o, { version: o.version, decisions: noReason, labNote: '', team: 'matin', actor: owner, now, newId }))).toBe('reason_required')
    const all = noReason.map((d) => ({ ...d, refusalReason: 'Rupture' }))
    r.decideOrder(o, { version: o.version, decisions: all, labNote: '', team: 'matin', actor: owner, now, newId })
    expect(o.status).toBe('refused')
  })

  it('never lets a reviewer raise a quantity above the request', () => {
    const o = make()
    r.startReview(o, { actor: owner, now, newId })
    const d = acceptAll(o)
    d[0] = { ...d[0]!, decision: 'reduced', approved: 200 }
    expect(code(() => r.decideOrder(o, { version: o.version, decisions: d, labNote: '', team: 'matin', actor: owner, now, newId }))).toBe('invalid_quantity')
  })
})

describe('shop edit during review', () => {
  it('keeps unchanged decisions, flags changed lines and invalidates the reviewer version', () => {
    const o = make()
    r.startReview(o, { actor: owner, now, newId })
    const v = o.version
    r.updatePending(o, {
      version: v,
      lines: [
        { productId: 'cornet', packId: null, qty: 150 },
        { productId: 'chantilly', packId: '10l', qty: 3 },
      ],
      shopNote: '',
      catalog,
      actor: shopActor,
      now,
      newId,
    })
    expect(o.editedDuringReview).toBe(true)
    expect(o.lines.map((l) => l.changedByShop)).toEqual([false, true])
    expect(code(() => r.decideOrder(o, { version: v, decisions: acceptAll(o), labNote: '', team: 'matin', actor: owner, now, newId }))).toBe('stale_version')
  })

  it('stops shop edits and deletes once sent to the labo', () => {
    const o = make()
    r.startReview(o, { actor: owner, now, newId })
    r.decideOrder(o, { version: o.version, decisions: acceptAll(o), labNote: '', team: 'matin', actor: owner, now, newId })
    expect(code(() => r.cancelOrder(o, { version: o.version, actor: shopActor, now, newId }))).toBe('invalid_state')
  })
})

describe('labo', () => {
  const validated = () => {
    const o = make()
    r.startReview(o, { actor: owner, now, newId })
    r.decideOrder(o, { version: o.version, decisions: acceptAll(o), labNote: '', team: 'nuit', actor: owner, now, newId })
    return o
  }

  it('starts preparation on the first tick, is idempotent, and closes only when every line is resolved', () => {
    const o = validated()
    const [a, b, c] = o.lines
    const prep = (lineId: string, p: 'done' | 'partial' | 'not_done', q: number | null = null, reason: string | null = null) =>
      r.setLinePrep(o, { lineId, prep: p, preparedQty: q, reason, team: 'nuit', actor: labo, now, newId })
    prep(a!.id, 'done')
    expect(o.status).toBe('in_preparation')
    const events = o.events.length
    prep(a!.id, 'done')
    expect(o.events.length).toBe(events) // idempotent replay
    expect(code(() => r.closeOrder(o, { version: o.version, team: 'nuit', actor: labo, now, newId }))).toBe('invalid_state')
    expect(code(() => prep(b!.id, 'partial', 1))).toBe('reason_required')
    expect(code(() => prep(c!.id, 'partial', 500, 'Rupture'))).toBe('invalid_quantity') // must be < approved
    prep(b!.id, 'partial', 1, 'Rupture')
    prep(c!.id, 'not_done', null, 'Panne')
    r.closeOrder(o, { version: o.version, team: 'nuit', actor: labo, now, newId })
    expect(o.status).toBe('ready')
    expect(o.lines.every((l) => l.prepTeam === 'nuit')).toBe(true)
  })

  it('accepts owner notes after validation but never quantity changes', () => {
    const o = validated()
    r.addNote(o, { lineId: o.lines[0]!.id, body: 'Bien froid', actor: owner, now, newId })
    expect(o.notes).toHaveLength(1)
    expect(code(() => r.addNote(o, { lineId: null, body: 'x'.repeat(161), actor: owner, now, newId }))).toBe('text_too_long')
    expect(code(() => r.addNote(o, { lineId: null, body: 'Hi', actor: labo, now, newId }))).toBe('forbidden')
  })
})
