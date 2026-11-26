import { useQueryClient } from '@tanstack/react-query'
import { CloudOff, LogOut, RotateCcw, Settings, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useBackend, useOutbox, useOutboxItems, useSession } from '@/app/backend'
import { resetDemo } from '@/backend/demo'
import { Button, IconButton, Segmented, Sheet } from '@/components/ui'
import { setLang, type Lang } from '@/lib/i18n'
import { useCart } from '@/features/ordering/cart'

/** Language, account, unsent actions, sign out. Same for every role. */
export function SettingsButton() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const pending = useOutboxItems().length
  return (
    <>
      <IconButton label={t('action.settings')} tone="onDark" badge={pending} onClick={() => setOpen(true)}>
        <Settings size={20} />
      </IconButton>
      <SettingsSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}

function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const backend = useBackend()
  const outbox = useOutbox()
  const items = useOutboxItems()
  const session = useSession().data
  const qc = useQueryClient()
  const navigate = useNavigate()
  const clearCart = useCart((s) => s.clear)

  const signOut = async () => {
    await backend.signOut()
    clearCart()
    qc.clear()
    onClose()
    navigate('/login', { replace: true })
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('settings.title')}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <span className="text-meta font-semibold uppercase tracking-wide text-muted">{t('settings.language')}</span>
          <Segmented<Lang>
            label={t('settings.language')}
            value={i18n.language === 'ar' ? 'ar' : 'fr'}
            onChange={(l) => void setLang(l)}
            options={[
              { value: 'fr', label: 'Français' },
              { value: 'ar', label: 'العربية' },
            ]}
          />
        </div>

        {items.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-meta font-semibold uppercase tracking-wide text-muted">{t('settings.outbox')}</span>
            <div className="divide-y divide-line overflow-hidden rounded-2xl bg-paper">
              {items.map((it) => (
                <div key={it.id} className="flex items-center gap-3 px-3.5 py-3">
                  {it.status === 'failed' ? <TriangleAlert size={18} className="text-[var(--st-refused-fg)]" /> : <CloudOff size={18} className="text-wood" />}
                  <span className="min-w-0 flex-1 truncate text-[15px]">
                    {it.action.kind === 'submit' ? t('orders.pending') : t('labo.prepared')}
                    {it.status === 'failed' && <span className="block text-meta text-[var(--st-refused-fg)]">{t('settings.outboxFailed')}</span>}
                  </span>
                  {it.status === 'failed' ? (
                    <Button size="md" variant="dangerTinted" onClick={() => void outbox.discard(it.id)}>
                      {t('action.remove')}
                    </Button>
                  ) : (
                    <Button size="md" variant="tinted" onClick={() => void outbox.flush()}>
                      {t('action.retry')}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {session && (
          <div className="flex items-center gap-3 rounded-2xl bg-paper px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-body font-semibold">{session.name}</div>
              <div className="text-meta text-muted">{t(`role.${session.role}`)}</div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Button variant="dangerTinted" className="w-full" icon={<LogOut size={18} />} onClick={() => void signOut()}>
            {t('action.signOut')}
          </Button>
          {backend.kind === 'demo' && (
            <Button
              variant="plain"
              className="w-full"
              icon={<RotateCcw size={18} />}
              onClick={() => {
                resetDemo()
                clearCart()
                qc.clear()
                location.assign('/login')
              }}
            >
              {t('action.resetDemo')}
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  )
}
