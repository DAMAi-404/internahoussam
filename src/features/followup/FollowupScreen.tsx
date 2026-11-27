import { ChefHat, Clock, MessageSquare, Moon, Sun, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useNow, useOrders, useSession, useShopName } from '@/app/backend'
import { Card, EmptyState, ErrorState, FilterChips, Header, Progress, Screen, SkeletonList, StatusPill } from '@/components/ui'
import { hasProblem, laboLines, preparedCount } from '@/domain/orders'
import type { Order } from '@/domain/types'
import { NotificationBell } from '@/features/notifications/NotificationBell'
import { SettingsButton } from '@/features/auth/SettingsSheet'
import { ago } from '@/lib/format'
import { businessDate } from '@/lib/time'

type Filter = 'all' | 'validated' | 'in_preparation' | 'ready' | 'received'
const ORDER: Record<string, number> = { ready: 0, in_preparation: 1, validated: 2, received: 3 }

/** Suivi (PRD FOL-1/2): everything sent to the labo today, filterable by step, with counts. */
export function FollowupScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const now = useNow()
  const session = useSession().data
  const shopName = useShopName()
  const orders = useOrders()
  const [filter, setFilter] = useState<Filter>('all')
  const today = businessDate(now)
  const live = (orders.data ?? []).filter(
    (o) => ['validated', 'in_preparation', 'ready'].includes(o.status) || (o.status === 'received' && o.at.received && businessDate(new Date(o.at.received)) === today),
  )
  const count = (s: Filter) => live.filter((o) => o.status === s).length
  const shown = live
    .filter((o) => filter === 'all' || o.status === filter)
    .sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9) || (b.at.validated ?? '').localeCompare(a.at.validated ?? ''))

  return (
    <Screen
      header={
        <Header
          eyebrow={session ? t(`role.${session.role}`) : undefined}
          title={t('followup.title')}
          actions={
            <>
              <NotificationBell />
              <SettingsButton />
            </>
          }
        >
          <FilterChips
            label={t('followup.title')}
            value={filter}
            onChange={(v) => setFilter(v as Filter)}
            items={[
              { id: 'all', label: t('followup.all'), count: live.length },
              { id: 'validated', label: t('followup.accepted'), count: count('validated') },
              { id: 'in_preparation', label: t('followup.preparing'), count: count('in_preparation') },
              { id: 'ready', label: t('followup.ready'), count: count('ready') },
              { id: 'received', label: t('followup.delivered'), count: count('received') },
            ]}
          />
        </Header>
      }
    >
      {orders.isPending ? (
        <SkeletonList />
      ) : orders.isError ? (
        <ErrorState text={t('errors.network')} onRetry={() => void orders.refetch()} />
      ) : shown.length === 0 ? (
        <EmptyState icon={<ChefHat size={28} />} title={t('followup.empty')} />
      ) : (
        <div className="flex flex-col gap-3 p-4">
          {shown.map((o) => (
            <FollowCard key={o.id} order={o} shop={shopName(o.shopId)} now={now} onOpen={() => navigate(`/owner/orders/${o.id}`)} />
          ))}
        </div>
      )}
    </Screen>
  )
}

function FollowCard({ order: o, shop, now, onOpen }: { order: Order; shop: string; now: Date; onOpen: () => void }) {
  const { t } = useTranslation()
  const lines = laboLines(o)
  const done = preparedCount(o)
  const notes = o.notes.length
  return (
    <Card highlight={o.status === 'ready' ? 'ready' : undefined} onClick={onOpen}>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[19px] font-semibold">{shop}</span>
        <StatusPill status={o.status} />
      </div>
      <div className="flex items-center gap-2.5 text-meta text-fg-muted">
        <span className="inline-flex items-center gap-1">
          {o.team === 'nuit' ? <Moon size={14} /> : <Sun size={14} />}
          {o.team ? t(`team.${o.team}`) : ''}
        </span>
        <span className="num">
          {done}/{lines.length}
        </span>
        {hasProblem(o) && <TriangleAlert size={15} className="text-wood" aria-label={t('followup.problem')} />}
        {notes > 0 && <MessageSquare size={14} aria-label={t('note.open')} />}
        <span className="flex-1" />
        <span className="num inline-flex items-center gap-1">
          <Clock size={13} />
          {ago(o.at.validated, t, now)}
        </span>
      </div>
      {o.status !== 'received' && <Progress done={done} total={lines.length} tone={o.status === 'ready' ? 'ok' : 'preparing'} />}
    </Card>
  )
}
