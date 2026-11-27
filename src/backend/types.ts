/**
 * The one interface the UI talks to. Two implementations:
 *  - demo:     runs in the browser (localStorage, cross-tab sync). Used until Supabase keys are set.
 *  - supabase: calls the Postgres RPCs (supabase/migrations). Selected automatically when env is set.
 * Every mutation mirrors an RPC in docs/ARCHITECTURE.md §5.
 */
import type {
  AppNotification,
  CartLineInput,
  Catalog,
  LaboState,
  Order,
  Prep,
  Product,
  ReviewDecision,
  Role,
  Session,
  Shop,
  StatsQuery,
  StatsResult,
  Team,
} from '@/domain/types'

export type Topic = 'orders' | 'catalog' | 'notifications' | 'labo'

export interface Backend {
  readonly kind: 'demo' | 'supabase'

  // auth
  listShops(): Promise<Shop[]>
  getSession(): Promise<Session | null>
  signInShop(shopId: string, pin: string): Promise<Session>
  signInStaff(email: string, password: string): Promise<Session>
  /** Demo only: pick a role without credentials. */
  signInDemo?(role: Role, shopId?: string): Promise<Session>
  signOut(): Promise<void>

  // catalogue
  getCatalog(): Promise<Catalog>
  saveProduct(product: Product): Promise<Product>
  setProductActive(productId: string, active: boolean): Promise<void>
  setPackActive(productId: string, packId: string, active: boolean): Promise<void>
  uploadPhoto(productId: string, file: Blob): Promise<string>

  // orders (scoped to the session's role by the backend)
  listOrders(): Promise<Order[]>
  submitOrder(input: { id: string; lines: CartLineInput[]; shopNote: string }): Promise<Order>
  updatePendingOrder(id: string, version: number, lines: CartLineInput[], shopNote: string): Promise<Order>
  cancelOrder(id: string, version: number): Promise<Order>
  startReview(id: string): Promise<Order>
  releaseReview(id: string): Promise<void>
  decideOrder(id: string, version: number, decisions: ReviewDecision[], labNote: string, team: Team): Promise<Order>
  addNote(orderId: string, lineId: string | null, body: string): Promise<Order>
  setLinePrep(orderId: string, lineId: string, prep: Prep, preparedQty: number | null, reason: string | null): Promise<Order>
  closeOrder(id: string, version: number): Promise<Order>
  confirmReceived(id: string): Promise<Order>

  // labo
  getLaboState(): Promise<LaboState>
  switchTeam(team: Team, pin: string): Promise<LaboState>

  // notifications
  listNotifications(): Promise<AppNotification[]>
  markNotificationsRead(ids: string[] | 'all'): Promise<void>
  /** Web Push (Supabase only): stores this device's subscription for the `notify` edge function. */
  savePushSubscription?(sub: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<void>

  // statistics (shops are forced to their own shop)
  getStats(query: StatsQuery): Promise<StatsResult>

  // realtime: a hint to refetch, never data (CLAUDE.md > Offline & realtime)
  subscribe(listener: (topic: Topic) => void): () => void
}
