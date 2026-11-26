/** Business errors shared by both backends. The UI maps `code` to an i18n message (errors.<code>). */
export type DomainErrorCode =
  | 'forbidden'
  | 'not_found'
  | 'invalid_state'
  | 'stale_version'
  | 'locked'
  | 'invalid_quantity'
  | 'product_unavailable'
  | 'empty_order'
  | 'text_too_long'
  | 'reason_required'
  | 'wrong_pin'
  | 'not_signed_in'
  | 'network'

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    public readonly params: Record<string, string> = {},
  ) {
    super(code)
    this.name = 'DomainError'
  }
}

export function isDomainError(e: unknown): e is DomainError {
  return e instanceof DomainError || (typeof e === 'object' && e !== null && (e as { name?: string }).name === 'DomainError')
}

export function errorCode(e: unknown): DomainErrorCode {
  return isDomainError(e) ? e.code : 'network'
}
