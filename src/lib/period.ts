/** Statistics periods on business dates (YYYY-MM-DD). Pure UTC date maths: no time zones involved. */
export type PeriodKind = 'day' | 'week' | 'month'

export interface Period {
  kind: PeriodKind
  from: string
  to: string
  anchor: string
}

const parse = (d: string) => new Date(`${d}T12:00:00Z`)
const fmt = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (d: string, n: number) => {
  const x = parse(d)
  x.setUTCDate(x.getUTCDate() + n)
  return fmt(x)
}

export function periodOf(kind: PeriodKind, anchor: string): Period {
  if (kind === 'day') return { kind, from: anchor, to: anchor, anchor }
  if (kind === 'week') {
    const dow = (parse(anchor).getUTCDay() + 6) % 7 // Monday = 0
    const from = addDays(anchor, -dow)
    return { kind, from, to: addDays(from, 6), anchor }
  }
  const a = parse(anchor)
  const from = fmt(new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), 1, 12)))
  const to = fmt(new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + 1, 0, 12)))
  return { kind, from, to, anchor }
}

export function shiftPeriod(p: Period, dir: 1 | -1): Period {
  if (p.kind === 'day') return periodOf('day', addDays(p.anchor, dir))
  if (p.kind === 'week') return periodOf('week', addDays(p.anchor, 7 * dir))
  const a = parse(p.from)
  return periodOf('month', fmt(new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + dir, 1, 12))))
}

/** ISO 8601 week number. */
export function isoWeek(d: string): number {
  const date = parse(d)
  const day = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - day + 3)
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4, 12))
  return 1 + Math.round(((date.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7)
}

export const isFuture = (p: Period, today: string) => p.from > today
