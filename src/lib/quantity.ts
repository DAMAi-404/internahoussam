/**
 * Quantities are integers in base units (PRD §7):
 *   count → pieces · weight → grams · volume → millilitres · pack → number of packs.
 * This is the ONLY place that formats or validates them. No floats anywhere.
 */
export type QuantityMode = 'count' | 'weight' | 'volume' | 'pack'

export interface QuantityRule {
  mode: QuantityMode
  /** Owner-defined step, also the minimum. Always 1 for packs. */
  step: number
  max?: number | null
}

/** Formats an integer of thousandths as "1,25" without floating-point maths. */
function thousandths(value: number): string {
  const whole = Math.trunc(value / 1000)
  const rest = value % 1000
  if (rest === 0) return String(whole)
  const decimals = String(rest).padStart(3, '0').replace(/0+$/, '')
  return `${whole},${decimals}`
}

/** "150", "250 g", "1,5 kg", "500 ml", "2 L", "10 L × 3". */
export function formatQuantity(mode: QuantityMode, qty: number, packLabel?: string | null): string {
  assertInteger(qty)
  switch (mode) {
    case 'count':
      return String(qty)
    case 'weight':
      return qty >= 1000 ? `${thousandths(qty)} kg` : `${qty} g`
    case 'volume':
      return qty >= 1000 ? `${thousandths(qty)} L` : `${qty} ml`
    case 'pack':
      return `${packLabel ?? ''} × ${qty}`.trim()
  }
}

export function effectiveStep(rule: QuantityRule): number {
  return rule.mode === 'pack' ? 1 : rule.step
}

/** True when qty is a positive integer multiple of the step and within max. Mirrors the SQL check in submit_order. */
export function isValidQuantity(rule: QuantityRule, qty: number): boolean {
  const step = effectiveStep(rule)
  return (
    Number.isInteger(qty) &&
    qty >= step &&
    qty % step === 0 &&
    (rule.max == null || qty <= rule.max)
  )
}

/** Next value after pressing + (direction 1) or − (direction -1). Returns 0 when − goes below the minimum (= remove). */
export function stepQuantity(rule: QuantityRule, qty: number, direction: 1 | -1): number {
  const step = effectiveStep(rule)
  const next = qty + direction * step
  if (next < step) return 0
  if (rule.max != null && next > rule.max) return qty
  return next
}

/** Reviewer reduce stepper: between one step and the requested quantity. */
export function clampReduced(rule: QuantityRule, requested: number, value: number): number {
  const step = effectiveStep(rule)
  return Math.min(requested, Math.max(step, value))
}

function assertInteger(qty: number): void {
  if (!Number.isInteger(qty) || qty < 0) {
    throw new RangeError(`Quantity must be a non-negative integer in base units, got ${qty}`)
  }
}
