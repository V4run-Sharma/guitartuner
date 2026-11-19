/**
 * Decides which pitch readings count as a note. Kept free of imports so it can be unit-tested
 * directly with Node.
 */

/** Input level (dBFS, after the analysis low-pass) a new note must reach. */
export function gateDb(sensitivity: number): number {
  return -40 - ((sensitivity - 1) * 55) / 9 // 1 → -40 dB, 10 → -95 dB
}

/** Minimum pitch clarity for a new note; higher sensitivity accepts messier signals. */
export function minClarity(sensitivity: number): number {
  return 0.9 - ((sensitivity - 1) * 0.25) / 9 // 1 → 0.90, 10 → 0.65
}

/**
 * While a note is ringing, keep following it with a much lower bar. The worklet's guided search
 * only looks within ±40 cents of that note, where noise rarely produces a peak, so a faint
 * string can still be read reliably.
 */
export const SUSTAIN_EXTRA_DB = 25
export const SUSTAIN_MIN_CLARITY = 0.45
export const GUIDED_MIN_CLARITY = 0.3
const SUSTAIN_CENTS = 45

export interface Reading {
  freq: number
  clarity: number
  /** Level in dBFS. */
  level: number
  /** Guided-search result near the followed note (0 when not tracking). */
  trackFreq: number
  trackClarity: number
}

/**
 * Returns the frequency to use for this reading, or null when it should be ignored.
 * @param tracking frequency of the note currently being followed, or null when none.
 */
export function accept(r: Reading, sensitivity: number, tracking: number | null): number | null {
  const gate = gateDb(sensitivity)
  if (r.freq > 0 && r.level >= gate && r.clarity >= minClarity(sensitivity)) return r.freq
  if (tracking === null || r.level < gate - SUSTAIN_EXTRA_DB) return null

  const near = (f: number) => f > 0 && Math.abs(1200 * Math.log2(f / tracking)) <= SUSTAIN_CENTS
  if (near(r.freq) && r.clarity >= SUSTAIN_MIN_CLARITY) return r.freq
  if (near(r.trackFreq) && r.trackClarity >= GUIDED_MIN_CLARITY) return r.trackFreq
  return null
}
