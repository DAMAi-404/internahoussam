import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { loadBackend } from '@/backend'
import type { Backend } from '@/backend/types'
import { useToast } from '@/components/ui'
import { errorCode, isDomainError } from '@/domain/errors'
import { Outbox, type OutboxItem } from '@/lib/outbox'
import { queryKeys } from '@/lib/queryKeys'

interface Ctx {
  backend: Backend
  outbox: Outbox
}
const BackendCtx = createContext<Ctx | null>(null)

/** Loads the backend once, wires realtime → query invalidation and the outbox replay loop. */
export function BackendProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const [ctx, setCtx] = useState<Ctx | null>(null)
  const qc = useQueryClient()

  useEffect(() => {
    let alive = true
    void loadBackend().then((backend) => alive && setCtx({ backend, outbox: new Outbox(backend) }))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!ctx) return
    // Realtime is a hint to refetch, never data (CLAUDE.md > Offline & realtime).
    const unsub = ctx.backend.subscribe((topic) => {
      if (topic === 'orders') void qc.invalidateQueries({ queryKey: queryKeys.orders.all() })
      if (topic === 'catalog') void qc.invalidateQueries({ queryKey: queryKeys.catalog() })
      if (topic === 'notifications') void qc.invalidateQueries({ queryKey: queryKeys.notifications() })
      if (topic === 'labo') void qc.invalidateQueries({ queryKey: queryKeys.laboSession() })
      if (topic === 'orders') void qc.invalidateQueries({ queryKey: ['stats'] })
    })
    const flush = () => void ctx.outbox.flush().then(() => qc.invalidateQueries({ queryKey: queryKeys.orders.all() }))
    flush()
    window.addEventListener('online', flush)
    const timer = window.setInterval(flush, 30_000)
    return () => {
      unsub()
      window.removeEventListener('online', flush)
      clearInterval(timer)
    }
  }, [ctx, qc])

  if (!ctx) return <>{fallback}</>
  return <BackendCtx.Provider value={ctx}>{children}</BackendCtx.Provider>
}

export function useBackend(): Backend {
  const c = useContext(BackendCtx)
  if (!c) throw new Error('useBackend outside BackendProvider')
  return c.backend
}

export function useOutbox(): Outbox {
  const c = useContext(BackendCtx)
  if (!c) throw new Error('useOutbox outside BackendProvider')
  return c.outbox
}

export function useOutboxItems(): OutboxItem[] {
  const outbox = useOutbox()
  const [items, setItems] = useState<OutboxItem[]>([])
  useEffect(() => outbox.subscribe(setItems), [outbox])
  return items
}

/* ---------------- queries ---------------- */

export function useSession() {
  const b = useBackend()
  return useQuery({ queryKey: ['session'], queryFn: () => b.getSession(), staleTime: Infinity })
}

export function useCatalog() {
  const b = useBackend()
  return useQuery({ queryKey: queryKeys.catalog(), queryFn: () => b.getCatalog(), staleTime: 60_000 })
}

export function useShops() {
  const b = useBackend()
  return useQuery({ queryKey: ['shops'], queryFn: () => b.listShops(), staleTime: Infinity })
}

export function useOrders() {
  const b = useBackend()
  return useQuery({ queryKey: queryKeys.orders.all(), queryFn: () => b.listOrders(), refetchInterval: 60_000 })
}

export function useNotifications() {
  const b = useBackend()
  return useQuery({ queryKey: queryKeys.notifications(), queryFn: () => b.listNotifications(), refetchInterval: 60_000 })
}

export function useLaboState() {
  const b = useBackend()
  return useQuery({ queryKey: queryKeys.laboSession(), queryFn: () => b.getLaboState() })
}

/* ---------------- mutations ---------------- */

/** Human message for any error (business codes are translated; anything else is "no connection"). */
export function useErrorMessage() {
  const { t } = useTranslation()
  return (e: unknown) => t(`errors.${errorCode(e)}`, isDomainError(e) ? e.params : {})
}

/**
 * Wraps a backend call: shows the translated error, refetches orders on conflicts
 * (stale version / changed state), and refreshes the order list on success.
 */
export function useAction<TArgs, TResult>(fn: (b: Backend, args: TArgs) => Promise<TResult>, opts: { success?: string } = {}) {
  const b = useBackend()
  const qc = useQueryClient()
  const toast = useToast()
  const message = useErrorMessage()
  return useMutation({
    mutationFn: (args: TArgs) => fn(b, args),
    onSuccess: () => {
      if (opts.success) toast(opts.success)
      void qc.invalidateQueries({ queryKey: queryKeys.orders.all() })
    },
    onError: (e) => {
      toast(message(e), 'error')
      void qc.invalidateQueries({ queryKey: queryKeys.orders.all() })
    },
  })
}

/** Ticks every 30 s so "6 min ago" labels stay true. */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

export function useShopName() {
  const { i18n } = useTranslation()
  const shops = useShops().data
  return useMemo(() => {
    const lang = i18n.language === 'ar' ? 'ar' : 'fr'
    return (shopId: string) => shops?.find((s) => s.id === shopId)?.name[lang] ?? shopId
  }, [shops, i18n.language])
}
