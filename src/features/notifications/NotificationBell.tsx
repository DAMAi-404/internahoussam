import clsx from 'clsx'
import { Bell, CheckCheck, ChefHat, CircleCheck, CircleX, Clock, MessageSquare, PackageCheck, Pencil, Trash2, TriangleAlert, Users } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useBackend, useNotifications, useSession, useShopName } from '@/app/backend'
import { orderPath } from '@/app/routes'
import { EmptyState, IconButton, Sheet } from '@/components/ui'
import type { AppNotification, NotificationType, Session } from '@/domain/types'
import { formatClock, businessDate } from '@/lib/time'

const ICON: Record<NotificationType, [ReactNode, string]> = {
  order_submitted: [<Bell key="i" size={18} />, 'waiting'],
  order_edited: [<Pencil key="i" size={17} />, 'waiting'],
  order_deleted: [<Trash2 key="i" size={17} />, 'done'],
  order_waiting: [<Clock key="i" size={18} />, 'waiting'],
  order_validated: [<CircleCheck key="i" size={18} />, 'accepted'],
  order_validated_changed: [<CircleCheck key="i" size={18} />, 'accepted'],
  order_refused: [<CircleX key="i" size={18} />, 'refused'],
  prep_started: [<ChefHat key="i" size={18} />, 'preparing'],
  line_problem: [<TriangleAlert key="i" size={18} />, 'waiting'],
  note_added: [<MessageSquare key="i" size={17} />, 'waiting'],
  order_ready: [<PackageCheck key="i" size={18} />, 'ready'],
  order_received: [<CheckCheck key="i" size={18} />, 'done'],
  handover_missing: [<Users key="i" size={18} />, 'refused'],
}

/** Builds the one-line text of a notification in the current language (PRD NTF-5). */
export function useNotificationText() {
  const { t } = useTranslation()
  const shopName = useShopName()
  return (n: AppNotification, session: Session | null | undefined) => {
    const type = n.type === 'order_validated' && session?.role === 'labo' ? 'order_validated_labo' : n.type
    return t(`notifications.types.${type}`, { ...n.params, shop: shopName(String(n.params.shopId ?? '')) })
  }
}

/** Bell with unread count → notification centre (PRD NTF-2). */
export function NotificationBell() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const list = useNotifications().data ?? []
  const unread = list.filter((n) => !n.readAt).length
  return (
    <>
      <IconButton label={t('notifications.title')} tone="onDark" badge={unread} onClick={() => setOpen(true)}>
        <Bell size={20} />
      </IconButton>
      <NotificationCenter open={open} onClose={() => setOpen(false)} list={list} />
    </>
  )
}

function NotificationCenter({ open, onClose, list }: { open: boolean; onClose: () => void; list: AppNotification[] }) {
  const { t, i18n } = useTranslation()
  const backend = useBackend()
  const session = useSession().data
  const text = useNotificationText()
  const navigate = useNavigate()
  const today = businessDate()
  const groups: [string, AppNotification[]][] = [
    [t('notifications.today'), list.filter((n) => businessDate(new Date(n.at)) === today)],
    [t('notifications.earlier'), list.filter((n) => businessDate(new Date(n.at)) !== today).slice(0, 40)],
  ]

  const openOne = async (n: AppNotification) => {
    if (!n.readAt) await backend.markNotificationsRead([n.id])
    onClose()
    if (n.orderId && session) navigate(orderPath(session.role, n.orderId))
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('notifications.title')}>
      {list.length === 0 ? (
        <EmptyState icon={<Bell size={26} />} title={t('notifications.empty')} />
      ) : (
        <div className="flex flex-col gap-4">
          {list.some((n) => !n.readAt) && (
            <button type="button" onClick={() => void backend.markNotificationsRead('all')} className="self-end text-[15px] font-semibold text-sage-deep">
              {t('action.markAllRead')}
            </button>
          )}
          {groups.map(([label, items]) =>
            items.length === 0 ? null : (
              <section key={label} className="flex flex-col gap-2">
                <h3 className="text-meta font-semibold uppercase tracking-wide text-muted">{label}</h3>
                <div className="divide-y divide-line overflow-hidden rounded-2xl bg-paper">
                  {items.map((n) => {
                    const [icon, tone] = ICON[n.type]
                    return (
                      <button key={n.id} type="button" onClick={() => void openOne(n)} className="flex w-full items-center gap-3 px-3.5 py-3 text-start">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full" style={{ background: `var(--st-${tone}-bg)`, color: `var(--st-${tone}-fg)` }}>
                          {icon}
                        </span>
                        <span className={clsx('user-text min-w-0 flex-1 text-[15px]', n.readAt ? 'text-muted' : 'font-medium text-ink')}>{text(n, session)}</span>
                        <span className="num shrink-0 text-meta text-muted">{formatClock(n.at, i18n.language)}</span>
                        {!n.readAt && <span className="size-2 shrink-0 rounded-full bg-wood" aria-hidden />}
                      </button>
                    )
                  })}
                </div>
              </section>
            ),
          )}
        </div>
      )}
    </Sheet>
  )
}
