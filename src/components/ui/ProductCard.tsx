import clsx from 'clsx'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Localized } from '@/domain/types'

function initials(name: string): string {
  const words = name.replace(/[’']/g, ' ').split(/\s+/).filter(Boolean)
  const main = words.filter((w) => w.length > 2)
  return (main.length ? main : words)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

/** Owner photo, or a calm category-tinted placeholder with initials. */
export function ProductArt({
  photo,
  name,
  categoryId,
  size,
  className,
}: {
  photo: string | null
  name: Localized
  categoryId: string
  size?: number
  className?: string
}) {
  const style = size ? { width: size, height: size, borderRadius: Math.round(size * 0.26) } : undefined
  if (photo) {
    return <img src={photo} alt="" loading="lazy" style={style} className={clsx('aspect-square shrink-0 rounded-2xl object-cover', className)} />
  }
  return (
    <div
      aria-hidden
      style={{ ...style, background: `var(--cat-${categoryId}, var(--paper-deep))` }}
      className={clsx('relative grid aspect-square shrink-0 place-items-center overflow-hidden rounded-2xl', className)}
    >
      <span className="absolute -bottom-[38%] start-[-15%] h-[70%] w-[130%] rounded-[50%] bg-white/30" />
      <span className="absolute -top-[30%] end-[-25%] h-[60%] w-[60%] rounded-full bg-white/20" />
      <span className="relative font-semibold tracking-wide text-ink/45" style={{ fontSize: size ? Math.round(size * 0.34) : 32 }}>
        {initials(name.fr)}
      </span>
    </div>
  )
}

interface ProductCardProps {
  name: string
  nameLocalized: Localized
  categoryId: string
  photo: string | null
  /** Formatted quantity in cart (e.g. "150", "10 L × 3", "2 packs"). Empty = not in cart. */
  badge?: string | null
  unavailable?: boolean
  onOpen: () => void
}

/**
 * Fixed-size product card (PRD SHP-3/4): photo + name. "+" on the photo corner becomes the
 * quantity badge when in the cart. The card never changes size.
 */
export function ProductCard({ name, nameLocalized, categoryId, photo, badge, unavailable, onOpen }: ProductCardProps) {
  const { t } = useTranslation()
  const inCart = Boolean(badge)
  return (
    <div
      className={clsx(
        'relative rounded-card bg-cream p-[7px] transition-shadow duration-200',
        inCart && 'shadow-[0_0_0_2px_var(--sage-deep)]',
        unavailable && 'opacity-[.45]',
      )}
    >
      <button
        type="button"
        disabled={unavailable}
        onClick={onOpen}
        aria-label={unavailable ? `${name} · ${t('catalog.unavailable')}` : name}
        className="block w-full text-start"
      >
        <ProductArt photo={photo} name={nameLocalized} categoryId={categoryId} className="w-full" />
        <span className="line-clamp-2 block h-[52px] px-1.5 pb-1 pt-2 text-card font-medium text-ink">{name}</span>
      </button>
      {unavailable ? (
        <span className="absolute start-3.5 top-3.5 rounded-full bg-cream px-2.5 py-1 text-[12px] font-semibold text-ink">{t('catalog.unavailable')}</span>
      ) : inCart ? (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`${name}: ${badge}`}
          className="press animate-pop absolute bottom-[66px] end-3.5 flex h-[38px] min-w-[38px] items-center justify-center rounded-full bg-ink px-3 text-[14px] font-semibold text-cream shadow-[0_6px_16px_rgb(15_33_23/.3)]"
        >
          <bdi dir="ltr" className="num">
            {badge}
          </bdi>
        </button>
      ) : (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`${t('action.add')} ${name}`}
          className="press absolute bottom-[66px] end-3.5 grid size-[42px] place-items-center rounded-full bg-ink text-cream shadow-[0_6px_16px_rgb(15_33_23/.3)]"
        >
          <Plus size={22} strokeWidth={2.4} />
        </button>
      )}
    </div>
  )
}
