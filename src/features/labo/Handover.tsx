import { useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { Moon, Sun, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useBackend } from '@/app/backend'
import { IconButton, Keypad, PinDots } from '@/components/ui'
import type { Team } from '@/domain/types'
import { queryKeys } from '@/lib/queryKeys'
import { teamAt } from '@/lib/time'
import { unlockAudio } from './device'

const PIN_LENGTH = 4

/**
 * Handover (PRD LAB-2): blocks the device at 04:00 / 16:00 until the incoming team picks itself and
 * enters its team PIN. Also opened manually for early or late changes (then it can be dismissed).
 */
export function Handover({ mandatory, onDone, onCancel }: { mandatory: boolean; onDone: () => void; onCancel?: () => void }) {
  const { t } = useTranslation()
  const backend = useBackend()
  const qc = useQueryClient()
  const [team, setTeam] = useState<Team>(() => teamAt())
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)

  const digit = async (d: string) => {
    unlockAudio() // the PIN tap is the user gesture that allows the alarm sound later
    if (busy || pin.length >= PIN_LENGTH) return
    const next = pin + d
    setPin(next)
    setError(false)
    if (next.length < PIN_LENGTH) return
    setBusy(true)
    try {
      await backend.switchTeam(team, next)
      await qc.invalidateQueries({ queryKey: queryKeys.laboSession() })
      onDone()
    } catch {
      setError(true)
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div role="dialog" aria-modal aria-label={t('labo.handover')} className="surface-light fixed inset-0 z-50 overflow-y-auto bg-paper">
      <div className="safe-top mx-auto flex min-h-full max-w-md flex-col gap-4 px-5 pb-6 pt-6">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <div className="text-meta font-medium text-muted">{t('labo.handover')}</div>
            <h2 className="text-title font-semibold">{t('labo.who')}</h2>
          </div>
          {!mandatory && onCancel && (
            <IconButton label={t('action.close')} onClick={onCancel}>
              <X size={20} />
            </IconButton>
          )}
        </div>

        {(['matin', 'nuit'] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={team === k}
            onClick={() => (setTeam(k), setPin(''), setError(false))}
            className={clsx(
              'press flex h-20 w-full items-center gap-4 rounded-[20px] px-5 text-start transition-shadow',
              k === 'matin' ? 'bg-[#dccba4] text-[#3e3013]' : 'bg-ink text-cream',
              team === k && (k === 'matin' ? 'shadow-[0_0_0_3px_var(--paper),0_0_0_6px_var(--sage-deep)]' : 'shadow-[0_0_0_3px_var(--paper),0_0_0_6px_var(--sage)]'),
            )}
          >
            {k === 'matin' ? <Sun size={28} /> : <Moon size={28} />}
            <span className="flex-1 text-[20px] font-semibold">{t(`team.${k}`)}</span>
            <bdi dir="ltr" className="num text-[14px] opacity-75">{t(`team.hours_${k}`)}</bdi>
          </button>
        ))}

        <div className="mt-2 flex flex-col gap-1">
          <span className="text-center text-[15px] font-medium text-muted">{t('labo.teamPin', { team: t(`team.${team}`) })}</span>
          <PinDots length={PIN_LENGTH} filled={pin.length} error={error} />
          <p className={clsx('h-5 text-center text-[14px] font-medium text-[var(--st-refused-fg)]', !error && 'invisible')}>{t('labo.wrongPin')}</p>
        </div>
        <Keypad onDigit={(d) => void digit(d)} onDelete={() => setPin((p) => p.slice(0, -1))} disabled={busy} />
        {backend.kind === 'demo' && <p className="text-center text-meta text-muted">{t('labo.demoPins')}</p>}
      </div>
    </div>
  )
}
