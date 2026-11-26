import clsx from 'clsx'
import { formatQuantity, type QuantityMode } from '@/lib/quantity'

/** A quantity with its unit, never reordered in RTL (CLAUDE.md > UI). */
export function Qty({
  mode,
  qty,
  pack,
  className,
  struck,
}: {
  mode: QuantityMode
  qty: number
  pack?: string | null
  className?: string
  struck?: boolean
}) {
  return (
    <bdi dir="ltr" className={clsx('num whitespace-nowrap', struck && 'text-meta font-normal text-fg-muted line-through', className)}>
      {formatQuantity(mode, qty, pack)}
    </bdi>
  )
}
