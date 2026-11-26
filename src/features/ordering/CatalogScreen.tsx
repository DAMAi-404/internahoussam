import { ChevronRight, PackageSearch, Pencil, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useCatalog, useOrders, useSession, useShopName } from '@/app/backend'
import { EmptyState, ErrorState, FilterChips, Header, IconButton, ProductCard, Screen, SkeletonGrid } from '@/components/ui'
import type { Product } from '@/domain/types'
import { NotificationBell } from '@/features/notifications/NotificationBell'
import { SettingsButton } from '@/features/auth/SettingsSheet'
import { loc } from '@/lib/format'
import { formatQuantity } from '@/lib/quantity'
import { ProductSheet } from './ProductSheet'
import { useCart, type CartLine } from './cart'

const USUAL_DAYS = 30

function badgeFor(p: Product, lines: CartLine[], packsLabel: (n: number) => string): string | null {
  const mine = lines.filter((l) => l.productId === p.id)
  const first = mine[0]
  if (!first) return null
  if (p.mode !== 'pack') return formatQuantity(p.mode, first.qty)
  if (mine.length === 1) return formatQuantity('pack', first.qty, p.packs.find((k) => k.id === first.packId)?.label)
  return packsLabel(mine.reduce((s, l) => s + l.qty, 0))
}

/** Shop catalogue (PRD SHP-2…5): filter chips, search, uniform cards, floating cart bar. */
export function CatalogScreen() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const session = useSession().data
  const shopName = useShopName()
  const catalog = useCatalog()
  const orders = useOrders().data
  const lines = useCart((s) => s.lines)
  const editing = useCart((s) => s.editing)
  const clear = useCart((s) => s.clear)
  const [filter, setFilter] = useState('all')
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<Product | null>(null)

  const [since] = useState(() => Date.now() - USUAL_DAYS * 86_400_000)
  const usual = useMemo(() => {
    return new Set((orders ?? []).filter((o) => new Date(o.at.submitted).getTime() > since).flatMap((o) => o.lines.map((l) => l.productId)))
  }, [orders, since])

  const products = useMemo(() => {
    if (!catalog.data) return []
    const catSort = new Map(catalog.data.categories.map((c) => [c.id, c.sort]))
    const visibleCats = new Set(catalog.data.categories.filter((c) => c.active).map((c) => c.id))
    const q = query.trim().toLowerCase()
    return catalog.data.products
      .filter((p) => visibleCats.has(p.categoryId))
      .filter((p) => (filter === 'all' ? true : filter === 'usual' ? usual.has(p.id) : p.categoryId === filter))
      .filter((p) => !q || `${p.name.fr} ${p.name.ar}`.toLowerCase().includes(q))
      .sort((a, b) => Number(b.active) - Number(a.active) || (catSort.get(a.categoryId) ?? 0) - (catSort.get(b.categoryId) ?? 0) || a.sort - b.sort)
  }, [catalog.data, filter, query, usual])

  const chips = useMemo(
    () => [
      { id: 'all', label: t('catalog.all') },
      ...(usual.size ? [{ id: 'usual', label: t('catalog.usual') }] : []),
      ...(catalog.data?.categories.filter((c) => c.active && catalog.data.products.some((p) => p.categoryId === c.id)).map((c) => ({ id: c.id, label: loc(c.name, i18n.language) })) ?? []),
    ],
    [catalog.data, usual.size, t, i18n.language],
  )

  return (
    <Screen
      header={
        <Header
          eyebrow={session?.shopId ? shopName(session.shopId) : undefined}
          title={t('catalog.title')}
          actions={
            <>
              <IconButton label={t('action.search')} tone={searching ? 'active' : 'onDark'} onClick={() => (setSearching(!searching), setQuery(''))}>
                {searching ? <X size={20} /> : <Search size={20} />}
              </IconButton>
              <NotificationBell />
              <SettingsButton />
            </>
          }
        >
          {searching && (
            <input
              id="catalog-search"
              autoFocus
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('catalog.search')}
              aria-label={t('catalog.search')}
              className="h-11 w-full rounded-xl bg-cream/10 px-3.5 text-body text-cream placeholder:text-cream/60 focus:outline-none"
            />
          )}
          <FilterChips label={t('catalog.title')} items={chips} value={filter} onChange={setFilter} />
        </Header>
      }
    >
      {editing && (
        <div className="flex items-center gap-2.5 bg-sage px-4 py-2.5 text-[15px] font-medium text-ink">
          <Pencil size={17} />
          <span className="num flex-1">{t('cart.editing', { code: editing.code })}</span>
          <IconButton label={t('cart.stopEditing')} size={36} tone="onLight" className="!bg-ink/10 !text-ink" onClick={clear}>
            <X size={17} />
          </IconButton>
        </div>
      )}
      {catalog.isPending ? (
        <SkeletonGrid />
      ) : catalog.isError ? (
        <ErrorState text={t('errors.network')} onRetry={() => void catalog.refetch()} />
      ) : products.length === 0 ? (
        <EmptyState icon={<PackageSearch size={28} />} title={query ? t('catalog.noResult') : t('catalog.empty')} />
      ) : (
        <div className="grid grid-cols-2 gap-3 p-4 pb-28 sm:grid-cols-3">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              name={loc(p.name, i18n.language)}
              nameLocalized={p.name}
              categoryId={p.categoryId}
              photo={p.photo}
              unavailable={!p.active}
              badge={badgeFor(p, lines, (n) => t('catalog.packs', { count: n }))}
              onOpen={() => setOpen(p)}
            />
          ))}
        </div>
      )}

      {lines.length > 0 && (
        <div className="pointer-events-none sticky bottom-0 z-10 px-3 pb-3">
          <button
            type="button"
            onClick={() => navigate('/shop/cart')}
            className="press animate-rise pointer-events-auto flex h-[58px] w-full items-center gap-3 rounded-full bg-ink pe-4 ps-2 text-cream shadow-[0_12px_30px_rgb(15_33_23/.35)]"
          >
            <span key={lines.length} className="num animate-pop grid size-[42px] place-items-center rounded-full bg-sage text-[16px] font-semibold text-ink">
              {lines.length}
            </span>
            <span className="flex-1 text-start text-[16px] font-medium">{editing ? t('cart.editing', { code: editing.code }) : t('cart.title')}</span>
            <ChevronRight size={22} className="flip-rtl" />
          </button>
        </div>
      )}

      <ProductSheet product={open} onClose={() => setOpen(null)} />
    </Screen>
  )
}
