/**
 * Notification matrix (PRD §6.8). Pure: event → recipients. Mirrored by `notify_recipients()` in SQL.
 * Recipient keys: 'owner', 'deputy', 'labo', 'shop:<shopId>'. The actor is never notified.
 */
import type { Actor, NotificationType, Order, OrderEvent } from './types'

export interface NotificationSpec {
  recipient: string
  type: NotificationType
  push: boolean
  params: Record<string, string | number>
}

export const recipientKey = (actor: Actor, shopId?: string | null): string =>
  actor.role === 'shop' ? `shop:${shopId ?? ''}` : actor.role

const REVIEWERS = ['owner', 'deputy'] as const

export function notificationsFor(event: OrderEvent, order: Order): NotificationSpec[] {
  const shop = `shop:${order.shopId}`
  const actorKey = recipientKey(event.actor, order.shopId)
  const params = { code: order.code, shopId: order.shopId, lines: order.lines.length }
  const out: NotificationSpec[] = []
  const add = (recipient: string, type: NotificationType, push: boolean, extra: Record<string, string | number> = {}) => {
    if (recipient !== actorKey) out.push({ recipient, type, push, params: { ...params, ...extra } })
  }

  switch (event.type) {
    case 'submitted':
      REVIEWERS.forEach((r) => add(r, 'order_submitted', true))
      break
    case 'shop_edited':
    case 'cancelled': {
      if (event.type === 'cancelled' && event.actor.role !== 'shop') {
        add(shop, 'order_deleted', true)
        break
      }
      const type = event.type === 'shop_edited' ? 'order_edited' : 'order_deleted'
      const holder = event.from === 'in_review' ? order.reviewer?.role : undefined
      REVIEWERS.forEach((r) => add(r, type, r === holder))
      break
    }
    case 'validated': {
      const changed = order.lines.filter((l) => l.decision !== 'accepted').length
      add(shop, changed ? 'order_validated_changed' : 'order_validated', true, { changed })
      add('labo', 'order_validated', true, { team: order.team ?? '' })
      break
    }
    case 'refused':
      add(shop, 'order_refused', true)
      break
    case 'prep_started':
      REVIEWERS.forEach((r) => add(r, 'prep_started', false))
      add(shop, 'prep_started', false)
      break
    case 'line_problem':
      REVIEWERS.forEach((r) => add(r, 'line_problem', false))
      break
    case 'note_added':
      add('labo', 'note_added', true)
      break
    case 'ready':
      REVIEWERS.forEach((r) => add(r, 'order_ready', true))
      add(shop, 'order_ready', true)
      break
    case 'received':
      REVIEWERS.forEach((r) => add(r, 'order_received', true))
      break
    default:
      break
  }
  return out
}
