import clsx from 'clsx'
import { Delete } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/** PIN dots; shakes on error. */
export function PinDots({ length, filled, error }: { length: number; filled: number; error?: boolean }) {
  return (
    <div className={clsx('flex justify-center gap-4 py-2', error && 'animate-shake')} aria-hidden>
      {Array.from({ length }, (_, i) => (
        <span key={i} className={clsx('size-4 rounded-full transition-colors', i < filled ? 'bg-sage-deep' : 'shadow-[inset_0_0_0_2px_#8c8270]')} />
      ))}
    </div>
  )
}

/** Numeric keypad, always LTR (digits order is universal). */
export function Keypad({ onDigit, onDelete, disabled }: { onDigit: (d: string) => void; onDelete: () => void; disabled?: boolean }) {
  const { t } = useTranslation()
  const key = 'press h-[60px] rounded-2xl bg-cream text-[26px] font-medium text-ink active:bg-paper-deep disabled:opacity-50'
  return (
    <div dir="ltr" className="grid grid-cols-3 gap-2.5">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
        <button key={d} type="button" className={clsx(key, 'num')} disabled={disabled} onClick={() => onDigit(d)}>
          {d}
        </button>
      ))}
      <span />
      <button type="button" className={clsx(key, 'num')} disabled={disabled} onClick={() => onDigit('0')}>
        0
      </button>
      <button type="button" aria-label={t('action.delete')} className="press grid h-[60px] place-items-center rounded-2xl text-ink" disabled={disabled} onClick={onDelete}>
        <Delete size={26} />
      </button>
    </div>
  )
}
