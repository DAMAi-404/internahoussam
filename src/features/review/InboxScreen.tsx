import clsx from 'clsx'
import { Clock, Inbox, Lock, MessageSquare, Package, Pencil } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useNow, useOrders, useSession, useShopName } from '@/app/backend'
import { Card, EmptyState, ErrorState, Header, Screen, SkeletonList } from '@/components/ui'
import { NotificationBell } from '@/features/notifications/NotificationBell'
import { SettingsButton } from '@/features/auth/SettingsSheet'
import { ago } from '@/lib/format'
import { minutesSince } from '@/lib/time'

const LATE_MIN = 10

/** Orders waiting for review, oldest first (PRD OWN-1). */
export function InboxScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const now = useNow()
  const session = useSession().data
  const shopName = useShopName()
  const orders = useOrders()
  const inbox = (orders.data ?? []).filter((o) => o.status === 'submitted' || o.status === 'in_review').sort((a, b) => a.at.submitted.localeCompare(b.at.submitted))

  return (
    <Screen
      header={
        <Header
          eyebrow={session ? t(`role.${session.role}`) : undefined}
          title={t('review.inbox')}
          actions={
            <>
              <NotificationBell />
              <SettingsButton />
            </>
          }
        />
      }
    >
      {orders.isPending ? (
        <SkeletonList />
      ) : orders.isError ? (
        <ErrorState text={t('errors.network')} onRetry={() => void orders.refetch()} />
      ) : inbox.length === 0 ? (
        <EmptyState icon={<Inbox size={28} />} title={t('review.empty')} />
      ) : (
        <div className="flex flex-col gap-3 p-4">
          {inbox.map((o) => {
            const waited = minutesSince(o.at.submitted, now)
            const late = waited >= LATE_MIN
            const lockedByOther = o.status === 'in_review' && o.reviewer && o.reviewer.role !== session?.role
            return (
              <Card key={o.id} highlight={o.status === 'submitted' ? 'new' : undefined} onClick={() => navigate(`/owner/orders/${o.id}`)}>
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[20px] font-semibold">{shopName(o.shopId)}</span>
                  <span
                    className={clsx(
                      'num inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-meta font-semibold',
                      late ? 'bg-[var(--st-waiting-bg)] text-[var(--st-waiting-fg)]' : 'bg-paper text-muted',
                    )}
                  >
                    <Clock size={14} />
                    {ago(o.at.submitted, t, now)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-meta text-fg-muted">
                  <span className="num">{o.code}</span>
                  <span className="num inline-flex items-center gap-1">
                    <Package size={14} />
                    {o.lines.length}
                  </span>
                  {o.shopNote && <MessageSquare size={14} className="text-wood" aria-label={t('review.shopNote')} />}
                  {o.editedDuringReview && <Pencil size={14} className="text-sage-deep" aria-label={t('review.edited')} />}
                  <span className="flex-1" />
                  {lockedByOther && (
                    <span className="inline-flex items-center gap-1 font-medium">
                      <Lock size={13} />
                      {o.reviewer?.name}
                    </span>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </Screen>
  )
}
