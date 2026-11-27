import { useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { Ban, Check, Minus, MessageSquare, TriangleAlert, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { useAction, useErrorMessage, useOrders, useOutbox, useShopName } from '@/app/backend'
import { Button, ChoiceCard, CountedText, ErrorState, Header, IconButton, NoteIcon, Qty, ReasonChips, Screen, Sheet, SkeletonList, Stepper, useToast, type BubbleNote } from '@/components/ui'
import { laboLines, preparedCount } from '@/domain/orders'
import type { Order, OrderLine, Prep } from '@/domain/types'
import { loc } from '@/lib/format'
import { formatQuantity } from '@/lib/quantity'
import { queryKeys } from '@/lib/queryKeys'
import { useSeen } from './device'

/** One order, full screen (PRD LAB-4…6): tap a row = prepared; warning icon = problem; close when all resolved. */
export function LaboOrderScreen() {
  const { t, i18n } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const orders = useOrders()
  const shopName = useShopName()
  const outbox = useOutbox()
  const qc = useQueryClient()
  const toast = useToast()
  const message = useErrorMessage()
  const { markSeen } = useSeen()
  const [problem, setProblem] = useState<OrderLine | null>(null)
  const o = orders.data?.find((x) => x.id === id)
  const close = useAction((b, order: Order) => b.closeOrder(order.id, order.version), { success: t('labo.closed') })

  useEffect(() => {
    if (id) markSeen(id)
  }, [id, markSeen, o?.notes.length])

  if (orders.isPending) return <SkeletonList />
  if (!o) return <ErrorState text={t('errors.not_found')} onRetry={() => navigate('/labo')} />

  const editable = o.status === 'validated' || o.status === 'in_preparation'
  const lines = laboLines(o)
  const done = preparedCount(o)
  const orderNotes = o.notes.filter((n) => !n.lineId)
  const lineNotes = (l: OrderLine): BubbleNote[] => o.notes.filter((n) => n.lineId === l.id).map((n) => ({ id: n.id, author: n.author.name, at: n.at, body: n.body }))

  const setPrep = async (l: OrderLine, prep: Prep, preparedQty: number | null = null, reason: string | null = null) => {
    try {
      const r = await outbox.run({ kind: 'linePrep', orderId: o.id, lineId: l.id, prep, preparedQty, reason })
      if (r === 'queued') toast(t('cart.queued'))
      navigator.vibrate?.(10)
    } catch (e) {
      toast(message(e), 'error')
    } finally {
      void qc.invalidateQueries({ queryKey: queryKeys.orders.all() })
    }
  }

  return (
    <Screen
      header={<Header title={shopName(o.shopId)} eyebrow={<span className="num">{o.code}</span>} onBack={() => navigate('/labo')} />}
      footer={
        editable && (
          <Button className="w-full" disabled={done < lines.length} loading={close.isPending} onClick={() => close.mutate(o, { onSuccess: () => navigate('/labo') })}>
            {done < lines.length ? (
              <span className="num">
                {done}/{lines.length}
              </span>
            ) : (
              t('action.closeOrder')
            )}
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-3 p-4 pb-8">
        {orderNotes.length > 0 && (
          <div className="flex items-start gap-2.5 rounded-2xl bg-[var(--st-waiting-bg)] px-4 py-3 text-[var(--st-waiting-fg)]">
            <MessageSquare size={19} className="mt-0.5 shrink-0" />
            <div className="flex flex-col gap-1">
              {orderNotes.map((n) => (
                <p key={n.id} dir="auto" className="user-text text-[16px] font-medium">
                  {n.body}
                </p>
              ))}
            </div>
          </div>
        )}
        <div className="divide-y divide-[var(--surface-line)] overflow-hidden rounded-group bg-card">
          {lines.map((l) => (
            <div key={l.id} className="flex items-center">
              <button
                type="button"
                disabled={!editable}
                aria-pressed={l.prep !== 'todo'}
                onClick={() => void setPrep(l, l.prep === 'todo' ? 'done' : 'todo')}
                className="flex min-h-[72px] min-w-0 flex-1 items-center gap-3.5 py-2.5 pe-1 ps-4 text-start"
              >
                <PrepCheck prep={l.prep} />
                <span className="min-w-0 flex-1">
                  <span className={clsx('block truncate text-[18px] font-medium', l.prep === 'done' && 'text-fg-muted line-through')}>{loc(l.name, i18n.language)}</span>
                  {l.laboReason && (
                    <span className={clsx('user-text block text-meta font-medium', l.prep === 'not_done' ? 'text-[var(--st-refused-dot)]' : 'text-wood')}>
                      {l.prep === 'partial' && l.preparedQty != null && <bdi dir="ltr">{formatQuantity(l.mode, l.preparedQty, l.packLabel)} · </bdi>}
                      {l.laboReason}
                    </span>
                  )}
                </span>
                <Qty mode={l.mode} qty={l.approved} pack={l.packLabel} className={clsx('text-[19px] font-semibold', l.prep === 'done' && 'text-fg-muted')} />
              </button>
              <div className="flex shrink-0 items-center gap-1.5 pe-3">
                <NoteIcon notes={lineNotes(l)} size={38} />
                {editable && (
                  <IconButton label={t('action.problem')} size={42} tone={l.prep === 'partial' || l.prep === 'not_done' ? 'wood' : 'onLight'} className="!bg-[color-mix(in_srgb,var(--surface-text)_8%,transparent)]" onClick={() => setProblem(l)}>
                    <TriangleAlert size={19} />
                  </IconButton>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <ProblemSheet
        line={problem}
        onClose={() => setProblem(null)}
        onSave={(prep, qty, reason) => {
          if (problem) void setPrep(problem, prep, qty, reason)
          setProblem(null)
          toast(t('labo.problemSaved'))
        }}
      />
    </Screen>
  )
}

function PrepCheck({ prep }: { prep: Prep }) {
  const base = 'grid size-[42px] shrink-0 place-items-center rounded-full transition-transform'
  if (prep === 'done') return <span className={clsx(base, 'bg-sage text-ink')}><Check size={24} strokeWidth={3} /></span>
  if (prep === 'partial') return <span className={clsx(base, 'bg-wood text-white')}><Minus size={24} strokeWidth={3} /></span>
  if (prep === 'not_done') return <span className={clsx(base, 'bg-[var(--st-refused-dot)] text-white')}><X size={24} strokeWidth={3} /></span>
  return <span className={clsx(base, 'shadow-[inset_0_0_0_2.5px_var(--surface-muted)]')} />
}

/** Problem on a line (PRD LAB-5): partial with the prepared quantity, or not prepared; a reason is required. */
function ProblemSheet({ line, onClose, onSave }: { line: OrderLine | null; onClose: () => void; onSave: (prep: Prep, qty: number | null, reason: string) => void }) {
  const { t, i18n } = useTranslation()
  return (
    <Sheet
      open={line !== null}
      onClose={onClose}
      title={line ? t('labo.problemTitle', { name: loc(line.name, i18n.language), qty: formatQuantity(line.mode, line.approved, line.packLabel) }) : ''}
    >
      {line && <ProblemForm key={line.id} line={line} onSave={onSave} />}
    </Sheet>
  )
}

function ProblemForm({ line, onSave }: { line: OrderLine; onSave: (prep: Prep, qty: number | null, reason: string) => void }) {
  const { t } = useTranslation()
  const canPartial = line.approved > line.step
  const [kind, setKind] = useState<'partial' | 'not_done'>(line.prep === 'not_done' || !canPartial ? 'not_done' : 'partial')
  const half = Math.max(line.step, Math.floor(line.approved / 2 / line.step) * line.step)
  const [qty, setQty] = useState(line.preparedQty ?? Math.min(half, line.approved - line.step))
  const presets = t('labo.reasons', { returnObjects: true }) as string[]
  const [preset, setPreset] = useState(line.laboReason && presets.includes(line.laboReason) ? line.laboReason : '')
  const [other, setOther] = useState(line.laboReason && !presets.includes(line.laboReason) ? line.laboReason : '')
  const reason = preset || other.trim()
  return (
    <div className="flex flex-col gap-5 pb-1">
      <div role="radiogroup" className="flex gap-2.5">
        {canPartial && <ChoiceCard selected={kind === 'partial'} onClick={() => setKind('partial')} icon={<TriangleAlert size={24} />} label={t('labo.partial')} />}
        <ChoiceCard selected={kind === 'not_done'} onClick={() => setKind('not_done')} icon={<Ban size={24} />} label={t('labo.notDone')} />
      </div>
      {kind === 'partial' && (
        <div className="flex flex-col gap-2">
          <span className="text-meta font-semibold uppercase tracking-wide text-muted">{t('labo.prepared')}</span>
          <Stepper
            value={
              <span className="num inline-flex items-baseline gap-1.5" dir="ltr">
                {formatQuantity(line.mode, qty, line.packLabel)}
                <span className="text-[16px] font-medium text-muted">/ {formatQuantity(line.mode, line.approved, line.packLabel)}</span>
              </span>
            }
            onDec={() => setQty((q) => Math.max(line.step, q - line.step))}
            onInc={() => setQty((q) => Math.min(line.approved - line.step, q + line.step))}
            canDec={qty > line.step}
            canInc={qty < line.approved - line.step}
          />
        </div>
      )}
      <ReasonChips label={t('labo.other')} options={presets} value={preset} onChange={(v) => (setPreset(v), setOther(''))} />
      <CountedText value={other} onChange={(v) => (setOther(v), setPreset(''))} limit="laboReason" label={t('labo.other')} placeholder={t('labo.other')} rows={2} />
      <Button className="w-full" disabled={!reason} onClick={() => onSave(kind, kind === 'partial' ? qty : null, reason)}>
        {t('action.save')}
      </Button>
    </div>
  )
}
