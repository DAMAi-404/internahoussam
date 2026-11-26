import clsx from 'clsx'
import { MessageSquare } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { LIMITS, isNearLimit, textLength, type LimitKey } from '@/lib/limits'
import { formatClock } from '@/lib/time'
import { Button } from './Button'
import { Sheet } from './Sheet'

export interface BubbleNote {
  id: string
  author: string
  at: string
  body: string
}

/**
 * Note icon: rendered only when notes exist (PRD NOTE-2). Tap → floating bubble card anchored to the icon.
 * Text wraps on any character, so nothing can overflow.
 */
export function NoteIcon({ notes, unread, size = 36 }: { notes: BubbleNote[]; unread?: boolean; size?: number }) {
  const { t } = useTranslation()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  if (notes.length === 0) return null
  return (
    <>
      <button
        type="button"
        aria-label={t('note.open', { count: notes.length })}
        aria-expanded={anchor !== null}
        onClick={(e) => {
          e.stopPropagation()
          const el = e.currentTarget
          setAnchor((a) => (a ? null : el))
        }}
        className={clsx(
          'press relative grid shrink-0 place-items-center rounded-full',
          unread ? 'bg-[var(--st-waiting-bg)] text-[var(--st-waiting-fg)]' : 'bg-[color-mix(in_srgb,var(--surface-text)_8%,transparent)] text-fg-muted',
        )}
        style={{ width: size, height: size }}
      >
        <MessageSquare size={Math.round(size * 0.47)} />
        {unread && <span className="absolute end-0.5 top-0.5 size-2.5 rounded-full border-2 border-cream bg-wood" />}
      </button>
      {anchor && <NoteBubble anchor={anchor} notes={notes} onClose={() => setAnchor(null)} />}
    </>
  )
}

function NoteBubble({ anchor, notes, onClose }: { anchor: HTMLElement; notes: BubbleNote[]; onClose: () => void }) {
  const { i18n } = useTranslation()
  const card = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; below: boolean; tail: number } | null>(null)

  useLayoutEffect(() => {
    const a = anchor.getBoundingClientRect()
    const width = Math.min(280, window.innerWidth - 24)
    const h = card.current?.offsetHeight ?? 120
    const below = a.bottom + h + 16 < window.innerHeight || a.top < h + 16
    const left = Math.max(12, Math.min(window.innerWidth - width - 12, a.left + a.width / 2 - width / 2))
    setPos({ top: below ? a.bottom + 10 : a.top - h - 10, left, below, tail: a.left + a.width / 2 - left })
  }, [anchor])

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!card.current?.contains(e.target as Node) && !anchor.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const onScroll = () => onClose()
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [anchor, onClose])

  return createPortal(
    <div
      ref={card}
      role="dialog"
      dir={document.documentElement.dir}
      className="surface-light animate-bubble fixed z-[60] w-[min(280px,calc(100vw-24px))] rounded-2xl p-3.5 shadow-[0_14px_40px_rgb(15_33_23/.28)]"
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? 0, transformOrigin: pos?.below ? 'top' : 'bottom' }}
    >
      {pos && (
        <span
          aria-hidden
          className={clsx('absolute size-3 rotate-45 bg-cream', pos.below ? '-top-1.5' : '-bottom-1.5')}
          style={{ left: Math.max(14, Math.min(266, pos.tail - 6)) }}
        />
      )}
      <div className="relative flex max-h-[50vh] flex-col gap-3 overflow-y-auto">
        {notes.map((n) => (
          <div key={n.id} className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-meta text-muted">
              <span className="font-semibold text-ink">{n.author}</span>
              <span className="num">{formatClock(n.at, i18n.language)}</span>
            </div>
            <p dir="auto" className="user-text text-start text-[15px] leading-snug text-ink">{n.body}</p>
          </div>
        ))}
      </div>
    </div>,
    document.body,
  )
}

/** Text input with a hard limit and a live counter (PRD NOTE-1). */
export function CountedText({
  value,
  onChange,
  limit,
  placeholder,
  label,
  rows = 3,
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  limit: LimitKey
  placeholder?: string
  label: string
  rows?: number
  autoFocus?: boolean
}) {
  const max = LIMITS[limit]
  const len = textLength(value)
  return (
    <label className="flex flex-col gap-1.5">
      <span className="sr-only">{label}</span>
      <textarea
        dir="auto"
        value={value}
        rows={rows}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => onChange(Array.from(e.target.value).slice(0, max).join(''))}
        className="user-text w-full resize-none rounded-xl border border-line bg-paper px-3.5 py-3 text-body text-ink placeholder:text-muted/70 focus:border-sage-deep focus:outline-none"
      />
      <span className={clsx('num self-end text-meta', isNearLimit(value, limit) ? 'font-semibold text-wood' : 'text-muted')}>
        {len}/{max}
      </span>
    </label>
  )
}

/** Sheet to write one note (owner → labo, shop → owner). The form remounts on each open. */
export function NoteSheet({
  open,
  onClose,
  title,
  initial = '',
  limit,
  onSave,
  saving,
  extra,
}: {
  open: boolean
  onClose: () => void
  title: string
  initial?: string
  limit: LimitKey
  onSave: (text: string) => void
  saving?: boolean
  extra?: ReactNode
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {extra}
      {open && <NoteForm initial={initial} limit={limit} title={title} onSave={onSave} saving={saving} />}
    </Sheet>
  )
}

function NoteForm({ initial, limit, title, onSave, saving }: { initial: string; limit: LimitKey; title: string; onSave: (t: string) => void; saving?: boolean }) {
  const { t } = useTranslation()
  const [text, setText] = useState(initial)
  return (
    <div className="flex flex-col gap-3">
      <CountedText value={text} onChange={setText} limit={limit} label={title} placeholder={t('note.placeholder')} autoFocus />
      <Button className="w-full" loading={saving} onClick={() => onSave(text.trim())}>
        {t('action.save')}
      </Button>
    </div>
  )
}
