import { useTranslation } from 'react-i18next'
import { STATUS_LABEL_KEY, STATUS_TONE, type OrderStatus } from '@/lib/status'

/** The only way to show an order status: dot + word, one colour per step (DESIGN_SYSTEM §2.2). */
export function StatusPill({ status }: { status: OrderStatus }) {
  const { t } = useTranslation()
  const tone = STATUS_TONE[status]
  return (
    <span
      className="inline-flex h-7 items-center gap-2 whitespace-nowrap rounded-full px-3 text-meta font-semibold"
      style={{ background: `var(--st-${tone}-bg)`, color: `var(--st-${tone}-fg)` }}
    >
      <span aria-hidden className="size-2 rounded-full" style={{ background: `var(--st-${tone}-dot)` }} />
      {t(STATUS_LABEL_KEY[status])}
    </span>
  )
}
