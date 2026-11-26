import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'

/**
 * Server state rules (ARCHITECTURE §6): refetch on focus and reconnect; realtime only invalidates.
 * Mutations are never retried automatically: retries go through the outbox with an idempotency key.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { refetchOnWindowFocus: true, refetchOnReconnect: true, staleTime: 15_000, retry: 2 },
          mutations: { retry: false },
        },
      }),
  )
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
