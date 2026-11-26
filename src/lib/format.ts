import type { TFunction } from 'i18next'
import type { Lang, Localized, Order } from '@/domain/types'
import { formatQuantity } from './quantity'
import { minutesSince } from './time'

export const pickLang = (lang: string): Lang => (lang === 'ar' ? 'ar' : 'fr')

export const loc = (v: Localized, lang: string): string => (pickLang(lang) === 'ar' && v.ar ? v.ar : v.fr)

/** "6 min", "2 h" (never a sentence). */
export function ago(at: string | undefined, t: TFunction, now = new Date()): string {
  if (!at) return ''
  const m = minutesSince(at, now)
  if (m < 1) return t('time.now')
  return m < 60 ? t('time.min', { n: m }) : t('time.h', { n: Math.floor(m / 60) })
}

/** Plain-text order for the share sheet (WhatsApp fallback, PRD OWN-7). Only kept lines. */
export function orderShareText(o: Order, shopName: string, lang: string): string {
  const lines = o.lines
    .filter((l) => l.decision !== 'refused')
    .map((l) => `• ${loc(l.name, lang)} — ${formatQuantity(l.mode, l.approved || l.requested, l.packLabel)}`)
  const notes = o.notes.filter((n) => !n.lineId).map((n) => n.body)
  return [`${shopName} · ${o.code}`, ...lines, ...notes].join('\n')
}

/** Uses the native share sheet when available, otherwise copies. Returns what happened. */
export async function shareOrCopy(text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (navigator.share) {
      await navigator.share({ text })
      return 'shared'
    }
  } catch (e) {
    if ((e as DOMException)?.name === 'AbortError') return 'failed'
  }
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'failed'
  }
}
