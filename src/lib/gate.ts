/**
 * Decides which pitch readings count as a note. Kept free of imports so it can be unit-tested
 * directly with Node.
 */

/** Input level (dBFS, after the analysis low-pass) a new note must reach. */
export function gateDb(sensitivity: number): number {
  return -35 - ((sensitivity - 1) * 50) / 9 // 1 → -35 dB, 10 → -85 dB
}

/** Minimum pitch clarity for a new note; higher sensitivity accepts messier signals. */
export function minClarity(sensitivity: number): number {
  return 0.9 - ((sensitivity - 1) * 0.2) / 9 // 1 → 0.90, 10 → 0.70
}

/**
 * While a note is ringing, keep following it with a lower bar as long as the pitch stays this
 * close to it. Noise produces readings that jump around, so it can't sneak through this way.
 */
export const SUSTAIN_CENTS = 60
export const SUSTAIN_EXTRA_DB = 12
export const SUSTAIN_MIN_CLARITY = 0.45

export interface Reading {
  freq: number
  clarity: number
  /** Level in dBFS. */
  level: number
}

/**
 * @param tracking frequency of the note currently being followed, or null when none.
 */
export function accepts(r: Reading, sensitivity: number, tracking: number | null): boolean {
  if (r.freq <= 0) return false
  if (r.level >= gateDb(sensitivity) && r.clarity >= minClarity(sensitivity)) return true
  if (tracking === null) return false
  const near = Math.abs(1200 * Math.log2(r.freq / tracking)) <= SUSTAIN_CENTS
  return near && r.level >= gateDb(sensitivity) - SUSTAIN_EXTRA_DB && r.clarity >= SUSTAIN_MIN_CLARITY
}
