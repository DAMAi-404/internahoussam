/**
 * Web Push (PRD NTF-1): subscribes this device once notifications are allowed and a VAPID key is
 * configured, then stores the subscription server-side. The `notify` edge function sends the pushes.
 * Silently does nothing in demo mode, without permission, or where push is unsupported (iOS outside
 * the installed app).
 */
import type { Backend } from '@/backend/types'

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export async function ensurePushSubscription(backend: Backend): Promise<void> {
  const key = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
  if (!key || !backend.savePushSubscription) return
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || Notification.permission !== 'granted') return
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }))
    const json = sub.toJSON()
    if (json.endpoint && json.keys?.p256dh && json.keys.auth) {
      await backend.savePushSubscription({ endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } })
    }
  } catch {
    /* push refused or unavailable: in-app banners still work */
  }
}
