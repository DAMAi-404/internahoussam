import clsx from 'clsx'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'tinted' | 'plain' | 'danger' | 'dangerTinted'

const variants: Record<Variant, string> = {
  primary: 'bg-sage-deep text-cream active:bg-ink disabled:bg-paper-deep disabled:text-[#8c8270]',
  tinted: 'bg-[color-mix(in_srgb,var(--sage)_22%,var(--cream))] text-sage-deep disabled:opacity-50',
  plain: 'text-sage-deep disabled:opacity-50',
  danger: 'bg-[#9b2c1f] text-cream disabled:opacity-50',
  dangerTinted: 'bg-[var(--st-refused-bg)] text-[var(--st-refused-fg)] disabled:opacity-50',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'md' | 'lg'
  loading?: boolean
  icon?: ReactNode
}

/** One primary action per screen, at the bottom (DESIGN_SYSTEM §1). */
export function Button({ variant = 'primary', size = 'lg', loading, icon, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={clsx(
        'press relative inline-flex items-center justify-center gap-2 rounded-btn font-semibold transition-colors',
        size === 'lg' ? 'h-[54px] px-6 text-[17px]' : 'h-11 px-4 text-body',
        variants[variant],
        className,
      )}
      {...rest}
    >
      <span className={clsx('inline-flex items-center gap-2', loading && 'invisible')}>
        {icon}
        {children}
      </span>
      {loading && (
        <span className="absolute inset-0 grid place-items-center" aria-hidden>
          <span className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        </span>
      )}
    </button>
  )
}

type IconTone = 'onDark' | 'onLight' | 'active' | 'wood' | 'danger' | 'solid'

const tones: Record<IconTone, string> = {
  onDark: 'bg-[color-mix(in_srgb,var(--header-fg)_12%,transparent)] text-[var(--header-fg)]',
  onLight: 'bg-paper text-muted',
  active: 'bg-sage text-ink',
  wood: 'bg-[var(--st-waiting-bg)] text-[var(--st-waiting-fg)]',
  danger: 'bg-[var(--st-refused-bg)] text-[var(--st-refused-fg)]',
  solid: 'bg-sage-deep text-cream',
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string // required: icon-only buttons always have an accessible name
  tone?: IconTone
  size?: 36 | 40 | 42 | 48
  badge?: number
}

export function IconButton({ label, tone = 'onLight', size = 42, badge, className, children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={clsx('press relative inline-grid shrink-0 place-items-center rounded-full', tones[tone], className)}
      style={{ width: size, height: size }}
      {...rest}
    >
      {children}
      {badge != null && badge > 0 && <CountBadge n={badge} className="absolute -top-1 -end-1" />}
    </button>
  )
}

export function CountBadge({ n, className, tone = 'alert' }: { n: number; className?: string; tone?: 'alert' | 'ok' }) {
  return (
    <span
      className={clsx(
        'num inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-semibold text-white',
        tone === 'alert' ? 'bg-[#c8473b]' : 'bg-sage-deep',
        className,
      )}
    >
      {n > 99 ? '99+' : n}
    </span>
  )
}
