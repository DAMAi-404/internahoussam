import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { useBackend, useCatalog, useErrorMessage, useSession } from '@/app/backend'
import { ErrorState, FilterChips, Group, Header, IconButton, ProductArt, Screen, SkeletonList, Switch, useToast } from '@/components/ui'
import type { Product } from '@/domain/types'
import { NotificationBell } from '@/features/notifications/NotificationBell'
import { SettingsButton } from '@/features/auth/SettingsSheet'
import { loc } from '@/lib/format'
import { formatQuantity } from '@/lib/quantity'
import { queryKeys } from '@/lib/queryKeys'
import { ProductEditor } from './ProductEditor'

/** Catalogue (PRD CAT-*): availability toggles for owner and deputy; editing for the owner only. */
export function CatalogAdminScreen() {
  const { t, i18n } = useTranslation()
  const backend = useBackend()
  const qc = useQueryClient()
  const toast = useToast()
  const message = useErrorMessage()
  const session = useSession().data
  const catalog = useCatalog()
  const [filter, setFilter] = useState('all')
  const [editing, setEditing] = useState<Product | null>(null)
  const isOwner = session?.role === 'owner'

  const toggle = async (fn: () => Promise<void>) => {
    try {
      await fn()
      await qc.invalidateQueries({ queryKey: queryKeys.catalog() })
    } catch (e) {
      toast(message(e), 'error')
    }
  }

  const cats = catalog.data?.categories ?? []
  const blank = (): Product => ({
    id: globalThis.crypto?.randomUUID?.() ?? String(Date.now()),
    categoryId: filter !== 'all' ? filter : (cats[0]?.id ?? 'glaces'),
    name: { fr: '', ar: '' },
    description: { fr: '', ar: '' },
    photo: null,
    mode: 'count',
    step: 1,
    max: null,
    active: true,
    sort: 999,
    packs: [],
  })

  return (
    <Screen
      header={
        <Header
          eyebrow={session ? t(`role.${session.role}`) : undefined}
          title={t('catalogAdmin.title')}
          actions={
            <>
              {isOwner && (
                <IconButton label={t('catalogAdmin.newProduct')} tone="onDark" onClick={() => setEditing(blank())}>
                  <Plus size={21} />
                </IconButton>
              )}
              <NotificationBell />
              <SettingsButton />
            </>
          }
        >
          <FilterChips
            label={t('catalogAdmin.category')}
            value={filter}
            onChange={setFilter}
            items={[{ id: 'all', label: t('catalog.all') }, ...cats.map((c) => ({ id: c.id, label: loc(c.name, i18n.language), count: catalog.data?.products.filter((p) => p.categoryId === c.id).length }))]}
          />
        </Header>
      }
    >
      {catalog.isPending ? (
        <SkeletonList rows={6} height={64} />
      ) : catalog.isError ? (
        <ErrorState text={t('errors.network')} onRetry={() => void catalog.refetch()} />
      ) : (
        <div className="flex flex-col gap-5 p-4 pb-8">
          {!isOwner && <p className="px-1 text-meta text-fg-muted">{t('catalogAdmin.readOnly')}</p>}
          {cats
            .filter((c) => filter === 'all' || c.id === filter)
            .map((c) => {
              const products = (catalog.data?.products ?? []).filter((p) => p.categoryId === c.id).sort((a, b) => a.sort - b.sort)
              if (products.length === 0) return null
              return (
                <section key={c.id} className="flex flex-col gap-2">
                  <h2 className="px-1 text-meta font-semibold uppercase tracking-wide text-fg-muted">{loc(c.name, i18n.language)}</h2>
                  <Group>
                    {products.map((p) => (
                      <div key={p.id} className="flex flex-col">
                        <div className="flex items-center gap-3 px-3.5 py-2.5">
                          <button type="button" disabled={!isOwner} onClick={() => setEditing(p)} className="flex min-w-0 flex-1 items-center gap-3 text-start">
                            <ProductArt photo={p.photo} name={p.name} categoryId={p.categoryId} size={46} className={p.active ? '' : 'opacity-50'} />
                            <span className="min-w-0 flex-1">
                              <span className={`block truncate text-body font-medium ${p.active ? '' : 'text-fg-muted'}`}>{loc(p.name, i18n.language)}</span>
                              <bdi dir="ltr" className="num block truncate text-meta text-fg-muted">
                                {t(`catalogAdmin.modes.${p.mode}`)} · {p.mode === 'pack' ? p.packs.map((k) => k.label).join(', ') : formatQuantity(p.mode, p.step)}
                              </bdi>
                            </span>
                          </button>
                          <Switch checked={p.active} label={`${loc(p.name, i18n.language)} · ${t('catalogAdmin.active')}`} onChange={(v) => void toggle(() => backend.setProductActive(p.id, v))} />
                        </div>
                        {p.mode === 'pack' && p.packs.length > 1 && p.active && (
                          <div className="flex flex-wrap gap-2 px-3.5 pb-3 ps-[74px]">
                            {p.packs.map((k) => (
                              <button
                                key={k.id}
                                type="button"
                                role="switch"
                                aria-checked={k.active}
                                onClick={() => void toggle(() => backend.setPackActive(p.id, k.id, !k.active))}
                                className={`num h-8 rounded-full px-3 text-[13px] font-semibold ${k.active ? 'bg-sage-deep text-cream' : 'bg-paper text-muted line-through'}`}
                              >
                                <bdi dir="ltr">{k.label}</bdi>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </Group>
                </section>
              )
            })}
        </div>
      )}
      {isOwner && <ProductEditor product={editing} categories={cats} onClose={() => setEditing(null)} />}
    </Screen>
  )
}
