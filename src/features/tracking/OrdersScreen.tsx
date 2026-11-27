import { Check, ClipboardList, CloudOff, Package, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useAction, useOrders, useOutboxItems, useSession, useShopName } from '@/app/backend'
import { Button, Card, ConfirmSheet, EmptyState, ErrorState, Header, IconButton, Progress, Screen, Section, SkeletonList, StatusPill } from '@/components/ui'
import { laboLines, preparedCount } from '@/domain/orders'
import type { Order } from '@/domain/types'
import { NotificationBell } from '@/features/notifications/NotificationBell'
import { NotificationPermissionCard } from '@/features/notifications/NotificationWatcher'
import { SettingsButton } from '@/features/auth/SettingsSheet'
import { useCart } from '@/features/ordering/cart'
import { isEditableByShop } from '@/lib/status'
import { businessDate, formatClock } from '@/lib/time'

const DONE: Order['status'][] = ['received', 'refused', 'cancelled']

/** My orders, grouped: À récupérer → En cours → Terminées (PRD TRK-1). */
export function OrdersScreen() {
  const { t } = useTranslation()
  const session = useSession().data
  const shopName = useShopName()
  const orders = useOrders()
  const pending = useOutboxItems().filter((i) => i.action.kind === 'submit' && i.status === 'pending')
  const list = [...(orders.data ?? [])].sort((a, b) => b.at.submitted.localeCompare(a.at.submitted))
  const ready = list.filter((o) => o.status === 'ready')
  const active = list.filter((o) => !DONE.includes(o.status) && o.status !== 'ready')
  const done = list.filter((o) => DONE.includes(o.status))

  return (
    <Screen
      header={
        <Header
          eyebrow={session?.shopId ? shopName(session.shopId) : undefined}
          title={t('orders.title')}
          actions={
            <>
              <NotificationBell />
              <SettingsButton />
            </>
          }
        />
      }
    >
      <NotificationPermissionCard />
      {orders.isPending ? (
        <SkeletonList />
      ) : orders.isError ? (
        <ErrorState text={t('errors.network')} onRetry={() => void orders.refetch()} />
      ) : list.length === 0 && pending.length === 0 ? (
        <EmptyState icon={<ClipboardList size={28} />} title={t('orders.empty')} />
      ) : (
        <div className="flex flex-col gap-6 p-4 pb-8">
          {ready.length > 0 && (
            <Section title={t('orders.toCollect')} count={ready.length} accent="ready">
              {ready.map((o) => (
                <ShopOrderCard key={o.id} order={o} />
              ))}
            </Section>
          )}
          {(active.length > 0 || pending.length > 0) && (
            <Section title={t('orders.inProgress')} count={active.length + pending.length}>
              {pending.map((p) => (
                <Card key={p.id}>
                  <div className="flex items-center gap-2 text-[15px] font-medium text-wood">
                    <CloudOff size={18} />
                    {t('orders.pending')}
                  </div>
                  <div className="num flex items-center gap-1.5 text-meta text-fg-muted">
                    <Package size={15} />
                    {p.action.kind === 'submit' ? p.action.lines.length : 0}
                  </div>
                </Card>
              ))}
              {active.map((o) => (
                <ShopOrderCard key={o.id} order={o} />
              ))}
            </Section>
          )}
          {done.length > 0 && (
            <Section title={t('orders.done')} count={done.length} collapsible defaultOpen={false}>
              {done.map((o) => (
                <ShopOrderCard key={o.id} order={o} />
              ))}
            </Section>
          )}
        </div>
      )}
    </Screen>
  )
}

function ShopOrderCard({ order: o }: { order: Order }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const loadOrder = useCart((s) => s.loadOrder)
  const [confirm, setConfirm] = useState(false)
  const del = useAction((b, o2: Order) => b.cancelOrder(o2.id, o2.version), { success: t('orders.deleted') })
  const received = useAction((b, id: string) => b.confirmReceived(id), { success: t('orders.received') })
  const editable = isEditableByShop(o.status)
  const lines = laboLines(o)
  const today = o.businessDate === businessDate()

  return (
    <Card highlight={o.status === 'ready' ? 'ready' : undefined} onClick={() => navigate(`/shop/orders/${o.id}`)}>
      <div className="flex items-center gap-2">
        <StatusPill status={o.status} />
        <span className="flex-1" />
        <span className="num text-meta text-fg-muted">{today ? formatClock(o.at.submitted, i18n.language) : o.businessDate.slice(5).split('-').reverse().join('/')}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="num text-code font-semibold">{o.code}</span>
        <span className="num flex items-center gap-1 text-meta text-fg-muted">
          <Package size={15} />
          {o.lines.length}
        </span>
        <span className="flex-1" />
        {editable && (
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            <IconButton
              label={t('action.edit')}
              size={40}
              onClick={() => {
                loadOrder(o)
                navigate('/shop')
              }}
            >
              <Pencil size={18} />
            </IconButton>
            <IconButton label={t('action.delete')} size={40} tone="danger" onClick={() => setConfirm(true)}>
              <Trash2 size={18} />
            </IconButton>
          </div>
        )}
      </div>
      {o.status === 'in_preparation' && <Progress done={preparedCount(o)} total={lines.length} />}
      {o.status === 'ready' && (
        <div onClick={(e) => e.stopPropagation()}>
          <Button size="md" className="w-full" icon={<Check size={18} />} loading={received.isPending} onClick={() => received.mutate(o.id)}>
            {t('action.received')}
          </Button>
        </div>
      )}
      <div onClick={(e) => e.stopPropagation()}>
        <ConfirmSheet
          open={confirm}
          onClose={() => setConfirm(false)}
          title={t('orders.deleteConfirm')}
          confirmLabel={t('action.delete')}
          busy={del.isPending}
          onConfirm={() => del.mutate(o, { onSettled: () => setConfirm(false) })}
        />
      </div>
    </Card>
  )
}
