import { describe, expect, it } from 'vitest'
import { seedDb } from '@/backend/demo'
import { SHOPS } from '@/backend/seed'
import { computeStats, eachDate } from './stats'

const db = seedDb(new Date('2026-11-26T12:00:00+01:00'))

describe('computeStats', () => {
  it('fills every day of the range, even empty ones', () => {
    const r = computeStats(db.orders, { from: '2026-11-01', to: '2026-11-30' }, SHOPS)
    expect(r.perDay).toHaveLength(30)
    expect(eachDate('2026-11-29', '2026-12-02')).toEqual(['2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02'])
  })

  it('counts orders consistently with the per-day series and per-shop rows', () => {
    const r = computeStats(db.orders, { from: '2026-11-06', to: '2026-11-26' }, SHOPS)
    const daySum = r.perDay.reduce((s, d) => s + d.orders, 0)
    const shopSum = r.shops.reduce((s, x) => s + x.orders, 0)
    expect(daySum).toBe(r.tiles.orders)
    expect(shopSum).toBe(r.tiles.orders)
    expect(r.tiles.refusedLines).toBeLessThanOrEqual(r.tiles.lines)
  })

  it('filters by shop and product, and sums quantities as integers in base units', () => {
    const r = computeStats(db.orders, { from: '2026-11-01', to: '2026-11-30', shopId: 'kouba', productId: 'cornet' }, SHOPS)
    expect(r.shops.every((s) => s.shopId === 'kouba')).toBe(true)
    expect(r.products.every((p) => p.productId === 'cornet' && Number.isInteger(p.quantity))).toBe(true)
  })
})
