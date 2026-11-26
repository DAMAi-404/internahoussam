import { Check, Pencil, Share2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { useAction, useOrders, useShopName } from '@/app/backend'
import { Button, ConfirmSheet, ErrorState, Group, Header, IconButton, LineRow, LineStateIcon, Qty, Screen, SkeletonList, StatusPill, Steps, useToast } from '@/components/ui'
import type { Order, OrderLine } from '@/domain/types'
import { useCart } from '@/features/ordering/cart'
import { loc, orderShareText, shareOrCopy } from '@/lib/format'
import { isEditableByShop } from '@/lib/status'

export function stepIndex(o: Order): number {
  return { submitted: 0, in_review: 0, validated: 1, in_preparation: 2, ready: 3, received: 3, refused: -1, cancelled: -1 }[o.status]
}

/** One line as the shop sees it: decision + labo outcome, never a sentence when an icon will do. */
export function ShopLine({ line: l, lang }: { line: OrderLine; lang: string }) {
  const refused = l.decision === 'refused'
  const shown = refused ? l.requested : l.prep === 'partial' && l.preparedQty != null ? l.preparedQty : l.prep === 'not_done' ? 0 : l.approved
  const changed = !refused && shown !== l.requested
  return (
    <LineRow
      lead={<LineStateIcon line={l} />}
      name={loc(l.name, lang)}
      struck={refused}
      tint={refused ? 'refused' : undefined}
      sub={
        refused ? (
          <span className="text-[var(--st-refused-fg)]">{l.refusalReason}</span>
        ) : l.laboReason ? (
          <span className={l.prep === 'not_done' ? 'text-[var(--st-refused-fg)]' : 'text-[var(--st-waiting-fg)]'}>{l.laboReason}</span>
        ) : undefined
      }
      qty={
        <>
          <Qty mode={l.mode} qty={shown} pack={l.packLabel} className={refused ? 'text-fg-muted' : undefined} />
          {changed && <Qty mode={l.mode} qty={l.requested} pack={l.packLabel} struck />}
        </>
      }
    />
  )
}

export function OrderDetailScreen() {
  const { t, i18n } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const orders = useOrders()
  const shopName = useShopName()
  const loadOrder = useCart((s) => s.loadOrder)
  const [confirm, setConfirm] = useState(false)
  const del = useAction((b, o: Order) => b.cancelOrder(o.id, o.version), { success: t('orders.deleted') })
  const received = useAction((b, oid: string) => b.confirmReceived(oid), { success: t('orders.received') })
  const o = orders.data?.find((x) => x.id === id)

  if (orders.isPending) return <SkeletonList />
  if (!o) return <ErrorState text={t('errors.not_found')} onRetry={() => navigate('/shop/orders')} />

  const editable = isEditableByShop(o.status)
  const share = async () => {
    const r = await shareOrCopy(orderShareText(o, shopName(o.shopId), i18n.language))
    if (r === 'copied') toast(t('stats.recapCopied'))
  }

  return (
    <Screen
      header={
        <Header
          title={<span className="num">{o.code}</span>}
          onBack={() => navigate('/shop/orders')}
          actions={
            <>
              <IconButton label={t('action.share')} tone="onDark" onClick={() => void share()}>
                <Share2 size={19} />
              </IconButton>
              {editable && (
                <>
                  <IconButton
                    label={t('action.edit')}
                    tone="onDark"
                    onClick={() => {
                      loadOrder(o)
                      navigate('/shop')
                    }}
                  >
                    <Pencil size={19} />
                  </IconButton>
                  <IconButton label={t('action.delete')} tone="onDark" onClick={() => setConfirm(true)}>
                    <Trash2 size={19} />
                  </IconButton>
                </>
              )}
            </>
          }
        >
          <div>
            <StatusPill status={o.status} />
          </div>
        </Header>
      }
      footer={
        o.status === 'ready' && (
          <Button className="w-full" icon={<Check size={19} />} loading={received.isPending} onClick={() => received.mutate(o.id)}>
            {t('action.received')}
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-3 p-4">
        {stepIndex(o) >= 0 && (
          <Group>
            <Steps current={stepIndex(o)} times={[o.at.submitted, o.at.validated, o.at.prepStarted, o.at.ready]} />
          </Group>
        )}
        <Group>
          {o.lines.map((l) => (
            <ShopLine key={l.id} line={l} lang={i18n.language} />
          ))}
        </Group>
        {o.shopNote && (
          <p dir="auto" className="user-text rounded-2xl bg-card px-4 py-3 text-[15px] text-fg-muted">
            {o.shopNote}
          </p>
        )}
      </div>
      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t('orders.deleteConfirm')}
        confirmLabel={t('action.delete')}
        busy={del.isPending}
        onConfirm={() =>
          del.mutate(o, {
            onSuccess: () => navigate('/shop/orders'),
            onSettled: () => setConfirm(false),
          })
        }
      />
    </Screen>
  )
}
