import { useQuery } from '@tanstack/react-query'
import { BarChart3, ChevronLeft, ChevronRight, ClipboardCopy, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useBackend, useCatalog, useOrders, useSession, useShopName, useShops } from '@/app/backend'
import { BarChart, Button, EmptyState, FilterChips, Header, IconButton, Qty, RankList, Screen, Segmented, SkeletonList, StatTile, useToast } from '@/components/ui'
import type { StatsResult } from '@/domain/types'
import { NotificationBell } from '@/features/notifications/NotificationBell'
import { SettingsButton } from '@/features/auth/SettingsSheet'
import { loc, shareOrCopy } from '@/lib/format'
import { isoWeek, periodOf, shiftPeriod, type Period, type PeriodKind } from '@/lib/period'
import { formatQuantity } from '@/lib/quantity'
import { queryKeys } from '@/lib/queryKeys'
import { businessDate } from '@/lib/time'

/** Activité (PRD STA-1…6): quantities only. Owner/deputy see every shop; a shop sees only itself. */
export function StatsScreen() {
  const { t, i18n } = useTranslation()
  const backend = useBackend()
  const session = useSession().data
  const shops = useShops().data ?? []
  const shopName = useShopName()
  const catalog = useCatalog().data
  const today = businessDate()
  const isShop = session?.role === 'shop'
  const [kind, setKind] = useState<PeriodKind>('week')
  const [period, setPeriod] = useState<Period>(() => periodOf('week', today))
  const [shopId, setShopId] = useState('all')
  const [categoryId, setCategoryId] = useState('all')
  const [productId, setProductId] = useState<string | null>(null)

  const query = {
    from: period.from,
    to: period.to,
    shopId: isShop || shopId === 'all' ? null : shopId,
    categoryId: categoryId === 'all' ? null : categoryId,
    productId,
  }
  const stats = useQuery({ queryKey: queryKeys.stats({ ...query, shopId: query.shopId ?? undefined, categoryId: query.categoryId ?? undefined, productId: productId ?? undefined }), queryFn: () => backend.getStats(query) })

  const title = useMemo(() => {
    const locale = i18n.language === 'ar' ? 'ar-DZ-u-nu-latn' : 'fr-FR'
    const d = new Date(`${period.anchor}T12:00:00Z`)
    if (period.kind === 'day') return new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(d)
    if (period.kind === 'week') return t('stats.weekN', { n: isoWeek(period.from) })
    return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d)
  }, [period, i18n.language, t])

  const r = stats.data
  const productName = productId ? catalog?.products.find((p) => p.id === productId) : null

  return (
    <Screen
      header={
        <Header
          eyebrow={isShop && session?.shopId ? shopName(session.shopId) : session ? t(`role.${session.role}`) : undefined}
          title={t('stats.title')}
          actions={
            <>
              <NotificationBell />
              <SettingsButton />
            </>
          }
        >
          {!isShop && (
            <FilterChips
              label={t('stats.perShop')}
              value={shopId}
              onChange={setShopId}
              items={[{ id: 'all', label: t('stats.allShops') }, ...shops.map((s) => ({ id: s.id, label: loc(s.name, i18n.language) }))]}
            />
          )}
        </Header>
      }
    >
      <div className="flex flex-col gap-4 p-4 pb-8">
        <Segmented<PeriodKind>
          label={t('stats.title')}
          value={kind}
          onChange={(k) => {
            setKind(k)
            setPeriod(periodOf(k, today))
          }}
          options={[
            { value: 'day', label: t('stats.day') },
            { value: 'week', label: t('stats.week') },
            { value: 'month', label: t('stats.month') },
          ]}
        />
        <div className="flex items-center gap-2">
          <IconButton label={t('action.back')} onClick={() => setPeriod(shiftPeriod(period, -1))}>
            <ChevronLeft size={20} className="flip-rtl" />
          </IconButton>
          <span className="flex-1 text-center text-[17px] font-semibold capitalize">{title}</span>
          <IconButton label={t('action.more')} disabled={period.to >= today} className="disabled:opacity-30" onClick={() => setPeriod(shiftPeriod(period, 1))}>
            <ChevronRight size={20} className="flip-rtl" />
          </IconButton>
        </div>

        <FilterChips
          tone="light"
          label={t('catalogAdmin.category')}
          value={categoryId}
          onChange={(v) => {
            setCategoryId(v)
            setProductId(null)
          }}
          items={[{ id: 'all', label: t('stats.allCategories') }, ...(catalog?.categories ?? []).map((c) => ({ id: c.id, label: loc(c.name, i18n.language) }))]}
        />
        {productName && (
          <button type="button" onClick={() => setProductId(null)} className="flex items-center gap-2 self-start rounded-full bg-ink py-1.5 pe-2 ps-3.5 text-[14px] font-medium text-cream">
            {loc(productName.name, i18n.language)}
            <X size={15} aria-label={t('stats.clearProduct')} />
          </button>
        )}

        {stats.isPending ? (
          <SkeletonList rows={3} />
        ) : !r || r.tiles.orders === 0 ? (
          <EmptyState icon={<BarChart3 size={28} />} title={t('stats.empty')} />
        ) : (
          <StatsBody r={r} kind={period.kind} isShop={isShop} today={today} onProduct={setProductId} shopName={shopName} />
        )}

        {!isShop && period.kind === 'day' && <DailyRecap date={period.from} />}
      </div>
    </Screen>
  )
}

function StatsBody({ r, kind, isShop, today, onProduct, shopName }: { r: StatsResult; kind: PeriodKind; isShop: boolean; today: string; onProduct: (id: string) => void; shopName: (id: string) => string }) {
  const { t, i18n } = useTranslation()
  const pct = r.tiles.lines ? Math.round((r.tiles.refusedLines / r.tiles.lines) * 100) : 0
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <StatTile value={r.tiles.orders} label={t('stats.orders')} />
        <StatTile value={r.tiles.lines} label={t('stats.lines')} />
        <StatTile value={`${pct} %`} label={t('stats.refused')} tone={pct >= 10 ? 'warn' : undefined} />
        <StatTile value={r.tiles.problemLines} label={t('stats.problems')} tone={r.tiles.problemLines > 0 ? 'warn' : undefined} />
        {r.tiles.medianReviewMin != null && <StatTile value={t('stats.minutes', { n: r.tiles.medianReviewMin })} label={t('stats.toValidate')} />}
        {r.tiles.medianReadyMin != null && <StatTile value={t('stats.minutes', { n: r.tiles.medianReadyMin })} label={t('stats.toReady')} />}
      </div>

      {kind !== 'day' && (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-meta font-semibold uppercase tracking-wide text-fg-muted">{t('stats.perDay')}</h2>
          <BarChart
            ariaLabel={t('stats.perDay')}
            highlight={today}
            data={r.perDay.map((d) => ({ key: d.date, value: d.orders, label: d.date.slice(8).replace(/^0/, '') }))}
          />
        </section>
      )}

      {r.products.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-meta font-semibold uppercase tracking-wide text-fg-muted">{t('stats.topProducts')}</h2>
          <RankList
            rows={r.products.slice(0, 15).map((p) => ({
              key: `${p.productId}|${p.packLabel ?? ''}`,
              name: loc(p.name, i18n.language),
              value: <Qty mode={p.mode} qty={p.quantity} pack={p.packLabel} />,
              amount: p.shops,
              sub: isShop ? undefined : t('stats.shops', { n: p.shops }),
              onClick: () => onProduct(p.productId),
            }))}
          />
        </section>
      )}

      {!isShop && r.shops.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-meta font-semibold uppercase tracking-wide text-fg-muted">{t('stats.perShop')}</h2>
          <RankList
            rows={r.shops.map((s) => ({
              key: s.shopId,
              name: shopName(s.shopId),
              value: <span className="num">{s.orders}</span>,
              amount: s.lines,
              sub: `${s.lines} · ${s.refusedLines}✕`,
            }))}
          />
        </section>
      )}
    </>
  )
}

/** Everything sent to the labo on a business day, grouped by shop, shareable as text (PRD STA-5). */
function DailyRecap({ date }: { date: string }) {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const orders = useOrders().data ?? []
  const shopName = useShopName()
  const sent = orders.filter((o) => o.businessDate === date && ['validated', 'in_preparation', 'ready', 'received'].includes(o.status))
  if (sent.length === 0) return null
  const text = [...new Set(sent.map((o) => o.shopId))]
    .map((sid) => {
      const lines = sent
        .filter((o) => o.shopId === sid)
        .flatMap((o) => o.lines.filter((l) => l.decision !== 'refused'))
        .map((l) => `  • ${loc(l.name, i18n.language)} — ${formatQuantity(l.mode, l.prep === 'partial' && l.preparedQty != null ? l.preparedQty : l.approved, l.packLabel)}`)
      return [shopName(sid), ...lines].join('\n')
    })
    .join('\n\n')
  return (
    <Button
      variant="tinted"
      className="w-full"
      icon={<ClipboardCopy size={18} />}
      onClick={() => void shareOrCopy(`${t('stats.recap')} · ${date}\n\n${text}`).then((r) => r === 'copied' && toast(t('stats.recapCopied')))}
    >
      {t('stats.recap')}
    </Button>
  )
}
