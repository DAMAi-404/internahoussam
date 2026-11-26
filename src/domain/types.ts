/**
 * Domain model shared by the UI and both backends (demo + Supabase).
 * Mirrors docs/ARCHITECTURE.md §3. Quantities are integers in base units (see lib/quantity.ts).
 */
import type { QuantityMode } from '@/lib/quantity'
import type { OrderStatus } from '@/lib/status'
import type { Team } from '@/lib/time'

export type { QuantityMode, OrderStatus, Team }

export type Role = 'owner' | 'deputy' | 'shop' | 'labo'
export type Lang = 'fr' | 'ar'

export interface Localized {
  fr: string
  ar: string
}

export interface Shop {
  id: string
  code: string // 3 letters used in order codes: EMD, KOU…
  name: Localized
}

export interface Category {
  id: string
  name: Localized
  sort: number
  active: boolean
}

export interface Pack {
  id: string
  label: string // "5 L", "×50"
  active: boolean
}

export interface Product {
  id: string
  categoryId: string
  name: Localized
  description: Localized // optional: empty strings when absent, max 80 chars each
  photo: string | null // URL or data URL
  mode: QuantityMode
  step: number // base units; 1 for packs
  max: number | null
  active: boolean
  sort: number
  packs: Pack[]
}

export interface Catalog {
  categories: Category[]
  products: Product[]
}

export type Decision = 'accepted' | 'reduced' | 'refused'
export type Prep = 'todo' | 'done' | 'partial' | 'not_done'

export interface OrderLine {
  id: string
  productId: string
  packId: string | null
  // snapshot at submit time (never re-read from products)
  name: Localized
  categoryId: string
  mode: QuantityMode
  step: number
  packLabel: string | null
  requested: number
  approved: number // = requested until a reviewer reduces it; 0 when refused
  decision: Decision
  refusalReason: string | null
  prep: Prep
  preparedQty: number | null // only for partial
  laboReason: string | null // required for partial / not_done
  prepTeam: Team | null
  changedByShop: boolean // highlighted for the reviewer after a shop edit during review
}

export interface Actor {
  role: Role
  name: string
  team?: Team | null
}

export interface Note {
  id: string
  lineId: string | null
  audience: 'labo' | 'owner'
  body: string
  author: Actor
  at: string // ISO
}

export type EventType =
  | 'submitted'
  | 'shop_edited'
  | 'cancelled'
  | 'review_started'
  | 'review_released'
  | 'validated'
  | 'refused'
  | 'note_added'
  | 'prep_started'
  | 'line_prepped'
  | 'line_problem'
  | 'ready'
  | 'received'

export interface OrderEvent {
  id: string
  type: EventType
  at: string
  actor: Actor
  from: OrderStatus | null
  to: OrderStatus | null
  lineId?: string | null
  detail?: string | null
}

export interface Order {
  id: string // client-generated UUID (idempotency key)
  code: string // EMD-1126-02
  shopId: string
  status: OrderStatus
  businessDate: string // YYYY-MM-DD, 04:00 cutoff
  version: number
  team: Team | null
  shopNote: string // ≤ 160
  notes: Note[]
  lines: OrderLine[]
  events: OrderEvent[]
  reviewer: Actor | null // who holds / held the review
  editedDuringReview: boolean
  at: {
    submitted: string
    reviewStarted?: string
    validated?: string
    refused?: string
    prepStarted?: string
    ready?: string
    received?: string
    cancelled?: string
  }
}

export interface Session {
  userId: string // 'owner' | 'deputy' | 'labo' | 'shop:<id>' in demo; auth uid in Supabase
  role: Role
  name: string
  shopId: string | null
}

export type NotificationType =
  | 'order_submitted'
  | 'order_edited'
  | 'order_deleted'
  | 'order_waiting'
  | 'order_validated'
  | 'order_validated_changed'
  | 'order_refused'
  | 'prep_started'
  | 'line_problem'
  | 'note_added'
  | 'order_ready'
  | 'order_received'
  | 'handover_missing'

export interface AppNotification {
  id: string
  recipient: string // Session.userId-like key: 'owner', 'deputy', 'labo', 'shop:<id>'
  type: NotificationType
  orderId: string | null
  params: Record<string, string | number>
  push: boolean
  at: string
  readAt: string | null
}

/** Input lines from the cart. */
export interface CartLineInput {
  productId: string
  packId: string | null
  qty: number
}

export interface ReviewDecision {
  lineId: string
  decision: Decision
  approved: number
  refusalReason: string | null
  note: string | null // owner → labo note on this line (≤ 80)
}

export interface LaboState {
  team: Team | null
  since: string | null
}

export interface StatsQuery {
  from: string // business date inclusive
  to: string // business date inclusive
  shopId?: string | null
  categoryId?: string | null
  productId?: string | null
}

export interface StatsResult {
  tiles: {
    orders: number
    lines: number
    refusedLines: number
    problemLines: number
    medianReviewMin: number | null
    medianReadyMin: number | null
  }
  perDay: { date: string; orders: number }[]
  products: {
    productId: string
    name: Localized
    mode: QuantityMode
    packLabel: string | null
    quantity: number
    shops: number
  }[]
  shops: { shopId: string; orders: number; lines: number; refusedLines: number }[]
}
