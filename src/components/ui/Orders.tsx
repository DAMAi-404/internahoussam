import clsx from 'clsx'
import { Ban, Check, ChevronDown, Clock, Minus, Pencil, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { OrderLine } from '@/domain/types'
import { formatClock } from '@/lib/time'

/** Grouped list section: urgent sections first, history collapsible (DESIGN_SYSTEM §5). */
export function Section({
  title,
  count,
  children,
  collapsible,
  defaultOpen = true,
  accent,
}: {
  title: string
  count?: number
  children: ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
  accent?: 'ready' | 'new'
}) {
  const [open, setOpen] = useState(defaultOpen)
  const head = (
    <span className="flex items-center gap-2 text-meta font-semibold uppercase tracking-wide text-fg-muted">
      {accent && <span className={clsx('size-2 rounded-full', accent === 'ready' ? 'bg-sage-deep' : 'animate-pulse bg-wood')} />}
      {title}
      {count != null && <span className="num rounded-full bg-[color-mix(in_srgb,var(--surface-text)_10%,transparent)] px-1.5 text-[12px]">{count}</span>}
    </span>
  )
  return (
    <section className="flex flex-col gap-2.5">
      {collapsible ? (
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex items-center justify-between px-1 py-1">
          {head}
          <ChevronDown size={18} className={clsx('text-fg-muted transition-transform', open && 'rotate-180')} />
        </button>
      ) : (
        <div className="px-1">{head}</div>
      )}
      {open && <div className="flex flex-col gap-2.5">{children}</div>}
    </section>
  )
}

/** Same-size card shell for orders (shop, owner, labo). */
export function Card({ children, onClick, highlight, className }: { children: ReactNode; onClick?: () => void; highlight?: 'ready' | 'new' | 'edited'; className?: string }) {
  const ring =
    highlight === 'ready'
      ? 'shadow-[0_0_0_2px_var(--sage-deep)]'
      : highlight === 'new'
        ? 'shadow-[0_0_0_2.5px_var(--wood)]'
        : highlight === 'edited'
          ? 'shadow-[0_0_0_2px_var(--sage)]'
          : ''
  const cls = clsx('animate-rise relative flex w-full flex-col gap-2.5 rounded-group bg-card p-4 text-start text-fg', ring, className)
  return onClick ? (
    <div role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick())} className={clsx(cls, 'press cursor-pointer')}>
      {children}
    </div>
  ) : (
    <div className={cls}>{children}</div>
  )
}

export function Progress({ done, total, tone = 'preparing' }: { done: number; total: number; tone?: 'preparing' | 'ok' }) {
  const pct = total ? Math.round((done / total) * 100) : 0
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--surface-text)_10%,transparent)]" role="progressbar" aria-valuenow={done} aria-valuemax={total}>
      <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${pct}%`, background: tone === 'ok' || pct === 100 ? 'var(--sage)' : 'var(--st-preparing-dot)' }} />
    </div>
  )
}

/** 4-step progress: Envoyée → Acceptée → Préparation → Prête (PRD TRK-4). */
export function Steps({ times, current }: { times: (string | undefined)[]; current: number }) {
  const { t, i18n } = useTranslation()
  const labels = [t('steps.sent'), t('steps.accepted'), t('steps.preparing'), t('steps.ready')]
  return (
    <ol className="flex items-start px-1 py-3">
      {labels.map((label, i) => {
        const on = i <= current
        return (
          <li key={label} className={clsx('relative flex flex-1 flex-col items-center gap-1.5 text-center text-[12px]', on ? 'font-medium text-fg' : 'text-fg-muted')}>
            {i > 0 && <span className={clsx('absolute top-[8px] end-1/2 h-0.5 w-full', i <= current ? 'bg-sage-mid' : 'bg-paper-deep')} aria-hidden />}
            <span
              className={clsx(
                'relative z-10 size-[18px] rounded-full border-[3px] border-card',
                on ? 'bg-sage-mid' : 'bg-paper-deep',
                i === current && 'bg-sage-deep shadow-[0_0_0_4px_color-mix(in_srgb,var(--sage)_35%,transparent)]',
              )}
            />
            <span>{label}</span>
            <span className="num text-[11px] opacity-75">{times[i] ? formatClock(times[i], i18n.language) : ''}</span>
          </li>
        )
      })}
    </ol>
  )
}

/** State icon before each line (DESIGN_SYSTEM §2.3). */
export function LineStateIcon({ line, size = 30 }: { line: Pick<OrderLine, 'decision' | 'prep'>; size?: number }) {
  const { t } = useTranslation()
  const s = Math.round(size * 0.53)
  const [bg, fg, icon, label] =
    line.decision === 'refused'
      ? ['var(--st-refused-bg)', 'var(--st-refused-fg)', <X key="i" size={s} strokeWidth={2.6} />, t('line.refused')]
      : line.prep === 'done'
        ? ['var(--sage-deep)', 'var(--cream)', <Check key="i" size={s} strokeWidth={2.8} />, t('line.done')]
        : line.prep === 'partial'
          ? ['var(--st-waiting-bg)', 'var(--st-waiting-fg)', <Minus key="i" size={s} strokeWidth={2.8} />, t('line.partial')]
          : line.prep === 'not_done'
            ? ['var(--st-refused-bg)', 'var(--st-refused-fg)', <Ban key="i" size={s} />, t('line.notDone')]
            : line.decision === 'reduced'
              ? ['var(--st-waiting-bg)', 'var(--st-waiting-fg)', <Pencil key="i" size={s - 2} />, t('line.reduced')]
              : ['color-mix(in srgb, var(--surface-text) 9%, transparent)', 'var(--surface-muted)', <Clock key="i" size={s} />, t('line.waiting')]
  return (
    <span role="img" aria-label={label} className="grid shrink-0 place-items-center rounded-full" style={{ width: size, height: size, background: bg, color: fg }}>
      {icon}
    </span>
  )
}

/** One line in a list: state · name (+ sub) · quantity · trailing icons. Never overflows. */
export function LineRow({ lead, name, sub, qty, trailing, struck, tint }: { lead?: ReactNode; name: string; sub?: ReactNode; qty?: ReactNode; trailing?: ReactNode; struck?: boolean; tint?: 'refused' | 'changed' }) {
  return (
    <div
      className={clsx(
        'flex min-h-[60px] items-center gap-3 px-4 py-2.5',
        tint === 'refused' && 'bg-[color-mix(in_srgb,var(--st-refused-bg)_55%,var(--surface-card))]',
        tint === 'changed' && 'bg-[color-mix(in_srgb,var(--sage)_14%,var(--surface-card))]',
      )}
    >
      {lead}
      <div className="min-w-0 flex-1">
        <div className={clsx('truncate text-body font-medium', struck && 'text-fg-muted line-through')}>{name}</div>
        {sub && <div className="user-text text-meta">{sub}</div>}
      </div>
      {qty && <div className="flex shrink-0 flex-col items-end text-body font-semibold">{qty}</div>}
      {trailing && <div className="flex shrink-0 items-center gap-1.5">{trailing}</div>}
    </div>
  )
}

export function Group({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('divide-y divide-[var(--surface-line)] overflow-hidden rounded-group bg-card text-fg', className)}>{children}</div>
}
