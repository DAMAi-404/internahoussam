import { describe, expect, it } from 'vitest'
import { clampReduced, formatQuantity, isValidQuantity, stepQuantity } from './quantity'

describe('formatQuantity', () => {
  it('formats each mode from integer base units', () => {
    expect(formatQuantity('count', 150)).toBe('150')
    expect(formatQuantity('weight', 250)).toBe('250 g')
    expect(formatQuantity('weight', 1000)).toBe('1 kg')
    expect(formatQuantity('weight', 1250)).toBe('1,25 kg')
    expect(formatQuantity('weight', 1050)).toBe('1,05 kg')
    expect(formatQuantity('volume', 500)).toBe('500 ml')
    expect(formatQuantity('volume', 1500)).toBe('1,5 L')
    expect(formatQuantity('pack', 3, '10 L')).toBe('10 L × 3')
  })

  it('rejects floats and negatives', () => {
    expect(() => formatQuantity('weight', 0.25)).toThrow(RangeError)
    expect(() => formatQuantity('count', -1)).toThrow(RangeError)
  })
})

describe('isValidQuantity', () => {
  const pistache = { mode: 'weight' as const, step: 250 }
  it('accepts multiples of the step', () => {
    expect(isValidQuantity(pistache, 250)).toBe(true)
    expect(isValidQuantity(pistache, 1000)).toBe(true)
  })
  it('rejects zero, off-step and over-max values', () => {
    expect(isValidQuantity(pistache, 0)).toBe(false)
    expect(isValidQuantity(pistache, 300)).toBe(false)
    expect(isValidQuantity({ ...pistache, max: 2000 }, 2250)).toBe(false)
  })
  it('uses a step of 1 for packs whatever is stored', () => {
    expect(isValidQuantity({ mode: 'pack', step: 5 }, 3)).toBe(true)
  })
})

describe('stepQuantity', () => {
  const cornet = { mode: 'count' as const, step: 10 }
  it('adds and removes one step', () => {
    expect(stepQuantity(cornet, 0, 1)).toBe(10)
    expect(stepQuantity(cornet, 150, 1)).toBe(160)
    expect(stepQuantity(cornet, 150, -1)).toBe(140)
  })
  it('returns 0 (remove) below the minimum and stops at max', () => {
    expect(stepQuantity(cornet, 10, -1)).toBe(0)
    expect(stepQuantity({ ...cornet, max: 200 }, 200, 1)).toBe(200)
  })
})

describe('clampReduced', () => {
  it('never exceeds the request nor goes below one step', () => {
    const rule = { mode: 'count' as const, step: 10 }
    expect(clampReduced(rule, 200, 250)).toBe(200)
    expect(clampReduced(rule, 200, 0)).toBe(10)
  })
})
