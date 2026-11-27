import { useQueryClient } from '@tanstack/react-query'
import { BellRing } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useSession } from '@/app/backend'
import { orderPath } from '@/app/routes'
import { Button, InAppBanner } from '@/components/ui'
import type { AppNotification } from '@/domain/types'
import { playChime, unlockAudio } from '@/features/labo/device'
import { queryKeys } from '@/lib/queryKeys'
import { useNotificationText } from './NotificationBell'

/**
 * Watches the notification list (refreshed by realtime) and, for each new one:
 * - app visible → in-app banner (+ chime for the owner's new orders, short tone for labo notes);
 * - app hidden  → a system notification through the service worker (same tag per order, PRD NTF-4).
 * Real push while the app is closed comes from the `notify` edge function (Supabase).
 */
export function NotificationWatcher() {
  const qc = useQueryClient()
  const session = useSession().data
  const text = useNotificationText()
  const navigate = useNavigate()
  const known = useRef<Set<string> | null>(null)
  const [banner, setBanner] = useState<AppNotification | null>(null)
  const latest = useRef({ session, text })
  useEffect(() => {
    latest.current = { session, text }
  })

  useEffect(() => {
    const onTap = () => unlockAudio()
    window.addEventListener('pointerdown', onTap, { once: true })
    const unsub = qc.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'success') return
      if (event.query.queryKey[0] !== queryKeys.notifications()[0]) return
      const list = event.query.state.data as AppNotification[] | undefined
      if (!list) return
      if (known.current === null) {
        known.current = new Set(list.map((n) => n.id))
        return
      }
      const fresh = list.filter((n) => !known.current?.has(n.id) && !n.readAt)
      fresh.forEach((n) => known.current?.add(n.id))
      const top = fresh.find((n) => n.push) ?? fresh[0]
      if (!top) return
      const { session: s, text: tx } = latest.current
      if (document.visibilityState === 'visible') {
        setBanner(top)
        if (top.type === 'order_submitted') playChime('chime')
        if (top.type === 'note_added') playChime('tone')
      } else if (top.push && 'Notification' in window && Notification.permission === 'granted') {
        const body = tx(top, s)
        const url = top.orderId && s ? orderPath(s.role, top.orderId) : '/'
        void navigator.serviceWorker?.ready
          .then((reg) => reg.showNotification('Mahroussa Pro', { body, tag: top.orderId ?? top.id, icon: '/icon.svg', data: { url } }))
          .catch(() => new Notification('Mahroussa Pro', { body, tag: top.orderId ?? top.id }))
      }
    })
    return () => {
      unsub()
      window.removeEventListener('pointerdown', onTap)
    }
  }, [qc])

  useEffect(() => {
    if (!banner) return
    const timer = window.setTimeout(() => setBanner(null), 5000)
    return () => clearTimeout(timer)
  }, [banner])

  if (!banner) return null
  return (
    <InAppBanner
      text={text(banner, session)}
      onClose={() => setBanner(null)}
      onOpen={() => {
        setBanner(null)
        if (banner.orderId && session) navigate(orderPath(session.role, banner.orderId))
      }}
    />
  )
}

/** Asks once for notification permission, from a tap (browsers refuse it otherwise). */
export function NotificationPermissionCard() {
  const { t } = useTranslation()
  const [state, setState] = useState(() => ('Notification' in window ? Notification.permission : 'denied'))
  if (state !== 'default') return null
  return (
    <div className="mx-4 mt-3 flex items-center gap-3 rounded-2xl bg-card px-4 py-3 text-fg">
      <BellRing size={20} className="shrink-0 text-sage-deep" />
      <span className="min-w-0 flex-1 text-[15px] font-medium">{t('notifications.enable')}</span>
      <Button size="md" variant="tinted" onClick={() => void Notification.requestPermission().then(setState)}>
        {t('action.ok')}
      </Button>
    </div>
  )
}
