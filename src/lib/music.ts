const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B']
const LETTER_SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

export type Accidentals = 'sharps' | 'flats'

export interface Note {
  midi: number
  /** Pitch class name without octave, e.g. "F♯". */
  name: string
  octave: number
}

/** Parse "E2", "F#3", "Bb1", "Eb4" into a MIDI note number. */
export function parseNote(spec: string): number {
  const match = /^([A-G])([#b]?)(-?\d)$/.exec(spec)
  if (!match) throw new Error(`Bad note: ${spec}`)
  const [, letter, accidental, octave] = match
  const offset = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0
  return (Number(octave) + 1) * 12 + LETTER_SEMITONES[letter] + offset
}

/** Display name for a note spec as written, e.g. "Bb1" -> "B♭". */
export function specName(spec: string): string {
  return spec.replace(/-?\d+$/, '').replace('#', '♯').replace('b', '♭')
}

export function noteFromMidi(midi: number, accidentals: Accidentals): Note {
  const pc = ((midi % 12) + 12) % 12
  return {
    midi,
    name: (accidentals === 'flats' ? FLAT_NAMES : SHARP_NAMES)[pc],
    octave: Math.floor(midi / 12) - 1,
  }
}

export function midiToFreq(midi: number, a4: number): number {
  return a4 * 2 ** ((midi - 69) / 12)
}

/** Fractional MIDI number for a frequency. */
export function freqToMidi(freq: number, a4: number): number {
  return 69 + 12 * Math.log2(freq / a4)
}

export function centsBetween(freq: number, target: number): number {
  return 1200 * Math.log2(freq / target)
}
