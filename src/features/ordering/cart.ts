/**
 * Shop cart (PRD SHP-6/7): saved on the device after every change (IndexedDB via idb-keyval),
 * survives app kills. `draftId` is the future order UUID, generated once per cart so a double tap
 * or a retry can never create two orders (idempotent submit).
 */
import { del, get, set } from 'idb-keyval'
import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import type { CartLineInput, Order, Product } from '@/domain/types'
import { stepQuantity } from '@/lib/quantity'

export type CartLine = CartLineInput

interface CartState {
  shopId: string | null
  draftId: string
  lines: CartLine[]
  note: string
  editing: { orderId: string; version: number; code: string } | null
  setShop: (shopId: string) => void
  setQty: (productId: string, packId: string | null, qty: number) => void
  step: (product: Product, packId: string | null, dir: 1 | -1) => void
  setNote: (note: string) => void
  loadOrder: (o: Order) => void
  clear: () => void
}

const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`

const idbStorage: StateStorage = {
  getItem: async (k) => (await get<string>(k)) ?? null,
  setItem: (k, v) => set(k, v),
  removeItem: (k) => del(k),
}

const same = (l: CartLine, productId: string, packId: string | null) => l.productId === productId && (l.packId ?? null) === (packId ?? null)

export const useCart = create<CartState>()(
  persist(
    (setState, getState) => ({
      shopId: null,
      draftId: newId(),
      lines: [],
      note: '',
      editing: null,
      setShop: (shopId) => {
        if (getState().shopId !== shopId) setState({ shopId, lines: [], note: '', editing: null, draftId: newId() })
      },
      setQty: (productId, packId, qty) =>
        setState((s) => {
          const others = s.lines.filter((l) => !same(l, productId, packId))
          if (qty <= 0) return { lines: others }
          const exists = s.lines.some((l) => same(l, productId, packId))
          return { lines: exists ? s.lines.map((l) => (same(l, productId, packId) ? { ...l, qty } : l)) : [...s.lines, { productId, packId, qty }] }
        }),
      step: (product, packId, dir) => {
        const cur = getState().lines.find((l) => same(l, product.id, packId))?.qty ?? 0
        getState().setQty(product.id, packId, stepQuantity({ mode: product.mode, step: product.step, max: product.max }, cur, dir))
      },
      setNote: (note) => setState({ note }),
      loadOrder: (o) =>
        setState({
          lines: o.lines.map((l) => ({ productId: l.productId, packId: l.packId, qty: l.requested })),
          note: o.shopNote,
          editing: { orderId: o.id, version: o.version, code: o.code },
        }),
      clear: () => setState({ lines: [], note: '', editing: null, draftId: newId() }),
    }),
    { name: 'mahroussa-cart', storage: createJSONStorage(() => idbStorage) },
  ),
)

export const cartQty = (lines: CartLine[], productId: string, packId: string | null) => lines.find((l) => same(l, productId, packId))?.qty ?? 0
