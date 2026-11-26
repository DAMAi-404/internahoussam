import type { Role } from '@/domain/types'

export const homeFor = (role: Role): string => (role === 'shop' ? '/shop' : role === 'labo' ? '/labo' : '/owner')

export const orderPath = (role: Role, orderId: string): string =>
  role === 'shop' ? `/shop/orders/${orderId}` : role === 'labo' ? `/labo/orders/${orderId}` : `/owner/orders/${orderId}`
