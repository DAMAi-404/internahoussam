import clsx from 'clsx'
import { useState, type ReactNode } from 'react'

export function StatTile({ value, label, tone }: { value: ReactNode; label: string; tone?: 'warn' }) {
  return (
    <div className="flex flex-col gap-1 rounded-group bg-card px-4 py-3.5">
      <span className={clsx('num text-title font-semibold leading-none', tone === 'warn' ? 'text-[var(--st-waiting-fg)]' : 'text-ink')}>{value}</span>
      <span className="text-meta text-muted">{label}</span>
    </div>
  )
}

/** Per-day bars. Crisp at any width (flex bars, not a scaled SVG). Tap a bar to see its value. */
export function BarChart({
  data,
  highlight,
  formatLabel,
  ariaLabel,
}: {
  data: { key: string; value: number; label: string }[]
  highlight?: string
  formatLabel?: (key: string) => string
  ariaLabel: string
}) {
  const [sel, setSel] = useState<string | null>(null)
  const max = Math.max(1, ...data.map((d) => d.value))
  const every = data.length > 14 ? 5 : data.length > 7 ? 2 : 1
  const selected = data.find((d) => d.key === sel)
  return (
    <figure className="rounded-group bg-card px-3 pb-3 pt-4" aria-label={ariaLabel}>
      <div className="num mb-2 h-5 px-1 text-meta font-semibold text-ink">{selected ? `${selected.label} · ${selected.value}` : ''}</div>
      <div className="flex h-36 items-end gap-[3px]" dir="ltr">
        {data.map((d) => (
          <button
            key={d.key}
            type="button"
            aria-label={`${d.label}: ${d.value}`}
            onClick={() => setSel(sel === d.key ? null : d.key)}
            className="group flex h-full flex-1 items-end"
          >
            <span
              className={clsx('w-full rounded-t-[5px] transition-colors', d.key === sel || d.key === highlight ? 'bg-sage-deep' : 'bg-sage-mid/55 group-hover:bg-sage-mid')}
              style={{ height: `${Math.max(d.value ? 6 : 2, (d.value / max) * 100)}%` }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex gap-[3px] text-[10px] text-muted" dir="ltr" aria-hidden>
        {data.map((d, i) => (
          <span key={d.key} className="num flex-1 text-center">
            {i % every === 0 ? (formatLabel ? formatLabel(d.key) : d.label) : ''}
          </span>
        ))}
      </div>
    </figure>
  )
}

/** Ranked rows with a proportional bar (top products, shops). */
export function RankList({ rows }: { rows: { key: string; name: string; value: ReactNode; amount: number; sub?: string; onClick?: () => void }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.amount))
  return (
    <div className="divide-y divide-line overflow-hidden rounded-group bg-card">
      {rows.map((r) => (
        <button key={r.key} type="button" onClick={r.onClick} disabled={!r.onClick} className="flex w-full flex-col gap-1.5 px-4 py-3 text-start">
          <span className="flex w-full items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-body font-medium text-ink">{r.name}</span>
            <span className="shrink-0 text-body font-semibold text-ink">{r.value}</span>
          </span>
          <span className="flex w-full items-center gap-2">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper">
              <span className="block h-full rounded-full bg-sage-mid" style={{ width: `${(r.amount / max) * 100}%` }} />
            </span>
            {r.sub && <span className="num shrink-0 text-meta text-muted">{r.sub}</span>}
          </span>
        </button>
      ))}
    </div>
  )
}
