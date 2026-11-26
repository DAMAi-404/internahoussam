/** Order states (PRD §8) and how each is shown (DESIGN_SYSTEM §2.2). */
export const ORDER_STATUSES = [
  'submitted',
  'in_review',
  'validated',
  'in_preparation',
  'ready',
  'received',
  'refused',
  'cancelled',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

/** Colour family per status: one per step. Values map to --st-<tone>-* tokens. */
export type StatusTone = 'waiting' | 'accepted' | 'preparing' | 'ready' | 'done' | 'refused'

export const STATUS_TONE: Record<OrderStatus, StatusTone> = {
  submitted: 'waiting',
  in_review: 'waiting',
  validated: 'accepted',
  in_preparation: 'preparing',
  ready: 'ready',
  received: 'done',
  refused: 'refused',
  cancelled: 'done',
}

/** i18n key of the label (shop and owner share the same words). */
export const STATUS_LABEL_KEY: Record<OrderStatus, string> = {
  submitted: 'status.waiting',
  in_review: 'status.waiting',
  validated: 'status.accepted',
  in_preparation: 'status.preparing',
  ready: 'status.ready',
  received: 'status.received',
  refused: 'status.refused',
  cancelled: 'status.cancelled',
}

/** Shop can still edit or delete (PRD TRK-3). */
export const isEditableByShop = (s: OrderStatus): boolean => s === 'submitted' || s === 'in_review'

/** Final statuses: eligible for the 30-day purge (PRD RET-1). */
export const isFinal = (s: OrderStatus): boolean =>
  s === 'received' || s === 'ready' || s === 'refused' || s === 'cancelled'
