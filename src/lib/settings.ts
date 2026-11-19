import type { Accidentals } from './music'
import { DEFAULT_TUNING_ID, findTuning } from './tunings'

export type Mode = 'instrument' | 'chromatic'
export type Response = 'fast' | 'balanced' | 'stable'

export interface Settings {
  mode: Mode
  tuningId: string
  /** Reference pitch for A4 in Hz. */
  a4: number
  /** 1 (only loud, clean notes) .. 10 (picks up quiet notes, more noise). */
  sensitivity: number
  /** ± cents counted as "in tune". */
  tolerance: number
  response: Response
  accidentals: Accidentals
  keepAwake: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  mode: 'instrument',
  tuningId: DEFAULT_TUNING_ID,
  a4: 440,
  sensitivity: 6,
  tolerance: 3,
  response: 'balanced',
  accidentals: 'sharps',
  keepAwake: true,
}

export const A4_MIN = 415
export const A4_MAX = 466
export const TOLERANCES = [2, 3, 5, 10]

/** Input level (dBFS) a note must reach before it is analysed. */
export function gateDb(sensitivity: number): number {
  return -28 - (sensitivity - 1) * 4 // 1 → -28 dB, 10 → -64 dB
}

/** Minimum pitch clarity accepted; higher sensitivity accepts messier signals. */
export function minClarity(sensitivity: number): number {
  return 0.93 - sensitivity * 0.015 // 1 → 0.915, 10 → 0.78
}

/** How many recent readings are median-filtered. */
export function smoothingWindow(response: Response): number {
  return response === 'fast' ? 3 : response === 'stable' ? 9 : 5
}

const STORAGE_KEY = 'tuner.settings.v1'

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const s = { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) }
    // Sanitise anything that might be stale or hand-edited.
    s.tuningId = findTuning(s.tuningId).tuning.id
    s.a4 = clamp(Math.round(Number(s.a4) || 440), A4_MIN, A4_MAX)
    s.sensitivity = clamp(Math.round(Number(s.sensitivity) || 6), 1, 10)
    if (!TOLERANCES.includes(s.tolerance)) s.tolerance = DEFAULT_SETTINGS.tolerance
    if (!['fast', 'balanced', 'stable'].includes(s.response)) s.response = DEFAULT_SETTINGS.response
    if (s.mode !== 'chromatic') s.mode = 'instrument'
    if (s.accidentals !== 'flats') s.accidentals = 'sharps'
    s.keepAwake = s.keepAwake !== false
    return s
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Private mode or storage disabled: settings just won't persist.
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}
