import clsx from 'clsx'
import type { ReactNode } from 'react'

export interface SegmentOption<T extends string> {
  value: T
  label: ReactNode
}

/** iOS-style segmented control: track in paper, selected thumb in cream. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'md',
}: {
  options: SegmentOption<T>[]
  value: T
  onChange: (v: T) => void
  label: string
  size?: 'md' | 'lg'
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-2xl bg-paper p-1">
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={clsx(
              'flex flex-1 items-center justify-center gap-1.5 rounded-xl font-medium transition-all',
              size === 'lg' ? 'h-12 text-body' : 'h-10 text-[15px]',
              on ? 'bg-cream font-semibold text-ink shadow-[0_2px_8px_rgb(26_53_36/.12)]' : 'text-muted',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={clsx('relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors', checked ? 'bg-sage-deep' : 'bg-paper-deep')}
    >
      <span
        className={clsx(
          'absolute top-[2px] size-[27px] rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/.18)] transition-[inset-inline-start]',
          checked ? 'start-[22px]' : 'start-[2px]',
        )}
      />
    </button>
  )
}

/** Big choice card used in the labo problem sheet. */
export function ChoiceCard({ selected, onClick, icon, label }: { selected: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={clsx(
        'press flex flex-1 flex-col items-center gap-2 rounded-2xl border-2 px-3 py-4 text-center text-[15px] font-semibold transition-colors',
        selected ? 'border-ink bg-ink text-cream' : 'border-line bg-paper text-ink',
      )}
    >
      {icon}
      {label}
    </button>
  )
}

/** Preset reason chips + "Autre…" text (reasons, refusal motives). */
export function ReasonChips({ options, value, onChange, label }: { options: string[]; value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          onClick={() => onChange(value === o ? '' : o)}
          className={clsx('press h-10 rounded-full px-4 text-[15px] font-medium', value === o ? 'bg-ink text-cream' : 'bg-paper text-ink')}
        >
          {o}
        </button>
      ))}
    </div>
  )
}
