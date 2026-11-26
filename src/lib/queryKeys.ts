/** The only place TanStack Query keys are defined (CLAUDE.md > Conventions). */
export const queryKeys = {
  catalog: () => ['catalog'] as const,
  orders: {
    all: () => ['orders'] as const,
    shop: (shopId: string) => ['orders', 'shop', shopId] as const,
    inbox: () => ['orders', 'inbox'] as const,
    followup: () => ['orders', 'followup'] as const,
    labo: () => ['orders', 'labo'] as const,
    detail: (orderId: string) => ['orders', 'detail', orderId] as const,
  },
  notifications: () => ['notifications'] as const,
  stats: (params: { from: string; to: string; shopId?: string; categoryId?: string; productId?: string }) =>
    ['stats', params] as const,
  laboSession: () => ['labo', 'session'] as const,
}
