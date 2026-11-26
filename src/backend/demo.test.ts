import { describe, expect, it } from 'vitest'
import { createDemoBackend, memoryKV, seedDb } from './demo'
import { Outbox, memoryStorage } from '@/lib/outbox'
import { DomainError } from '@/domain/errors'
import type { Backend } from './types'

/** Several "devices" sharing one data store, each with its own session. */
function devices() {
  const store = memoryKV()
  const now = () => new Date('2026-11-26T09:00:00+01:00')
  const make = () => createDemoBackend({ store, sessionStore: memoryKV(), now, latencyMs: 0 })
  return { shop: make(), owner: make(), labo: make(), otherShop: make() }
}

async function signIn(d: ReturnType<typeof devices>) {
  await d.shop.signInShop('madania', '123456')
  await d.otherShop.signInShop('kouba', '123456')
  await d.owner.signInDemo!('owner')
  await d.labo.signInDemo!('labo')
}

const err = async (p: Promise<unknown>) => {
  try {
    await p
    return 'ok'
  } catch (e) {
    return (e as DomainError).code
  }
}

describe('demo backend: full flow across devices', () => {
  it('shop → owner → labo → shop, with scoping, notifications and idempotency', async () => {
    const d = devices()
    await signIn(d)
    const input = { id: 'order-1', lines: [{ productId: 'cornet', packId: null, qty: 100 }, { productId: 'pistache', packId: null, qty: 500 }], shopNote: 'Vite' }
    const o = await d.shop.submitOrder(input)
    const again = await d.shop.submitOrder(input) // retry after a lost response
    expect(again.id).toBe(o.id)
    expect((await d.shop.listOrders()).filter((x) => x.id === 'order-1')).toHaveLength(1)

    // other shops never see it
    expect((await d.otherShop.listOrders()).some((x) => x.id === 'order-1')).toBe(false)
    expect((await d.owner.listNotifications()).some((n) => n.orderId === 'order-1' && n.type === 'order_submitted')).toBe(true)

    const reviewing = await d.owner.startReview('order-1')
    const decisions = reviewing.lines.map((l, i) =>
      i === 1
        ? { lineId: l.id, decision: 'refused' as const, approved: 0, refusalReason: 'Rupture', note: null }
        : { lineId: l.id, decision: 'accepted' as const, approved: l.requested, refusalReason: null, note: 'Bien froid' },
    )
    await d.owner.decideOrder('order-1', reviewing.version, decisions, '', 'matin')

    // labo never sees refused lines nor the shop's note
    const forLabo = (await d.labo.listOrders()).find((x) => x.id === 'order-1')!
    expect(forLabo.lines).toHaveLength(1)
    expect(forLabo.shopNote).toBe('')
    expect(forLabo.notes.map((n) => n.body)).toEqual(['Bien froid'])
    expect((await d.shop.listNotifications()).some((n) => n.orderId === 'order-1' && n.type === 'order_validated_changed')).toBe(true)

    // the shop can no longer edit or delete
    const shopView = (await d.shop.listOrders()).find((x) => x.id === 'order-1')!
    expect(await err(d.shop.cancelOrder('order-1', shopView.version))).toBe('invalid_state')

    const prepped = await d.labo.setLinePrep('order-1', forLabo.lines[0]!.id, 'done', null, null)
    expect(prepped.status).toBe('in_preparation')
    const ready = await d.labo.closeOrder('order-1', prepped.version)
    expect(ready.status).toBe('ready')
    expect((await d.shop.listNotifications()).some((n) => n.orderId === 'order-1' && n.type === 'order_ready')).toBe(true)

    const received = await d.shop.confirmReceived('order-1')
    expect(received.status).toBe('received')
    expect(received.events.map((e) => e.type)).toEqual([
      'submitted',
      'review_started',
      'validated',
      'prep_started',
      'line_prepped',
      'ready',
      'received',
    ])
    expect(received.events.find((e) => e.type === 'ready')?.actor.team).toBeTruthy()
  })
})

describe('demo backend: permissions', () => {
  it('blocks roles from actions they do not own', async () => {
    const d = devices()
    await signIn(d)
    expect(await err(d.owner.submitOrder({ id: 'x', lines: [{ productId: 'cornet', packId: null, qty: 10 }], shopNote: '' }))).toBe('forbidden')
    expect(await err(d.shop.saveProduct(seedDb().catalog.products[0]!))).toBe('forbidden')
    expect(await err(d.labo.switchTeam('nuit', '0000'))).toBe('wrong_pin')
    expect(await err(d.shop.signInShop('kouba', '000000'))).toBe('wrong_pin')
  })
})

describe('outbox', () => {
  it('keeps an order when the network fails and sends it exactly once later', async () => {
    const d = devices()
    await signIn(d)
    let online = false
    const flaky: Backend = {
      ...d.shop,
      submitOrder: (input) => (online ? d.shop.submitOrder(input) : Promise.reject(new TypeError('Failed to fetch'))),
    }
    const box = new Outbox(flaky, memoryStorage())
    const action = { kind: 'submit' as const, orderId: 'offline-1', lines: [{ productId: 'cornet', packId: null, qty: 10 }], shopNote: '' }
    expect(await box.run(action)).toBe('queued')
    expect(await box.items()).toHaveLength(1)
    online = true
    await box.flush()
    await box.flush()
    expect(await box.items()).toHaveLength(0)
    expect((await d.shop.listOrders()).filter((o) => o.id === 'offline-1')).toHaveLength(1)
  })

  it('surfaces business refusals instead of retrying forever', async () => {
    const d = devices()
    await signIn(d)
    const box = new Outbox(d.shop, memoryStorage())
    await expect(box.run({ kind: 'submit', orderId: 'bad', lines: [{ productId: 'sorbet-citron', packId: '5l', qty: 1 }], shopNote: '' })).rejects.toBeInstanceOf(DomainError)
    expect(await box.items()).toHaveLength(0)
  })
})

describe('seed', () => {
  it('produces consistent history and live orders in every state', () => {
    const db = seedDb(new Date('2026-11-26T12:00:00+01:00'))
    const statuses = new Set(db.orders.map((o) => o.status))
    for (const s of ['submitted', 'validated', 'in_preparation', 'ready', 'received']) expect(statuses.has(s as never)).toBe(true)
    expect(db.orders.length).toBeGreaterThan(80)
    expect(db.notifications.length).toBeGreaterThan(0)
  })
})
