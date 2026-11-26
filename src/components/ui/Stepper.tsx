import clsx from 'clsx'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Click = one step. Press and hold = repeat (after 400 ms, every 110 ms) for big quantities (PRD §7).
 * Keyboard users get the normal click behaviour.
 */
function useRepeat(fn: () => void, enabled: boolean) {
  const fnRef = useRef(fn)
  useLayoutEffect(() => {
    fnRef.current = fn
  })
  const state = useRef({ start: 0, tick: 0, repeated: false })
  useEffect(() => {
    const s = state.current
    return () => {
      clearTimeout(s.start)
      clearInterval(s.tick)
    }
  }, [])
  return useMemo(() => {
    const stop = () => {
      clearTimeout(state.current.start)
      clearInterval(state.current.tick)
    }
    return {
      onPointerDown: () => {
        if (!enabled) return
        state.current.repeated = false
        stop()
        state.current.start = window.setTimeout(() => {
          state.current.repeated = true
          state.current.tick = window.setInterval(() => fnRef.current(), 110)
        }, 400)
      },
      onPointerUp: stop,
      onPointerLeave: stop,
      onPointerCancel: stop,
      onClick: () => {
        if (state.current.repeated) {
          state.current.repeated = false
          return
        }
        fnRef.current()
      },
    }
  }, [enabled])
}

interface StepperProps {
  value: ReactNode
  onDec: () => void
  onInc: () => void
  canDec?: boolean
  canInc?: boolean
  /** Shows a trash icon instead of − when the next − removes the item. */
  decRemoves?: boolean
  size?: 'lg' | 'sm'
  tone?: 'light' | 'ink'
}

export function Stepper({ value, onDec, onInc, canDec = true, canInc = true, decRemoves, size = 'lg', tone = 'light' }: StepperProps) {
  const { t } = useTranslation()
  const dec = useRepeat(onDec, canDec && !decRemoves)
  const inc = useRepeat(onInc, canInc)
  const lg = size === 'lg'
  const btn = clsx(
    'press grid shrink-0 place-items-center rounded-full disabled:opacity-35 select-none touch-manipulation',
    lg ? 'size-[60px]' : 'size-9',
    tone === 'ink' ? 'text-cream active:bg-cream/15' : 'bg-paper text-ink',
  )
  const icon = lg ? 26 : 18
  return (
    <div
      className={clsx(
        'flex items-center justify-between',
        lg ? 'gap-4 px-2' : 'h-11 gap-1 rounded-full px-1',
        !lg && (tone === 'ink' ? 'bg-ink text-cream' : 'bg-paper'),
      )}
    >
      <button type="button" className={btn} disabled={!canDec} aria-label={decRemoves ? t('action.remove') : t('action.less')} {...dec}>
        {decRemoves ? <Trash2 size={icon - 4} /> : <Minus size={icon} strokeWidth={2.2} />}
      </button>
      <span className={clsx('num min-w-0 text-center font-semibold', lg ? 'text-[34px] leading-none' : 'text-[15px]')} aria-live="polite">
        {value}
      </span>
      <button type="button" className={btn} disabled={!canInc} aria-label={t('action.more')} {...inc}>
        <Plus size={icon} strokeWidth={2.2} />
      </button>
    </div>
  )
}
