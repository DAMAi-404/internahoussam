import { Download, Share, SquarePlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Sheet } from '@/components/ui'

interface InstallEvent extends Event {
  prompt: () => Promise<void>
}

const KEY = 'mahroussa-install-dismissed'
let deferred: InstallEvent | null = null
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as InstallEvent
  })
}

const standalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/**
 * One-time guide to install the app (PRD §10): on iPhone push only works once the app is on the
 * home screen; on Android Chrome the native install prompt is offered.
 */
export function InstallGuide() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setOpen(!standalone() && !wasDismissed()), 1500)
    return () => clearTimeout(timer)
  }, [])
  const dismiss = () => {
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      /* ignore */
    }
    setOpen(false)
  }
  const ios = typeof navigator !== 'undefined' && isIOS()
  return (
    <Sheet open={open} onClose={dismiss} title={t('install.title')}>
      <div className="flex flex-col gap-4 pb-1">
        <div className="flex items-center gap-3 rounded-2xl bg-paper px-4 py-3.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink text-cream">{ios ? <Share size={19} /> : <SquarePlus size={19} />}</span>
          <p className="text-[15px] leading-snug">{ios ? t('install.ios') : t('install.android')}</p>
        </div>
        {!ios && deferred && (
          <Button
            className="w-full"
            icon={<Download size={18} />}
            onClick={() => {
              void deferred?.prompt()
              dismiss()
            }}
          >
            {t('install.title')}
          </Button>
        )}
        <Button variant="plain" className="w-full" onClick={dismiss}>
          {t('install.later')}
        </Button>
      </div>
    </Sheet>
  )
}
