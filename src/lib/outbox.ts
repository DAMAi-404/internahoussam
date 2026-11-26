/**
 * Outbox (ARCHITECTURE §7): actions that must never be lost are stored on the device before being sent,
 * and replayed until the server confirms them. Replays are safe because every action is idempotent
 * (client order UUID for submit, same target state for line prep).
 * A business refusal (e.g. product deactivated meanwhile) is kept as `failed` and shown to the user.
 */
import { errorCode } from '@/domain/errors'
import type { CartLineInput, Prep } from '@/domain/types'
import type { Backend } from '@/backend/types'

export type OutboxAction =
  | { kind: 'submit'; orderId: string; lines: CartLineInput[]; shopNote: string }
  | { kind: 'linePrep'; orderId: string; lineId: string; prep: Prep; preparedQty: number | null; reason: string | null }

export interface OutboxItem {
  id: string
  action: OutboxAction
  createdAt: string
  attempts: number
  status: 'pending' | 'failed'
  error: string | null
}

export interface OutboxStorage {
  get(): Promise<OutboxItem[]>
  set(items: OutboxItem[]): Promise<void>
}

const KEY = 'mahroussa-outbox'

export function idbStorage(): OutboxStorage {
  return {
    async get() {
      const { get } = await import('idb-keyval')
      return ((await get(KEY)) as OutboxItem[] | undefined) ?? []
    },
    async set(items) {
      const { set } = await import('idb-keyval')
      await set(KEY, items)
    },
  }
}

export function memoryStorage(): OutboxStorage {
  let items: OutboxItem[] = []
  return { get: async () => structuredClone(items), set: async (x) => void (items = structuredClone(x)) }
}

type Listener = (items: OutboxItem[]) => void

export class Outbox {
  private listeners = new Set<Listener>()
  private flushing: Promise<void> | null = null

  constructor(
    private backend: Backend,
    private storage: OutboxStorage = idbStorage(),
  ) {}

  subscribe(l: Listener): () => void {
    this.listeners.add(l)
    void this.storage.get().then(l)
    return () => this.listeners.delete(l)
  }

  async items(): Promise<OutboxItem[]> {
    return this.storage.get()
  }

  private async write(items: OutboxItem[]) {
    await this.storage.set(items)
    this.listeners.forEach((l) => l(items))
  }

  /**
   * Stores the action, then tries to send it. Resolves `sent` when confirmed, `queued` when the
   * network failed (it stays stored), and rejects for business errors (nothing stored).
   */
  async run(action: OutboxAction): Promise<'sent' | 'queued'> {
    const item: OutboxItem = { id: action.kind === 'submit' ? action.orderId : `${action.lineId}:${Date.now()}`, action, createdAt: new Date().toISOString(), attempts: 0, status: 'pending', error: null }
    const items = await this.storage.get()
    // A newer line-prep for the same line replaces the older queued one (last write wins).
    const kept = items.filter((i) => !(action.kind === 'linePrep' && i.action.kind === 'linePrep' && i.action.lineId === action.lineId) && i.id !== item.id)
    await this.write([...kept, item])
    try {
      await this.send(action)
      await this.remove(item.id)
      return 'sent'
    } catch (e) {
      if (errorCode(e) === 'network') return 'queued'
      await this.remove(item.id)
      throw e
    }
  }

  private async send(a: OutboxAction) {
    if (a.kind === 'submit') await this.backend.submitOrder({ id: a.orderId, lines: a.lines, shopNote: a.shopNote })
    else await this.backend.setLinePrep(a.orderId, a.lineId, a.prep, a.preparedQty, a.reason)
  }

  private async remove(id: string) {
    await this.write((await this.storage.get()).filter((i) => i.id !== id))
  }

  /** Replays pending items in order. Called on start, on `online`, and every 30 s while items remain. */
  flush(): Promise<void> {
    if (this.flushing) return this.flushing
    this.flushing = (async () => {
      for (const item of await this.storage.get()) {
        if (item.status !== 'pending') continue
        try {
          await this.send(item.action)
          await this.remove(item.id)
        } catch (e) {
          const code = errorCode(e)
          const items = await this.storage.get()
          const cur = items.find((i) => i.id === item.id)
          if (!cur) continue
          cur.attempts += 1
          cur.error = code
          if (code !== 'network') cur.status = 'failed'
          await this.write(items)
          if (code === 'network') break // still offline: keep order, retry later
        }
      }
    })().finally(() => (this.flushing = null))
    return this.flushing
  }

  async discard(id: string) {
    await this.remove(id)
  }
}
