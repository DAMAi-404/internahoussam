import { useQueryClient } from '@tanstack/react-query'
import { MessageSquare, ShoppingBag } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useBackend, useCatalog, useErrorMessage, useOutbox } from '@/app/backend'
import { Button, CountedText, EmptyState, Group, Header, IconButton, ProductArt, Qty, Screen, Stepper, useToast } from '@/components/ui'
import { loc } from '@/lib/format'
import { queryKeys } from '@/lib/queryKeys'
import { useCart } from './cart'

/** Cart (PRD SHP-6): lines with steppers, optional note to the owner, one "Envoyer". */
export function CartScreen() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const backend = useBackend()
  const outbox = useOutbox()
  const qc = useQueryClient()
  const toast = useToast()
  const message = useErrorMessage()
  const catalog = useCatalog().data
  const { lines, note, editing, draftId, setNote, step, clear } = useCart()
  const [noteOpen, setNoteOpen] = useState(note.length > 0)
  const [busy, setBusy] = useState(false)

  const send = async () => {
    if (busy || lines.length === 0) return
    setBusy(true)
    try {
      if (editing) {
        await backend.updatePendingOrder(editing.orderId, editing.version, lines, note.trim())
        toast(t('cart.updated'))
      } else {
        const result = await outbox.run({ kind: 'submit', orderId: draftId, lines, shopNote: note.trim() })
        toast(result === 'sent' ? t('cart.sent') : t('cart.queued'))
      }
      clear()
      void qc.invalidateQueries({ queryKey: queryKeys.orders.all() })
      navigate('/shop/orders', { replace: true })
    } catch (e) {
      toast(message(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen
      header={
        <Header
          title={editing ? t('cart.editing', { code: editing.code }) : t('cart.title')}
          onBack={() => navigate('/shop')}
          actions={
            <IconButton label={t('cart.noteToOwner')} tone={noteOpen || note ? 'active' : 'onDark'} onClick={() => setNoteOpen(!noteOpen)}>
              <MessageSquare size={19} />
            </IconButton>
          }
        />
      }
      footer={
        lines.length > 0 && (
          <Button className="w-full" loading={busy} onClick={() => void send()}>
            {editing ? t('action.update') : t('action.send')}
            <span className="num opacity-70">· {lines.length}</span>
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-3 p-4">
        {noteOpen && <CountedText value={note} onChange={setNote} limit="orderNote" label={t('cart.noteToOwner')} placeholder={t('cart.noteToOwner')} rows={2} />}
        {lines.length === 0 ? (
          <EmptyState icon={<ShoppingBag size={28} />} title={t('cart.empty')} action={<Button variant="tinted" size="md" onClick={() => navigate('/shop')}>{t('catalog.title')}</Button>} />
        ) : (
          <Group>
            {lines.map((l) => {
              const p = catalog?.products.find((x) => x.id === l.productId)
              if (!p) return null
              const pack = p.packs.find((k) => k.id === l.packId)
              const min = p.mode === 'pack' ? 1 : p.step
              return (
                <div key={`${l.productId}:${l.packId ?? ''}`} className="flex items-center gap-3 px-3.5 py-3">
                  <ProductArt photo={p.photo} name={p.name} categoryId={p.categoryId} size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-body font-medium">{loc(p.name, i18n.language)}</div>
                    {pack && (
                      <bdi dir="ltr" className="num text-meta text-muted">
                        {pack.label}
                      </bdi>
                    )}
                  </div>
                  <div className="w-[138px] shrink-0">
                    <Stepper
                      size="sm"
                      value={p.mode === 'pack' ? <bdi dir="ltr">{l.qty}</bdi> : <Qty mode={p.mode} qty={l.qty} />}
                      onDec={() => step(p, l.packId, -1)}
                      onInc={() => step(p, l.packId, 1)}
                      decRemoves={l.qty <= min}
                    />
                  </div>
                </div>
              )
            })}
          </Group>
        )}
      </div>
    </Screen>
  )
}
