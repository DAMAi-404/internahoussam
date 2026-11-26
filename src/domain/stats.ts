/**
 * Statistics on quantities (PRD §6.9). Pure computation over orders; in Supabase the same shape
 * comes from `stats_range()` reading daily aggregates (kept 13 months).
 */
import type { Order, Shop, StatsQuery, StatsResult } from './types'

const SENT: Order['status'][] = ['validated', 'in_preparation', 'ready', 'received']

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  const hi = s[mid] ?? 0
  return s.length % 2 ? hi : Math.round(((s[mid - 1] ?? hi) + hi) / 2)
}

const minutesBetween = (a?: string, b?: string) =>
  a && b ? Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60_000)) : null

export function eachDate(from: string, to: string): string[] {
  const out: string[] = []
  const d = new Date(`${from}T12:00:00Z`)
  const end = new Date(`${to}T12:00:00Z`)
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

export function computeStats(orders: Order[], q: StatsQuery, shops: Shop[]): StatsResult {
  const inRange = orders.filter(
    (o) =>
      o.businessDate >= q.from &&
      o.businessDate <= q.to &&
      o.status !== 'cancelled' &&
      (!q.shopId || o.shopId === q.shopId),
  )
  const lineMatch = (l: Order['lines'][number]) =>
    (!q.categoryId || l.categoryId === q.categoryId) && (!q.productId || l.productId === q.productId)
  const relevant = inRange.filter((o) => o.lines.some(lineMatch))
  const lines = relevant.flatMap((o) => o.lines.filter(lineMatch).map((l) => ({ o, l })))

  const products = new Map<string, StatsResult['products'][number] & { shopSet: Set<string> }>()
  for (const { o, l } of lines) {
    if (!SENT.includes(o.status) || l.decision === 'refused') continue
    const key = `${l.productId}|${l.packLabel ?? ''}`
    const qty = l.prep === 'partial' && l.preparedQty != null ? l.preparedQty : l.prep === 'not_done' ? 0 : l.approved
    const cur = products.get(key) ?? {
      productId: l.productId,
      name: l.name,
      mode: l.mode,
      packLabel: l.packLabel,
      quantity: 0,
      shops: 0,
      shopSet: new Set<string>(),
    }
    cur.quantity += qty
    cur.shopSet.add(o.shopId)
    cur.shops = cur.shopSet.size
    products.set(key, cur)
  }

  const shopRows = shops
    .map((s) => {
      const os = relevant.filter((o) => o.shopId === s.id)
      const ls = os.flatMap((o) => o.lines.filter(lineMatch))
      return { shopId: s.id, orders: os.length, lines: ls.length, refusedLines: ls.filter((l) => l.decision === 'refused').length }
    })
    .filter((r) => r.orders > 0)
    .sort((a, b) => b.lines - a.lines)

  return {
    tiles: {
      orders: relevant.length,
      lines: lines.length,
      refusedLines: lines.filter(({ l }) => l.decision === 'refused').length,
      problemLines: lines.filter(({ l }) => l.prep === 'partial' || l.prep === 'not_done').length,
      medianReviewMin: median(relevant.map((o) => minutesBetween(o.at.submitted, o.at.validated ?? o.at.refused)).filter((x): x is number => x != null)),
      medianReadyMin: median(relevant.map((o) => minutesBetween(o.at.validated, o.at.ready)).filter((x): x is number => x != null)),
    },
    perDay: eachDate(q.from, q.to).map((date) => ({ date, orders: relevant.filter((o) => o.businessDate === date).length })),
    products: [...products.values()]
      .map(({ shopSet, ...p }) => p)
      .sort((a, b) => b.shops - a.shops || b.quantity - a.quantity),
    shops: shopRows,
  }
}
