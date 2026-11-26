import clsx from 'clsx'
import { Check, CircleAlert, X } from 'lucide-react'
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from './Button'
import { Sheet } from './Sheet'

/* ---------------- Toast ---------------- */

interface ToastMsg {
  id: number
  text: string
  tone: 'ok' | 'error'
}
const ToastCtx = createContext<(text: string, tone?: 'ok' | 'error') => void>(() => undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<ToastMsg | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const show = useCallback((text: string, tone: 'ok' | 'error' = 'ok') => {
    clearTimeout(timer.current)
    setMsg({ id: Date.now(), text, tone })
    timer.current = window.setTimeout(() => setMsg(null), tone === 'error' ? 3500 : 1800)
  }, [])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex justify-center px-4 pt-[max(12px,env(safe-area-inset-top))]">
        {msg && (
          <div
            key={msg.id}
            className={clsx(
              'animate-drop flex max-w-md items-center gap-2.5 rounded-2xl px-4 py-3 text-[15px] font-medium shadow-[0_10px_30px_rgb(15_33_23/.35)]',
              msg.tone === 'ok' ? 'bg-ink text-cream' : 'bg-[#9b2c1f] text-cream',
            )}
          >
            {msg.tone === 'ok' ? <Check size={18} /> : <CircleAlert size={18} />}
            <span className="user-text">{msg.text}</span>
          </div>
        )}
      </div>
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)

/* ---------------- In-app banner (events while the app is open) ---------------- */

export function InAppBanner({ text, onOpen, onClose }: { text: string; onOpen?: () => void; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[65] flex justify-center px-3 pt-[max(10px,env(safe-area-inset-top))]">
      <div className="animate-drop pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-ink py-2.5 pe-2 ps-4 text-cream shadow-[0_14px_40px_rgb(15_33_23/.4)]">
        <button type="button" onClick={onOpen} className="user-text min-w-0 flex-1 text-start text-[15px] font-medium">
          {text}
        </button>
        <button type="button" aria-label={t('action.close')} onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-full bg-cream/10">
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

/* ---------------- Confirm (irreversible actions only) ---------------- */

export function ConfirmSheet({
  open,
  onClose,
  title,
  confirmLabel,
  onConfirm,
  busy,
}: {
  open: boolean
  onClose: () => void
  title: string
  confirmLabel: string
  onConfirm: () => void
  busy?: boolean
}) {
  const { t } = useTranslation()
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-2.5 pt-2">
        <Button variant="danger" className="w-full" loading={busy} onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button variant="plain" className="w-full" onClick={onClose}>
          {t('action.cancel')}
        </Button>
      </div>
    </Sheet>
  )
}

/* ---------------- Empty, loading, error ---------------- */

export function EmptyState({ icon, title, action }: { icon: ReactNode; title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-card text-sage-mid">{icon}</span>
      <p className="text-body font-medium text-fg-muted">{title}</p>
      {action}
    </div>
  )
}

export function SkeletonList({ rows = 4, height = 92 }: { rows?: number; height?: number }) {
  return (
    <div className="flex flex-col gap-3 p-4" aria-busy>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton rounded-group" style={{ height }} />
      ))}
    </div>
  )
}

export function SkeletonGrid({ cards = 6 }: { cards?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 p-4" aria-busy>
      {Array.from({ length: cards }, (_, i) => (
        <div key={i} className="skeleton aspect-[4/5] rounded-card" />
      ))}
    </div>
  )
}

export function ErrorState({ text, onRetry }: { text: string; onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-[var(--st-refused-bg)] text-[var(--st-refused-fg)]">
        <CircleAlert size={28} />
      </span>
      <p className="text-body font-medium text-fg-muted">{text}</p>
      <Button variant="tinted" size="md" onClick={onRetry}>
        {t('action.retry')}
      </Button>
    </div>
  )
}
