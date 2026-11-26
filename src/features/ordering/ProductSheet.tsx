import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, IconButton, ProductArt, Qty, Segmented, Sheet, Stepper } from '@/components/ui'
import type { Product } from '@/domain/types'
import { loc } from '@/lib/format'
import { stepQuantity } from '@/lib/quantity'
import { cartQty, useCart } from './cart'

/**
 * Product sheet (PRD SHP-5): photo, name, short description, the quantity control for its type.
 * The form remounts for each product so its state always starts from the cart.
 */
export function ProductSheet({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  return (
    <Sheet open={product !== null} onClose={onClose} title={product ? loc(product.name, i18n.language) : t('catalog.title')}>
      {product && <ProductForm key={product.id} product={product} onDone={onClose} />}
    </Sheet>
  )
}

function ProductForm({ product, onDone }: { product: Product; onDone: () => void }) {
  const { t, i18n } = useTranslation()
  const lines = useCart((s) => s.lines)
  const setQty = useCart((s) => s.setQty)
  const isPack = product.mode === 'pack'
  const packs = product.packs.filter((k) => k.active)
  const firstPack = packs.find((k) => cartQty(lines, product.id, k.id) > 0) ?? packs[0]
  const [packId, setPackId] = useState<string | null>(isPack ? (firstPack?.id ?? null) : null)
  const inCartQty = cartQty(lines, product.id, packId)
  const rule = { mode: product.mode, step: product.step, max: product.max }
  const minStep = isPack ? 1 : product.step
  const [qty, setLocal] = useState(inCartQty || minStep)
  const pack = packs.find((k) => k.id === packId)
  const description = loc(product.description, i18n.language)

  const choosePack = (id: string) => {
    setPackId(id)
    setLocal(cartQty(lines, product.id, id) || 1)
  }

  const confirm = () => {
    setQty(product.id, packId, qty)
    navigator.vibrate?.(10)
    onDone()
  }

  return (
    <div className="flex flex-col gap-5 pb-1">
      <div className="flex items-center gap-3.5">
        <ProductArt photo={product.photo} name={product.name} categoryId={product.categoryId} size={72} />
        {description && <p className="user-text min-w-0 flex-1 text-[15px] leading-snug text-muted">{description}</p>}
      </div>

      {isPack && packs.length > 1 && (
        <Segmented
          size="lg"
          label={t('action.add')}
          value={packId ?? ''}
          onChange={choosePack}
          options={packs.map((k) => {
            const n = cartQty(lines, product.id, k.id)
            return {
              value: k.id,
              label: (
                <span className="flex items-center gap-1.5">
                  <bdi dir="ltr" className="num">
                    {k.label}
                  </bdi>
                  {n > 0 && <span className="num rounded-full bg-sage-deep px-1.5 text-[12px] text-cream">{n}</span>}
                </span>
              ),
            }
          })}
        />
      )}

      <Stepper
        value={isPack ? <bdi dir="ltr">{qty}</bdi> : <Qty mode={product.mode} qty={qty} />}
        onDec={() => setLocal((q) => Math.max(minStep, stepQuantity(rule, q, -1) || minStep))}
        onInc={() => setLocal((q) => stepQuantity(rule, q, 1))}
        canDec={qty > minStep}
        canInc={product.max == null || qty + minStep <= product.max}
      />

      <div className="flex items-center gap-2.5">
        {inCartQty > 0 && (
          <IconButton
            label={t('action.remove')}
            tone="danger"
            size={48}
            onClick={() => {
              setQty(product.id, packId, 0)
              onDone()
            }}
          >
            <Trash2 size={20} />
          </IconButton>
        )}
        <Button className="flex-1" onClick={confirm}>
          {inCartQty > 0 ? t('action.update') : t('action.add')} ·{' '}
          <Qty mode={product.mode} qty={qty} pack={pack?.label} className="font-semibold" />
        </Button>
      </div>
    </div>
  )
}
