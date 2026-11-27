/**
 * Time rules (PRD §10): store UTC, display Africa/Algiers, "today" = business day starting at 04:00,
 * which is also the morning/night shift change (04:00 and 16:00).
 */
export const TIME_ZONE = 'Africa/Algiers'
export const BUSINESS_DAY_START_HOUR = 4
export const NIGHT_SHIFT_START_HOUR = 16

export type Team = 'matin' | 'nuit'

interface LocalParts {
  year: string
  month: string
  day: string
  hour: number
}

function localParts(date: Date): LocalParts {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
  return { year: get('year'), month: get('month'), day: get('day'), hour: Number(get('hour')) }
}

/** Business date as YYYY-MM-DD. 02:30 on the 26th belongs to the 25th. Mirrors SQL `business_date()`. */
export function businessDate(at: Date = new Date()): string {
  const shifted = new Date(at.getTime() - BUSINESS_DAY_START_HOUR * 3_600_000)
  const p = localParts(shifted)
  return `${p.year}-${p.month}-${p.day}`
}

/** Default labo team for a moment: 04:00–15:59 morning, otherwise night. */
export function teamAt(at: Date = new Date()): Team {
  const { hour } = localParts(at)
  return hour >= BUSINESS_DAY_START_HOUR && hour < NIGHT_SHIFT_START_HOUR ? 'matin' : 'nuit'
}

/** "14:05" in Algiers time. */
export function formatClock(at: Date | string, locale = 'fr'): string {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-DZ-u-nu-latn' : 'fr-DZ', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(typeof at === 'string' ? new Date(at) : at)
}

/** Whole minutes elapsed since a timestamp (never negative). */
export function minutesSince(at: Date | string, now: Date = new Date()): number {
  const t = typeof at === 'string' ? new Date(at).getTime() : at.getTime()
  return Math.max(0, Math.floor((now.getTime() - t) / 60_000))
}

/** Start of the current shift (the last 04:00 or 16:00 in Algiers time) as a UTC Date. Algiers is UTC+1 all year. */
export function lastShiftStart(at: Date = new Date()): Date {
  const local = new Date(at.getTime() + 3_600_000) // shift to Algiers wall-clock, read with UTC getters
  const h = local.getUTCHours()
  const start = new Date(local)
  start.setUTCMinutes(0, 0, 0)
  if (h >= NIGHT_SHIFT_START_HOUR) start.setUTCHours(NIGHT_SHIFT_START_HOUR)
  else if (h >= BUSINESS_DAY_START_HOUR) start.setUTCHours(BUSINESS_DAY_START_HOUR)
  else {
    start.setUTCDate(start.getUTCDate() - 1)
    start.setUTCHours(NIGHT_SHIFT_START_HOUR)
  }
  return new Date(start.getTime() - 3_600_000)
}

/** True when the labo's active team was confirmed before the current shift started (handover due, PRD LAB-2). */
export function handoverDue(since: string | null, at: Date = new Date()): boolean {
  return !since || new Date(since).getTime() < lastShiftStart(at).getTime()
}
