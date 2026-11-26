import { describe, expect, it } from 'vitest'
import { notificationsFor } from './notifications'
import type { Order, OrderEvent } from './types'

const order = (over: Partial<Order> = {}): Order =>
  ({
    id: 'o',
    code: 'KOU-1126-01',
    shopId: 'kouba',
    status: 'submitted',
    lines: [{ decision: 'accepted' }, { decision: 'reduced' }],
    reviewer: null,
    team: 'matin',
    ...over,
  }) as unknown as Order

const ev = (type: OrderEvent['type'], role: OrderEvent['actor']['role'], from: OrderEvent['from'] = null): OrderEvent => ({
  id: 'e',
  type,
  at: '2026-11-26T08:00:00Z',
  actor: { role, name: role },
  from,
  to: null,
})

const who = (xs: ReturnType<typeof notificationsFor>) => xs.map((x) => `${x.recipient}:${x.type}:${x.push ? 'push' : 'badge'}`)

describe('notification matrix (PRD §6.8)', () => {
  it('new order → owner and deputy, pushed', () => {
    expect(who(notificationsFor(ev('submitted', 'shop'), order()))).toEqual(['owner:order_submitted:push', 'deputy:order_submitted:push'])
  })

  it('shop edit during review → push only to the reviewer holding the lock', () => {
    const o = order({ status: 'in_review', reviewer: { role: 'deputy', name: 'A' } })
    expect(who(notificationsFor(ev('shop_edited', 'shop', 'in_review'), o))).toEqual(['owner:order_edited:badge', 'deputy:order_edited:push'])
  })

  it('validated → shop (mentions changes) and labo, never the actor', () => {
    const out = who(notificationsFor(ev('validated', 'owner', 'in_review'), order({ status: 'validated' })))
    expect(out).toEqual(['shop:kouba:order_validated_changed:push', 'labo:order_validated:push'])
  })

  it('ready → owner, deputy and shop; received → owner and deputy', () => {
    expect(who(notificationsFor(ev('ready', 'labo'), order()))).toEqual(['owner:order_ready:push', 'deputy:order_ready:push', 'shop:kouba:order_ready:push'])
    expect(who(notificationsFor(ev('received', 'shop'), order()))).toEqual(['owner:order_received:push', 'deputy:order_received:push'])
  })

  it('preparation and problems are badges only; owner notes reach the labo', () => {
    expect(notificationsFor(ev('prep_started', 'labo'), order()).every((n) => !n.push)).toBe(true)
    expect(notificationsFor(ev('line_problem', 'labo'), order()).every((n) => !n.push)).toBe(true)
    expect(who(notificationsFor(ev('note_added', 'owner'), order()))).toEqual(['labo:note_added:push'])
  })

  it('deputy acting does not notify the deputy', () => {
    expect(who(notificationsFor(ev('received', 'shop'), order())).some((x) => x.startsWith('shop'))).toBe(false)
    const out = who(notificationsFor(ev('prep_started', 'labo'), order()))
    expect(out.some((x) => x.startsWith('labo'))).toBe(false)
  })
})
