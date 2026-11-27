import { useQueryClient } from '@tanstack/react-query'
import { Camera, Plus, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useBackend, useErrorMessage } from '@/app/backend'
import { Button, CountedText, IconButton, ProductArt, Segmented, Sheet, Stepper, Switch, useToast } from '@/components/ui'
import type { Category, Pack, Product, QuantityMode } from '@/domain/types'
import { compressPhoto } from '@/lib/image'
import { loc } from '@/lib/format'
import { formatQuantity } from '@/lib/quantity'
import { queryKeys } from '@/lib/queryKeys'

const STEPS: Record<Exclude<QuantityMode, 'pack'>, number[]> = {
  count: [1, 2, 5, 6, 10, 12, 20, 25, 50, 100],
  weight: [50, 100, 250, 500, 1000, 2000, 5000],
  volume: [250, 500, 1000, 2000, 5000],
}
const DEFAULT_STEP: Record<Exclude<QuantityMode, 'pack'>, number> = { count: 1, weight: 250, volume: 1000 }

/** Create / edit a product (owner only, PRD CAT-2…5). */
export function ProductEditor({ product, categories, onClose }: { product: Product | null; categories: Category[]; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <Sheet open={product !== null} onClose={onClose} title={product?.name.fr ? product.name.fr : t('catalogAdmin.newProduct')}>
      {product && <EditorForm key={product.id} initial={product} categories={categories} onDone={onClose} />}
    </Sheet>
  )
}

function EditorForm({ initial, categories, onDone }: { initial: Product; categories: Category[]; onDone: () => void }) {
  const { t, i18n } = useTranslation()
  const backend = useBackend()
  const qc = useQueryClient()
  const toast = useToast()
  const message = useErrorMessage()
  const [p, setP] = useState<Product>(initial)
  const [busy, setBusy] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP((x) => ({ ...x, [k]: v }))
  const input = 'h-12 w-full rounded-xl border border-line bg-paper px-3.5 text-body text-ink focus:border-sage-deep focus:outline-none'
  const label = 'flex flex-col gap-1.5 text-meta font-medium text-muted'

  const setMode = (mode: QuantityMode) =>
    setP((x) => ({
      ...x,
      mode,
      step: mode === 'pack' ? 1 : DEFAULT_STEP[mode],
      packs: mode === 'pack' && x.packs.length === 0 ? [{ id: crypto.randomUUID(), label: '5 L', active: true }] : x.packs,
    }))

  const onPhoto = async (f: File | undefined) => {
    if (!f) return
    try {
      const blob = await compressPhoto(f)
      const url = await backend.uploadPhoto(p.id, blob)
      set('photo', url)
    } catch {
      toast(t('catalogAdmin.photoError'), 'error')
    }
  }

  const valid = p.name.fr.trim().length > 0 && (p.mode !== 'pack' || p.packs.some((k) => k.label.trim() && k.active))

  const save = async () => {
    setBusy(true)
    try {
      await backend.saveProduct({
        ...p,
        name: { fr: p.name.fr.trim(), ar: p.name.ar.trim() },
        description: { fr: p.description.fr.trim(), ar: p.description.ar.trim() },
        packs: p.mode === 'pack' ? p.packs.filter((k) => k.label.trim()).map((k) => ({ ...k, label: k.label.trim() })) : [],
      })
      await qc.invalidateQueries({ queryKey: queryKeys.catalog() })
      toast(t('catalogAdmin.saved'))
      onDone()
    } catch (e) {
      toast(message(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  const stepList = p.mode === 'pack' ? [] : STEPS[p.mode]
  const stepIdx = Math.max(0, stepList.indexOf(p.step))

  return (
    <div className="flex flex-col gap-5 pb-2">
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => file.current?.click()} className="relative" aria-label={t('catalogAdmin.addPhoto')}>
          <ProductArt photo={p.photo} name={p.name.fr ? p.name : { fr: '?', ar: '?' }} categoryId={p.categoryId} size={84} />
          <span className="absolute -bottom-1 -end-1 grid size-8 place-items-center rounded-full bg-ink text-cream shadow">
            <Camera size={16} />
          </span>
        </button>
        <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => void onPhoto(e.target.files?.[0])} />
        <div className="flex flex-1 items-center justify-between gap-3">
          <span className="text-[15px] font-medium">{t('catalogAdmin.active')}</span>
          <Switch checked={p.active} onChange={(v) => set('active', v)} label={t('catalogAdmin.active')} />
        </div>
      </div>

      <label className={label}>
        {t('catalogAdmin.nameFr')}
        <input id="pe-name-fr" className={input} value={p.name.fr} maxLength={60} onChange={(e) => set('name', { ...p.name, fr: e.target.value })} />
      </label>
      <label className={label}>
        {t('catalogAdmin.nameAr')}
        <input id="pe-name-ar" dir="rtl" className={input} value={p.name.ar} maxLength={60} onChange={(e) => set('name', { ...p.name, ar: e.target.value })} />
      </label>
      <div className={label}>
        {t('catalogAdmin.descFr')}
        <CountedText value={p.description.fr} onChange={(v) => set('description', { ...p.description, fr: v })} limit="productDescription" label={t('catalogAdmin.descFr')} rows={2} />
      </div>
      <div className={label}>
        {t('catalogAdmin.descAr')}
        <CountedText value={p.description.ar} onChange={(v) => set('description', { ...p.description, ar: v })} limit="productDescription" label={t('catalogAdmin.descAr')} rows={2} />
      </div>

      <div className={label}>
        {t('catalogAdmin.category')}
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={p.categoryId === c.id}
              onClick={() => set('categoryId', c.id)}
              className={`h-9 rounded-full px-3.5 text-[14px] font-medium ${p.categoryId === c.id ? 'bg-ink text-cream' : 'bg-paper text-ink'}`}
            >
              {loc(c.name, i18n.language)}
            </button>
          ))}
        </div>
      </div>

      <div className={label}>
        {t('catalogAdmin.type')}
        <Segmented<QuantityMode>
          label={t('catalogAdmin.type')}
          value={p.mode}
          onChange={setMode}
          options={(['count', 'weight', 'volume', 'pack'] as const).map((m) => ({ value: m, label: t(`catalogAdmin.modes.${m}`) }))}
        />
      </div>

      {p.mode !== 'pack' ? (
        <div className={label}>
          {t('catalogAdmin.step')}
          <Stepper
            size="sm"
            value={<bdi dir="ltr">{formatQuantity(p.mode, p.step)}</bdi>}
            onDec={() => set('step', stepList[Math.max(0, stepIdx - 1)] ?? p.step)}
            onInc={() => set('step', stepList[Math.min(stepList.length - 1, stepIdx + 1)] ?? p.step)}
            canDec={stepIdx > 0}
            canInc={stepIdx < stepList.length - 1}
          />
        </div>
      ) : (
        <div className={label}>
          {t('catalogAdmin.packs')}
          <div className="flex flex-col gap-2">
            {p.packs.map((k, i) => (
              <PackRow
                key={k.id}
                pack={k}
                onChange={(next) => set('packs', p.packs.map((x, j) => (j === i ? next : x)))}
                onRemove={initial.packs.some((x) => x.id === k.id) ? undefined : () => set('packs', p.packs.filter((_, j) => j !== i))}
                placeholder={t('catalogAdmin.packPlaceholder')}
              />
            ))}
            <Button variant="tinted" size="md" icon={<Plus size={17} />} onClick={() => set('packs', [...p.packs, { id: crypto.randomUUID(), label: '', active: true }])}>
              {t('catalogAdmin.addPack')}
            </Button>
          </div>
        </div>
      )}

      <Button className="w-full" disabled={!valid} loading={busy} onClick={() => void save()}>
        {t('action.save')}
      </Button>
    </div>
  )
}

/** Existing packs are never deleted (they may be in past orders): they are switched off instead. */
function PackRow({ pack, onChange, onRemove, placeholder }: { pack: Pack; onChange: (p: Pack) => void; onRemove?: () => void; placeholder: string }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-2.5">
      <input
        dir="ltr"
        className="num h-11 min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 text-body text-ink focus:border-sage-deep focus:outline-none"
        value={pack.label}
        maxLength={12}
        placeholder={placeholder}
        aria-label={t('catalogAdmin.packs')}
        onChange={(e) => onChange({ ...pack, label: e.target.value })}
      />
      <Switch checked={pack.active} onChange={(v) => onChange({ ...pack, active: v })} label={pack.label || placeholder} />
      {onRemove && (
        <IconButton label={t('action.remove')} size={40} tone="danger" onClick={onRemove}>
          <Trash2 size={17} />
        </IconButton>
      )}
    </div>
  )
}
