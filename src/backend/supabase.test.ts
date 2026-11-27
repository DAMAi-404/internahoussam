import { describe, expect, it } from 'vitest'
import { shopEmail, toDomainError } from './supabase'

describe('supabase error mapping', () => {
  it('turns RPC business errors into domain errors with params', () => {
    const e = toDomainError({ code: 'P0001', message: 'locked', details: '{"by":"Patron"}' })
    expect(e.code).toBe('locked')
    expect(e.params).toEqual({ by: 'Patron' })
  })
  it('maps permission, auth and constraint errors', () => {
    expect(toDomainError({ code: '42501', message: 'permission denied' }).code).toBe('forbidden')
    expect(toDomainError({ status: 401, message: 'JWT expired' }).code).toBe('not_signed_in')
    expect(toDomainError({ code: '23514', message: 'check violation' }).code).toBe('invalid_state')
  })
  it('treats anything unknown as a network problem (retried by the outbox)', () => {
    expect(toDomainError({ message: 'TypeError: Failed to fetch' }).code).toBe('network')
    expect(toDomainError({ code: 'P0001', message: 'unexpected_code' }).code).toBe('network')
  })
  it('derives the shop login from the shop id', () => {
    expect(shopEmail('kouba')).toBe('shop-kouba@accounts.mahroussa.app')
  })
})
