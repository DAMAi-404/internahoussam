/**
 * Labo device helpers: what this tablet/phone has already opened, the new-order alarm, and keeping
 * the screen awake (PRD LAB-1, LAB-3). All are per-device on purpose: they don't change any order.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

const SEEN_KEY = 'mahroussa-labo-seen'

type Seen = Record<string, string> // orderId → ISO time the order was last opened on this device

function readSeen(): Seen {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}') as Seen
  } catch {
    return {}
  }
}

/** Orders opened on this device; a note newer than the last opening counts as unread. */
export function useSeen() {
  const [seen, setSeen] = useState<Seen>(readSeen)
  const markSeen = useCallback((orderId: string) => {
    setSeen((s) => {
      const next = { ...s, [orderId]: new Date().toISOString() }
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify(next))
      } catch {
        /* storage blocked: alarm will just keep ringing until reload */
      }
      return next
    })
  }, [])
  return { seen, markSeen }
}

/* ---------------- alarm ---------------- */

let audio: AudioContext | null = null

/** Browsers allow sound only after a tap: the first tap anywhere unlocks it for the session. */
export function unlockAudio(): void {
  try {
    audio ??= new AudioContext()
    if (audio.state === 'suspended') void audio.resume()
  } catch {
    /* no audio on this device */
  }
}

function tone(freq: number, start: number, duration: number) {
  if (!audio) return
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.0001, audio.currentTime + start)
  gain.gain.exponentialRampToValueAtTime(0.35, audio.currentTime + start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + start + duration)
  osc.connect(gain).connect(audio.destination)
  osc.start(audio.currentTime + start)
  osc.stop(audio.currentTime + start + duration + 0.05)
}

/** Two-note chime (owner new order) or three-note alarm (labo). */
export function playChime(kind: 'chime' | 'alarm' | 'tone' = 'chime'): void {
  if (!audio || audio.state !== 'running') return
  if (kind === 'tone') return tone(880, 0, 0.18)
  tone(660, 0, 0.22)
  tone(880, 0.18, 0.3)
  if (kind === 'alarm') tone(990, 0.42, 0.35)
  navigator.vibrate?.([120, 80, 120])
}

/** Repeats the alarm every 10 s while `active` (new orders not opened yet). */
export function useAlarm(active: boolean): void {
  useEffect(() => {
    const onTap = () => unlockAudio()
    window.addEventListener('pointerdown', onTap)
    return () => window.removeEventListener('pointerdown', onTap)
  }, [])
  useEffect(() => {
    if (!active) return
    playChime('alarm')
    const timer = window.setInterval(() => playChime('alarm'), 10_000)
    return () => clearInterval(timer)
  }, [active])
}

/* ---------------- wake lock ---------------- */

/** Keeps the labo screen on while the app is visible; silently does nothing where unsupported. */
export function useWakeLock(): void {
  const lock = useRef<WakeLockSentinel | null>(null)
  useEffect(() => {
    const request = async () => {
      try {
        if (document.visibilityState === 'visible' && 'wakeLock' in navigator) lock.current = await navigator.wakeLock.request('screen')
      } catch {
        /* refused (battery saver, iframe): the screen may sleep */
      }
    }
    void request()
    const onVisible = () => void request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      void lock.current?.release().catch(() => undefined)
    }
  }, [])
}
