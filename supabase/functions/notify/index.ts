// Edge function `notify` (Deno): sends one Web Push per device subscribed for the notification's recipient.
// Called by the `notifications_push` trigger (pg_net) with { record: <notifications row> }.
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, NOTIFY_SECRET (+ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY, provided by Supabase).
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'

type Lang = 'fr' | 'ar'

// Short texts, starting with the shop or the order code (PRD NTF-5). Mirrors src/locales/*.json > notifications.types.
const TEXTS: Record<Lang, Record<string, string>> = {
  fr: {
    order_submitted: '{shop} · nouvelle commande ({lines})',
    order_edited: '{code} · modifiée par la boutique',
    order_deleted: '{code} · supprimée',
    order_waiting: '{shop} · attend depuis 15 min',
    order_validated: '{code} · acceptée',
    order_validated_labo: 'Nouvelle commande · {shop}',
    order_validated_changed: '{code} · acceptée · modifiée ({changed})',
    order_refused: '{code} · refusée',
    note_added: '{shop} · nouvelle note du patron',
    order_ready: '{code} · prête à récupérer',
    order_received: '{shop} · {code} livrée',
    handover_missing: 'Labo · passation non confirmée',
  },
  ar: {
    order_submitted: '{shop} · طلبية جديدة ({lines})',
    order_edited: '{code} · عدّلها المحل',
    order_deleted: '{code} · حُذفت',
    order_waiting: '{shop} · تنتظر منذ 15 د',
    order_validated: '{code} · مقبولة',
    order_validated_labo: 'طلبية جديدة · {shop}',
    order_validated_changed: '{code} · مقبولة · معدّلة ({changed})',
    order_refused: '{code} · مرفوضة',
    note_added: '{shop} · ملاحظة جديدة من المسؤول',
    order_ready: '{code} · جاهزة للاستلام',
    order_received: '{shop} · {code} سُلّمت',
    handover_missing: 'اللابو · لم يتم تأكيد تسليم الفريق',
  },
}

interface NotificationRow {
  id: number
  recipient: string
  type: string
  order_id: string | null
  params: Record<string, string | number>
  push: boolean
}

const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com', Deno.env.get('VAPID_PUBLIC_KEY') ?? '', Deno.env.get('VAPID_PRIVATE_KEY') ?? '')

Deno.serve(async (req) => {
  if (req.headers.get('x-notify-secret') !== Deno.env.get('NOTIFY_SECRET')) return new Response('forbidden', { status: 403 })
  const { record } = (await req.json()) as { record: NotificationRow }
  if (!record?.push) return new Response('skip')

  const [{ data: subs }, { data: shops }] = await Promise.all([
    supabase.from('push_subscriptions').select('endpoint, p256dh, auth, user_id').eq('recipient', record.recipient),
    supabase.from('shops').select('id, name_fr, name_ar'),
  ])
  if (!subs?.length) return new Response('no subscribers')
  const { data: profiles } = await supabase.from('profiles').select('user_id, locale').in('user_id', subs.map((s) => s.user_id))

  const type = record.type === 'order_validated' && record.recipient === 'labo' ? 'order_validated_labo' : record.type
  const results = await Promise.all(
    subs.map(async (s) => {
      const lang: Lang = profiles?.find((p) => p.user_id === s.user_id)?.locale === 'fr' ? 'fr' : 'ar'
      const shop = shops?.find((x) => x.id === record.params.shopId)
      const vars: Record<string, string> = { ...Object.fromEntries(Object.entries(record.params).map(([k, v]) => [k, String(v)])), shop: shop ? (lang === 'ar' ? shop.name_ar : shop.name_fr) : '' }
      const body = (TEXTS[lang][type] ?? type).replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '')
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: 'Mahroussa Pro', body, orderId: record.order_id }),
          { TTL: 3600, urgency: 'high' },
        )
        return 'sent'
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
        return `failed ${status ?? ''}`
      }
    }),
  )
  return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } })
})
