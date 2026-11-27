import { Check, MessageSquare, Moon, Pencil, Share2, Sun, Undo2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useAction, useBackend, useErrorMessage, useShopName } from '@/app/backend'
import {
  Button,
  CountedText,
  Group,
  Header,
  IconButton,
  LineRow,
  NoteIcon,
  NoteSheet,
  Qty,
  ReasonChips,
  Screen,
  Segmented,
  Sheet,
  Stepper,
  useToast,
} from '@/components/ui'
import type { Order, OrderLine, ReviewDecision, Team } from '@/domain/types'
import { ago, loc, orderShareText, shareOrCopy } from '@/lib/format'
import { teamAt } from '@/lib/time'

interface Draft {
  approved: number
  refused: boolean
  reason: string
  note: string
}

const fresh = (l: OrderLine): Draft => ({ approved: l.requested, refused: false, reason: '', note: '' })

/**
 * Review (PRD OWN-2…7): every line accepted by default; pen = reduce, note = for the labo, × = refuse.
 * The draft is kept per line id, so a shop edit only resets the lines it changed (they get new ids).
 */
export function ReviewScreen({ order: o }: { order: Order }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const backend = useBackend()
  const toast = useToast()
  const message = useErrorMessage()
  const shopName = useShopName()
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [editing, setEditing] = useState<string | null>(null)
  const [refusing, setRefusing] = useState<OrderLine | null>(null)
  const [noting, setNoting] = useState<OrderLine | 'order' | null>(null)
  const [labNote, setLabNote] = useState('')
  const [team, setTeam] = useState<Team>(() => teamAt())
  const decided = useRef(false)

  // Take the review lock on open, release it when leaving without sending (PRD OWN-2).
  useEffect(() => {
    let cancelled = false
    backend.startReview(o.id).catch((e) => {
      if (cancelled) return
      toast(message(e), 'error')
      navigate('/owner', { replace: true })
    })
    return () => {
      cancelled = true
      if (!decided.current) void backend.releaseReview(o.id).catch(() => undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lock once per order id
  }, [o.id])

  const draftOf = (l: OrderLine) => drafts[l.id] ?? fresh(l)
  const patch = (l: OrderLine, p: Partial<Draft>) => setDrafts((d) => ({ ...d, [l.id]: { ...draftOf(l), ...p } }))
  const allRefused = o.lines.every((l) => draftOf(l).refused)

  const decide = useAction(
    (b) => {
      const decisions: ReviewDecision[] = o.lines.map((l) => {
        const d = draftOf(l)
        return d.refused
          ? { lineId: l.id, decision: 'refused', approved: 0, refusalReason: d.reason, note: null }
          : { lineId: l.id, decision: d.approved < l.requested ? 'reduced' : 'accepted', approved: d.approved, refusalReason: null, note: d.note || null }
      })
      return b.decideOrder(o.id, o.version, decisions, labNote.trim(), team)
    },
    { success: allRefused ? t('review.refused') : t('review.sent') },
  )

  const summary = useMemo(() => {
    let reduced = 0
    let refused = 0
    for (const l of o.lines) {
      const d = drafts[l.id]
      if (d?.refused) refused++
      else if (d && d.approved < l.requested) reduced++
    }
    return { reduced, refused, kept: o.lines.length - refused }
  }, [drafts, o.lines])

  return (
    <Screen
      header={
        <Header
          title={shopName(o.shopId)}
          eyebrow={
            <span className="num">
              {o.code} · {ago(o.at.submitted, t)}
            </span>
          }
          onBack={() => navigate('/owner')}
          actions={
            <IconButton
              label={t('action.share')}
              tone="onDark"
              onClick={() => void shareOrCopy(orderShareText(o, shopName(o.shopId), i18n.language)).then((r) => r === 'copied' && toast(t('stats.recapCopied')))}
            >
              <Share2 size={19} />
            </IconButton>
          }
        />
      }
      footer={
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex-1">
              <Segmented<Team>
                label={t('review.team')}
                value={team}
                onChange={setTeam}
                options={[
                  { value: 'matin', label: <><Sun size={17} />{t('team.matin')}</> },
                  { value: 'nuit', label: <><Moon size={17} />{t('team.nuit')}</> },
                ]}
              />
            </div>
            <IconButton label={t('review.noteForLabo')} size={48} tone={labNote ? 'wood' : 'onLight'} onClick={() => setNoting('order')}>
              <MessageSquare size={20} />
            </IconButton>
          </div>
          <Button
            className="w-full"
            variant={allRefused ? 'danger' : 'primary'}
            loading={decide.isPending}
            onClick={() =>
              decide.mutate(undefined, {
                onSuccess: () => {
                  decided.current = true
                  navigate('/owner', { replace: true })
                },
              })
            }
          >
            {allRefused ? t('action.refuseOrder') : t('action.sendToLabo')}
            {!allRefused && (summary.reduced > 0 || summary.refused > 0) && (
              <span className="num opacity-75">
                · {summary.kept}/{o.lines.length}
              </span>
            )}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3 p-4">
        {o.editedDuringReview && (
          <div className="flex items-center gap-2.5 rounded-2xl bg-sage px-4 py-3 text-[15px] font-medium text-ink">
            <Pencil size={17} />
            {t('review.edited')}
          </div>
        )}
        {o.shopNote && (
          <div className="flex items-start gap-2.5 rounded-2xl bg-[var(--st-waiting-bg)] px-4 py-3 text-[var(--st-waiting-fg)]">
            <MessageSquare size={18} className="mt-0.5 shrink-0" />
            <p dir="auto" className="user-text text-[15px]">
              {o.shopNote}
            </p>
          </div>
        )}

        <Group>
          {o.lines.map((l) => {
            const d = draftOf(l)
            const reduced = !d.refused && d.approved < l.requested
            return (
              <div key={l.id}>
                <LineRow
                  name={loc(l.name, i18n.language)}
                  struck={d.refused}
                  tint={d.refused ? 'refused' : l.changedByShop ? 'changed' : undefined}
                  sub={d.refused ? <span className="font-medium text-[var(--st-refused-fg)]">{d.reason}</span> : undefined}
                  qty={
                    <>
                      <Qty mode={l.mode} qty={d.refused ? l.requested : d.approved} pack={l.packLabel} className={reduced ? 'text-[var(--st-waiting-fg)]' : d.refused ? 'text-fg-muted' : undefined} />
                      {reduced && <Qty mode={l.mode} qty={l.requested} pack={l.packLabel} struck />}
                    </>
                  }
                  trailing={
                    editing === l.id ? (
                      <IconButton label={t('review.reduceDone')} tone="solid" size={36} onClick={() => setEditing(null)}>
                        <Check size={17} />
                      </IconButton>
                    ) : d.refused ? (
                      <IconButton label={t('action.undo')} size={36} onClick={() => patch(l, { refused: false, reason: '' })}>
                        <Undo2 size={17} />
                      </IconButton>
                    ) : (
                      <>
                        {l.requested > l.step && (
                          <IconButton label={t('action.reduce')} size={36} onClick={() => setEditing(l.id)}>
                            <Pencil size={16} />
                          </IconButton>
                        )}
                        <IconButton label={t('review.noteForLabo')} size={36} tone={d.note ? 'wood' : 'onLight'} onClick={() => setNoting(l)}>
                          <MessageSquare size={16} />
                        </IconButton>
                        <IconButton label={t('action.refuse')} size={36} onClick={() => setRefusing(l)}>
                          <X size={17} />
                        </IconButton>
                      </>
                    )
                  }
                />
                {editing === l.id && (
                  <div className="px-4 pb-3">
                    <Stepper
                      size="sm"
                      value={<Qty mode={l.mode} qty={d.approved} pack={l.packLabel} />}
                      onDec={() => patch(l, { approved: Math.max(l.step, draftOf(l).approved - l.step) })}
                      onInc={() => patch(l, { approved: Math.min(l.requested, draftOf(l).approved + l.step) })}
                      canDec={d.approved > l.step}
                      canInc={d.approved < l.requested}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </Group>
        {labNote && (
          <div className="flex items-center gap-2 px-1 text-meta text-fg-muted">
            <NoteIcon notes={[{ id: 'lab', author: t('review.noteForLabo'), at: new Date().toISOString(), body: labNote }]} size={30} />
            {t('review.noteForLabo')}
          </div>
        )}
      </div>

      <RefuseSheet
        line={refusing}
        onClose={() => setRefusing(null)}
        onConfirm={(reason) => {
          if (refusing) patch(refusing, { refused: true, reason })
          setRefusing(null)
          setEditing(null)
        }}
      />
      <NoteSheet
        open={noting !== null}
        onClose={() => setNoting(null)}
        title={noting === 'order' || noting === null ? t('review.noteForLabo') : loc(noting.name, i18n.language)}
        limit={noting === 'order' ? 'orderNote' : 'lineNote'}
        initial={noting === 'order' ? labNote : noting ? draftOf(noting).note : ''}
        onSave={(text) => {
          if (noting === 'order') setLabNote(text)
          else if (noting) patch(noting, { note: text })
          setNoting(null)
        }}
      />
    </Screen>
  )
}

function RefuseSheet({ line, onClose, onConfirm }: { line: OrderLine | null; onClose: () => void; onConfirm: (reason: string) => void }) {
  const { t, i18n } = useTranslation()
  return (
    <Sheet open={line !== null} onClose={onClose} title={line ? t('review.refuseTitle', { name: loc(line.name, i18n.language) }) : ''}>
      {line && <RefuseForm onConfirm={onConfirm} />}
    </Sheet>
  )
}

function RefuseForm({ onConfirm }: { onConfirm: (reason: string) => void }) {
  const { t } = useTranslation()
  const [preset, setPreset] = useState('')
  const [other, setOther] = useState('')
  const reason = preset || other.trim()
  return (
    <div className="flex flex-col gap-4">
      <ReasonChips label={t('review.other')} options={t('review.reasons', { returnObjects: true }) as string[]} value={preset} onChange={(v) => (setPreset(v), setOther(''))} />
      <CountedText value={other} onChange={(v) => (setOther(v), setPreset(''))} limit="lineNote" label={t('review.other')} placeholder={t('review.other')} rows={2} />
      <Button variant="danger" className="w-full" disabled={!reason} icon={<X size={18} />} onClick={() => onConfirm(reason)}>
        {t('action.refuse')}
      </Button>
    </div>
  )
}
