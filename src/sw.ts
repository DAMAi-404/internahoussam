/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope

// App shell precache (injected at build time by vite-plugin-pwa).
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

/** Push payload sent by the `notify` edge function (ARCHITECTURE §8). */
interface PushPayload {
  title: string
  body: string
  orderId?: string
  url?: string
}

self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json() as PushPayload
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      // One notification per order: a newer push replaces the older one (PRD NTF-4).
      tag: data.orderId ?? 'general',
      data: { url: data.url ?? (data.orderId ? `/orders/${data.orderId}` : '/') },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data as { url?: string } | null)?.url ?? '/'
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const existing = windows[0]
      if (existing) {
        await existing.focus()
        await existing.navigate(url)
      } else {
        await self.clients.openWindow(url)
      }
    })(),
  )
})
