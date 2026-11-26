import clsx from 'clsx'
import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CountBadge, IconButton } from './Button'

interface HeaderProps {
  eyebrow?: ReactNode
  title: ReactNode
  onBack?: () => void
  actions?: ReactNode
  children?: ReactNode // filter chips, segmented controls…
  compact?: boolean
}

/** Ink header (team-themed in the labo through --header-bg / --header-fg). */
export function Header({ eyebrow, title, onBack, actions, children, compact }: HeaderProps) {
  const { t } = useTranslation()
  return (
    <header className="safe-top shrink-0 bg-[var(--header-bg)] text-[var(--header-fg)]">
      <div className={clsx('flex flex-col gap-3 px-4', compact ? 'pb-3 pt-3' : 'pb-3.5 pt-4')}>
        <div className="flex min-h-11 items-center gap-2.5">
          {onBack && (
            <IconButton label={t('action.back')} tone="onDark" onClick={onBack}>
              <ChevronLeft className="flip-rtl" size={22} />
            </IconButton>
          )}
          <div className="min-w-0 flex-1">
            {eyebrow && <div className="truncate text-meta font-medium text-[color-mix(in_srgb,var(--sage-soft)_85%,var(--header-fg))]">{eyebrow}</div>}
            <h1 className={clsx('truncate font-semibold tracking-tight', onBack ? 'text-title-sm' : 'text-title')}>{title}</h1>
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
        {children}
      </div>
    </header>
  )
}

export interface ChipItem {
  id: string
  label: string
  count?: number
}

/** Horizontal filter chips (DESIGN_SYSTEM §6). `tone="dark"` inside the ink header. */
export function FilterChips({
  items,
  value,
  onChange,
  tone = 'dark',
  label,
}: {
  items: ChipItem[]
  value: string
  onChange: (id: string) => void
  tone?: 'dark' | 'light'
  label: string
}) {
  return (
    <div role="tablist" aria-label={label} className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4">
      {items.map((it) => {
        const on = it.id === value
        return (
          <button
            key={it.id}
            role="tab"
            type="button"
            aria-selected={on}
            onClick={() => onChange(it.id)}
            className={clsx(
              'press flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[14px] font-medium transition-colors',
              on
                ? 'bg-sage text-ink'
                : tone === 'dark'
                  ? 'bg-[color-mix(in_srgb,var(--header-fg)_10%,transparent)] text-[var(--header-fg)]'
                  : 'bg-paper text-fg',
            )}
          >
            {it.label}
            {it.count != null && it.count > 0 && (
              <span className={clsx('num rounded-full px-1.5 text-[12px] font-semibold', on ? 'bg-ink/15' : 'bg-[color-mix(in_srgb,currentColor_15%,transparent)]')}>
                {it.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export interface TabItem {
  id: string
  label: string
  icon: ReactNode
  badge?: number
  badgeTone?: 'alert' | 'ok'
}

export function TabBar({ items, value, onChange }: { items: TabItem[]; value: string; onChange: (id: string) => void }) {
  return (
    <nav className="safe-bottom shrink-0 border-t border-line bg-cream">
      <div className="flex">
        {items.map((it) => {
          const on = it.id === value
          return (
            <button
              key={it.id}
              type="button"
              aria-current={on ? 'page' : undefined}
              onClick={() => onChange(it.id)}
              className={clsx('relative flex h-[60px] flex-1 flex-col items-center justify-center gap-1 text-tab font-medium', on ? 'text-sage-deep' : 'text-muted')}
            >
              {on && <span className="absolute top-0 h-[3px] w-7 rounded-b-full bg-sage-deep" />}
              <span className="relative">
                {it.icon}
                {it.badge != null && it.badge > 0 && <CountBadge n={it.badge} tone={it.badgeTone} className="absolute -top-1.5 start-[calc(100%-6px)]" />}
              </span>
              {it.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
