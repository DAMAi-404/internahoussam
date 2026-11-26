/**
 * Text length limits (PRD NOTE-1, CAT-2). Mirrored by CHECK constraints in SQL:
 * change both together.
 */
export const LIMITS = {
  productDescription: 80,
  lineNote: 80,
  orderNote: 160,
  laboReason: 80,
} as const

export type LimitKey = keyof typeof LIMITS

/** Cuts text to the limit, counting user-perceived characters (Arabic and emoji safe). */
export function clampText(text: string, key: LimitKey): string {
  const chars = Array.from(text)
  return chars.length <= LIMITS[key] ? text : chars.slice(0, LIMITS[key]).join('')
}

export function textLength(text: string): number {
  return Array.from(text).length
}

/** Counter turns to the warning colour in the last 10%. */
export function isNearLimit(text: string, key: LimitKey): boolean {
  return textLength(text) >= Math.floor(LIMITS[key] * 0.9)
}
