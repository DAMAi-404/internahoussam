import { Ban, MessageSquare, Moon, Share2, Sun } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useAction, useShopName } from '@/app/backend'
import { ConfirmSheet, Group, Header, IconButton, LineRow, LineStateIcon, NoteIcon, NoteSheet, Qty, Screen, StatusPill, Steps, useToast, type BubbleNote } from '@/components/ui'
import type { Order, OrderLine } from '@/domain/types'
import { stepIndex } from '@/features/tracking/OrderDetailScreen'
import { loc, orderShareText, shareOrCopy } from '@/lib/format'
import { formatClock } from '@/lib/time'

/** Owner/deputy view of a sent order: lines with labo outcome, notes, full event timeline (PRD FOL-3, OWN-6). */
export function OrderFollowScreen({ order: o }: { order: Order }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const toast = useToast()
  const shopName = useShopName()
  const [noting, setNoting] = useState<OrderLine | 'order' | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const canNote = o.status === 'validated' || o.status === 'in_preparation'
  const addNote = useAction((b, a: { lineId: string | null; body: string }) => b.addNote(o.id, a.lineId, a.body), { success: t('followup.noteAdded') })
  const cancel = useAction((b) => b.cancelOrder(o.id, o.version), { success: t('followup2.cancelled') })

  const notesFor = (lineId: string | null): BubbleNote[] =>
    o.notes.filter((n) => n.lineId === lineId).map((n) => ({ id: n.id, author: n.author.name, at: n.at, body: n.body }))

  return (
    <Screen
      header={
        <Header
          title={shopName(o.shopId)}
          eyebrow={<span className="num">{o.code}</span>}
          onBack={() => navigate(-1)}
          actions={
            <>
              <IconButton
                label={t('action.share')}
                tone="onDark"
                onClick={() => void shareOrCopy(orderShareText(o, shopName(o.shopId), i18n.language)).then((r) => r === 'copied' && toast(t('stats.recapCopied')))}
              >
                <Share2 size={19} />
              </IconButton>
              {canNote && (
                <IconButton label={t('followup2.addNote')} tone="onDark" onClick={() => setNoting('order')}>
                  <MessageSquare size={19} />
                </IconButton>
              )}
              {o.status === 'validated' && (
                <IconButton label={t('followup2.cancel')} tone="onDark" onClick={() => setCancelling(true)}>
                  <Ban size={19} />
                </IconButton>
              )}
            </>
          }
        >
          <div className="flex items-center gap-2">
            <StatusPill status={o.status} />
            {o.team && (
              <span className="inline-flex items-center gap-1 text-meta text-[var(--header-fg)] opacity-80">
                {o.team === 'nuit' ? <Moon size={14} /> : <Sun size={14} />}
                {t(`team.${o.team}`)}
              </span>
            )}
          </div>
        </Header>
      }
    >
      <div className="flex flex-col gap-3 p-4 pb-8">
        {stepIndex(o) >= 0 && (
          <Group>
            <Steps current={stepIndex(o)} times={[o.at.submitted, o.at.validated, o.at.prepStarted, o.at.ready]} />
          </Group>
        )}
        {notesFor(null).length > 0 && (
          <div className="flex items-center gap-2 px-1 text-meta text-fg-muted">
            <NoteIcon notes={notesFor(null)} size={32} />
            {t('review.noteForLabo')}
          </div>
        )}
        <Group>
          {o.lines.map((l) => {
            const refused = l.decision === 'refused'
            const shown = refused ? l.requested : l.prep === 'partial' && l.preparedQty != null ? l.preparedQty : l.approved
            return (
              <LineRow
                key={l.id}
                lead={<LineStateIcon line={l} />}
                name={loc(l.name, i18n.language)}
                struck={refused}
                tint={refused ? 'refused' : undefined}
                sub={
                  refused ? (
                    <span className="text-[var(--st-refused-fg)]">{l.refusalReason}</span>
                  ) : l.laboReason ? (
                    <span className={l.prep === 'not_done' ? 'text-[var(--st-refused-fg)]' : 'text-[var(--st-waiting-fg)]'}>{l.laboReason}</span>
                  ) : undefined
                }
                qty={
                  <>
                    <Qty mode={l.mode} qty={shown} pack={l.packLabel} />
                    {!refused && shown !== l.requested && <Qty mode={l.mode} qty={l.requested} pack={l.packLabel} struck />}
                  </>
                }
                trailing={
                  <>
                    <NoteIcon notes={notesFor(l.id)} size={34} />
                    {canNote && !refused && (
                      <IconButton label={t('followup2.addNote')} size={36} onClick={() => setNoting(l)}>
                        <MessageSquare size={16} />
                      </IconButton>
                    )}
                  </>
                }
              />
            )
          })}
        </Group>

        <h2 className="mt-2 px-1 text-meta font-semibold uppercase tracking-wide text-fg-muted">{t('followup.timeline')}</h2>
        <ol className="flex flex-col rounded-group bg-card px-4 py-2">
          {[...o.events].reverse().map((e) => (
            <li key={e.id} className="flex items-center gap-3 border-b border-line py-2.5 text-[14px] last:border-0">
              <span className="num w-11 shrink-0 text-meta text-fg-muted">{formatClock(e.at, i18n.language)}</span>
              <span className="min-w-0 flex-1 truncate font-medium">{t(`events.${e.type}`)}</span>
              <span className="inline-flex shrink-0 items-center gap-1 text-meta text-fg-muted">
                {e.actor.team === 'nuit' ? <Moon size={13} /> : e.actor.team === 'matin' ? <Sun size={13} /> : null}
                {e.actor.role === 'shop' ? shopName(o.shopId) : e.actor.name}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <NoteSheet
        open={noting !== null}
        onClose={() => setNoting(null)}
        title={noting === 'order' || noting === null ? t('review.noteForLabo') : loc(noting.name, i18n.language)}
        limit={noting === 'order' ? 'orderNote' : 'lineNote'}
        saving={addNote.isPending}
        onSave={(body) => {
          if (!body || !noting) return setNoting(null)
          addNote.mutate({ lineId: noting === 'order' ? null : noting.id, body }, { onSuccess: () => setNoting(null) })
        }}
      />
      <ConfirmSheet
        open={cancelling}
        onClose={() => setCancelling(false)}
        title={t('followup2.cancelConfirm')}
        confirmLabel={t('followup2.cancel')}
        busy={cancel.isPending}
        onConfirm={() => cancel.mutate(undefined, { onSettled: () => setCancelling(false) })}
      />
    </Screen>
  )
}
