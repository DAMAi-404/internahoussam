import { Bell, Check, ChefHat, Clock, MessageSquare, Moon, Sun, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useLaboState, useNow, useOrders, useShopName } from '@/app/backend'
import { Card, EmptyState, ErrorState, Header, IconButton, Progress, Section, SkeletonList } from '@/components/ui'
import { laboLines, preparedCount } from '@/domain/orders'
import type { Order, Team } from '@/domain/types'
import { NotificationBell } from '@/features/notifications/NotificationBell'
import { NotificationPermissionCard } from '@/features/notifications/NotificationWatcher'
import { SettingsButton } from '@/features/auth/SettingsSheet'
import { ago } from '@/lib/format'
import { businessDate, formatClock } from '@/lib/time'
import { useAlarm, useSeen } from './device'

export const isNewForDevice = (o: Order, seen: Record<string, string>) => o.status === 'validated' && !seen[o.id]
export const hasUnreadNote = (o: Order, seen: Record<string, string>) => {
  const at = seen[o.id]
  return o.notes.some((n) => !at || n.at > at)
}

/** Labo order list (PRD LAB-3): Nouvelles first with an alarm, then En préparation, then today's ready orders. */
export function LaboListScreen({ onHandover }: { onHandover: () => void }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const now = useNow()
  const labo = useLaboState().data
  const orders = useOrders()
  const shopName = useShopName()
  const { seen } = useSeen()
  const team: Team = labo?.team ?? 'matin'
  const list = orders.data ?? []
  const today = businessDate(now)
  const fresh = list.filter((o) => o.status === 'validated').sort((a, b) => (a.at.validated ?? '').localeCompare(b.at.validated ?? ''))
  const preparing = list.filter((o) => o.status === 'in_preparation').sort((a, b) => (a.at.validated ?? '').localeCompare(b.at.validated ?? ''))
  const done = list.filter((o) => (o.status === 'ready' || o.status === 'received') && o.at.ready && businessDate(new Date(o.at.ready)) === today)
  const unseen = fresh.filter((o) => isNewForDevice(o, seen))
  const unreadNotes = list.filter((o) => ['validated', 'in_preparation'].includes(o.status) && !isNewForDevice(o, seen) && hasUnreadNote(o, seen))
  useAlarm(unseen.length > 0)
  const firstAlert = unseen[0] ?? unreadNotes[0]

  const card = (o: Order) => {
    const lines = laboLines(o)
    const isNew = isNewForDevice(o, seen)
    const note = hasUnreadNote(o, seen)
    return (
      <Card key={o.id} highlight={isNew ? 'new' : undefined} onClick={() => navigate(`/labo/orders/${o.id}`)}>
        <div className="flex items-center gap-2.5">
          <span className="min-w-0 flex-1 truncate text-[21px] font-semibold">{shopName(o.shopId)}</span>
          {o.notes.length > 0 && (
            <span className={note ? 'text-wood' : 'text-fg-muted'} aria-label={t('note.open')}>
              <MessageSquare size={19} />
            </span>
          )}
          {o.team && o.team !== team && <span className="text-fg-muted">{o.team === 'nuit' ? <Moon size={18} /> : <Sun size={18} />}</span>}
          <span className="num text-[17px] font-semibold text-fg-muted">
            {preparedCount(o)}/{lines.length}
          </span>
        </div>
        <Progress done={preparedCount(o)} total={lines.length} />
        <div className="flex items-center gap-1.5 text-meta text-fg-muted">
          <Clock size={14} />
          <span className="num">{o.status === 'ready' || o.status === 'received' ? formatClock(o.at.ready ?? '', i18n.language) : ago(o.at.validated, t, now)}</span>
        </div>
      </Card>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Header
        eyebrow={labo?.since ? t('labo.since', { time: formatClock(labo.since, i18n.language) }) : undefined}
        title={
          <span className="inline-flex items-center gap-2">
            {team === 'nuit' ? <Moon size={24} /> : <Sun size={24} />}
            {t(`team.${team}`)}
          </span>
        }
        actions={
          <>
            <IconButton label={t('action.changeTeam')} tone="onDark" onClick={onHandover}>
              <Users size={20} />
            </IconButton>
            <NotificationBell />
            <SettingsButton />
          </>
        }
      />
      {firstAlert && (
        <button
          type="button"
          onClick={() => navigate(`/labo/orders/${firstAlert.id}`)}
          className="animate-pulse-wood flex shrink-0 items-center gap-3 bg-wood px-4 py-3 text-start text-[16px] font-semibold text-white"
        >
          <Bell size={20} />
          <span className="flex-1">{unseen.length > 0 ? t('labo.alarm', { count: unseen.length }) : t('notifications.types.note_added', { shop: shopName(firstAlert.shopId) })}</span>
        </button>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <NotificationPermissionCard />
        {orders.isPending ? (
          <SkeletonList />
        ) : orders.isError ? (
          <ErrorState text={t('errors.network')} onRetry={() => void orders.refetch()} />
        ) : fresh.length + preparing.length + done.length === 0 ? (
          <EmptyState icon={<ChefHat size={28} />} title={t('labo.empty')} />
        ) : (
          <div className="flex flex-col gap-6 p-4 pb-8">
            {fresh.length > 0 && (
              <Section title={t('labo.new')} count={fresh.length} accent="new">
                {fresh.map(card)}
              </Section>
            )}
            {preparing.length > 0 && (
              <Section title={t('labo.inPrep')} count={preparing.length}>
                {preparing.map(card)}
              </Section>
            )}
            {done.length > 0 && (
              <Section title={t('labo.readyToday')} count={done.length} collapsible defaultOpen={false}>
                {done.map(card)}
              </Section>
            )}
            {fresh.length + preparing.length === 0 && <EmptyState icon={<Check size={28} />} title={t('labo.empty')} />}
          </div>
        )}
      </div>
    </div>
  )
}
