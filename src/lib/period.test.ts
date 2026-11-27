import { describe, expect, it } from 'vitest'
import { isoWeek, periodOf, shiftPeriod } from './period'

describe('periods', () => {
  it('builds Monday–Sunday weeks and full months', () => {
    expect(periodOf('week', '2026-11-26')).toMatchObject({ from: '2026-11-23', to: '2026-11-29' })
    expect(periodOf('week', '2026-11-23')).toMatchObject({ from: '2026-11-23', to: '2026-11-29' })
    expect(periodOf('week', '2026-11-29')).toMatchObject({ from: '2026-11-23', to: '2026-11-29' })
    expect(periodOf('month', '2026-02-10')).toMatchObject({ from: '2026-02-01', to: '2026-02-28' })
    expect(periodOf('month', '2028-02-10')).toMatchObject({ from: '2028-02-01', to: '2028-02-29' })
  })

  it('moves across month and year boundaries', () => {
    expect(shiftPeriod(periodOf('day', '2026-12-31'), 1).from).toBe('2027-01-01')
    expect(shiftPeriod(periodOf('month', '2026-01-15'), -1)).toMatchObject({ from: '2025-12-01', to: '2025-12-31' })
    expect(shiftPeriod(periodOf('week', '2026-12-30'), 1).from).toBe('2027-01-04')
  })

  it('computes ISO week numbers', () => {
    expect(isoWeek('2026-11-26')).toBe(48)
    expect(isoWeek('2027-01-01')).toBe(53)
    expect(isoWeek('2027-01-04')).toBe(1)
  })
})
