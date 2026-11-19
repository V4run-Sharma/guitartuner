export interface Tuning {
  id: string
  name: string
  /** Strings in physical order (top string first), as note specs like "E2" or "Bb1". */
  notes: string[]
}

export interface Instrument {
  id: string
  name: string
  tunings: Tuning[]
}

export const INSTRUMENTS: Instrument[] = [
  {
    id: 'guitar',
    name: 'Guitar',
    tunings: [
      { id: 'guitar-standard', name: 'Standard', notes: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'] },
      { id: 'guitar-drop-d', name: 'Drop D', notes: ['D2', 'A2', 'D3', 'G3', 'B3', 'E4'] },
      { id: 'guitar-eb', name: 'Half step down (E♭)', notes: ['Eb2', 'Ab2', 'Db3', 'Gb3', 'Bb3', 'Eb4'] },
      { id: 'guitar-d-standard', name: 'Whole step down (D)', notes: ['D2', 'G2', 'C3', 'F3', 'A3', 'D4'] },
      { id: 'guitar-drop-c-sharp', name: 'Drop C♯', notes: ['Db2', 'Ab2', 'Db3', 'Gb3', 'Bb3', 'Eb4'] },
      { id: 'guitar-drop-c', name: 'Drop C', notes: ['C2', 'G2', 'C3', 'F3', 'A3', 'D4'] },
      { id: 'guitar-drop-b', name: 'Drop B', notes: ['B1', 'F#2', 'B2', 'E3', 'G#3', 'C#4'] },
      { id: 'guitar-dadgad', name: 'DADGAD', notes: ['D2', 'A2', 'D3', 'G3', 'A3', 'D4'] },
      { id: 'guitar-double-drop-d', name: 'Double drop D', notes: ['D2', 'A2', 'D3', 'G3', 'B3', 'D4'] },
      { id: 'guitar-open-g', name: 'Open G', notes: ['D2', 'G2', 'D3', 'G3', 'B3', 'D4'] },
      { id: 'guitar-open-d', name: 'Open D', notes: ['D2', 'A2', 'D3', 'F#3', 'A3', 'D4'] },
      { id: 'guitar-open-e', name: 'Open E', notes: ['E2', 'B2', 'E3', 'G#3', 'B3', 'E4'] },
      { id: 'guitar-open-a', name: 'Open A', notes: ['E2', 'A2', 'E3', 'A3', 'C#4', 'E4'] },
      { id: 'guitar-open-c', name: 'Open C', notes: ['C2', 'G2', 'C3', 'G3', 'C4', 'E4'] },
    ],
  },
  {
    id: 'guitar7',
    name: '7-string guitar',
    tunings: [
      { id: 'guitar7-standard', name: 'Standard', notes: ['B1', 'E2', 'A2', 'D3', 'G3', 'B3', 'E4'] },
      { id: 'guitar7-drop-a', name: 'Drop A', notes: ['A1', 'E2', 'A2', 'D3', 'G3', 'B3', 'E4'] },
    ],
  },
  {
    id: 'bass',
    name: 'Bass',
    tunings: [
      { id: 'bass-standard', name: 'Standard (4)', notes: ['E1', 'A1', 'D2', 'G2'] },
      { id: 'bass-drop-d', name: 'Drop D (4)', notes: ['D1', 'A1', 'D2', 'G2'] },
      { id: 'bass-eb', name: 'Half step down (4)', notes: ['Eb1', 'Ab1', 'Db2', 'Gb2'] },
      { id: 'bass5-standard', name: 'Standard (5)', notes: ['B0', 'E1', 'A1', 'D2', 'G2'] },
    ],
  },
  {
    id: 'ukulele',
    name: 'Ukulele',
    tunings: [
      { id: 'uke-standard', name: 'Standard (GCEA)', notes: ['G4', 'C4', 'E4', 'A4'] },
      { id: 'uke-low-g', name: 'Low G', notes: ['G3', 'C4', 'E4', 'A4'] },
      { id: 'uke-baritone', name: 'Baritone (DGBE)', notes: ['D3', 'G3', 'B3', 'E4'] },
    ],
  },
]

export const DEFAULT_TUNING_ID = 'guitar-standard'

export function findTuning(id: string): { instrument: Instrument; tuning: Tuning } {
  for (const instrument of INSTRUMENTS) {
    const tuning = instrument.tunings.find((t) => t.id === id)
    if (tuning) return { instrument, tuning }
  }
  return findTuning(DEFAULT_TUNING_ID)
}
