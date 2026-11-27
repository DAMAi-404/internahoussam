import { describe, expect, it } from 'vitest'
import { businessDate, handoverDue, lastShiftStart, minutesSince, teamAt } from './time'

// Algiers is UTC+1 all year (no DST).
const algiers = (iso: string) => new Date(`${iso}+01:00`)

describe('businessDate', () => {
  it('starts the business day at 04:00 Algiers time', () => {
    expect(businessDate(algiers('2026-11-26T03:59:00'))).toBe('2026-11-25')
    expect(businessDate(algiers('2026-11-26T04:00:00'))).toBe('2026-11-26')
    expect(businessDate(algiers('2026-11-26T23:30:00'))).toBe('2026-11-26')
  })
  it('handles month boundaries', () => {
    expect(businessDate(algiers('2026-12-01T02:00:00'))).toBe('2026-11-30')
  })
})

describe('teamAt', () => {
  it('maps 04:00–15:59 to matin and 16:00–03:59 to nuit', () => {
    expect(teamAt(algiers('2026-11-26T04:00:00'))).toBe('matin')
    expect(teamAt(algiers('2026-11-26T15:59:00'))).toBe('matin')
    expect(teamAt(algiers('2026-11-26T16:00:00'))).toBe('nuit')
    expect(teamAt(algiers('2026-11-27T03:59:00'))).toBe('nuit')
  })
})

describe('minutesSince', () => {
  it('never returns a negative value', () => {
    const now = algiers('2026-11-26T10:00:00')
    expect(minutesSince(algiers('2026-11-26T09:45:30'), now)).toBe(14)
    expect(minutesSince(algiers('2026-11-26T10:05:00'), now)).toBe(0)
  })
})


describe('shift boundaries', () => {
  it('returns the last 04:00 or 16:00 Algiers time', () => {
    expect(lastShiftStart(algiers('2026-11-26T10:30:00')).toISOString()).toBe(algiers('2026-11-26T04:00:00').toISOString())
    expect(lastShiftStart(algiers('2026-11-26T16:00:00')).toISOString()).toBe(algiers('2026-11-26T16:00:00').toISOString())
    expect(lastShiftStart(algiers('2026-11-27T02:00:00')).toISOString()).toBe(algiers('2026-11-26T16:00:00').toISOString())
  })
  it('asks for a handover once the shift changes', () => {
    const since = algiers('2026-11-26T05:00:00').toISOString()
    expect(handoverDue(since, algiers('2026-11-26T15:59:00'))).toBe(false)
    expect(handoverDue(since, algiers('2026-11-26T16:01:00'))).toBe(true)
    expect(handoverDue(null)).toBe(true)
  })
})
