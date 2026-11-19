import { PitchListener, type PitchReading } from './audio'
import { accepts } from './gate'
import { smoothingWindow, type Settings } from './settings'

/** Drop the filter history after this much silence so a new note starts clean. */
const NOTE_GAP_MS = 300
/** A note keeps its lower "sustain" bar across dropouts up to this long. */
const SUSTAIN_GAP_MS = 400
/** Keep showing the last note (dimmed) for this long after the sound stops. */
const HOLD_MS = 3000

/**
 * Reactive tuner state: turns raw worklet readings into a stable frequency,
 * applying the user's sensitivity gate and response smoothing.
 */
export class Tuner {
  /** Smoothed frequency in Hz, or null when nothing has been heard recently. */
  freq = $state<number | null>(null)
  /** True while a confident pitch is currently coming in. */
  active = $state(false)
  /** Current input level in dBFS. */
  level = $state(-100)
  listening = $state(false)
  starting = $state(false)
  error = $state<string | null>(null)

  private readonly getSettings: () => Settings
  private readonly listener: PitchListener
  private history: number[] = []
  private lastHeard = 0

  constructor(getSettings: () => Settings) {
    this.getSettings = getSettings
    this.listener = new PitchListener((r) => this.onReading(r))
  }

  async start(): Promise<void> {
    if (this.listening || this.starting) return
    this.starting = true
    this.error = null
    try {
      await this.listener.start()
      this.listening = true
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err)
    } finally {
      this.starting = false
    }
  }

  async stop(): Promise<void> {
    await this.listener.stop()
    this.listening = false
    this.active = false
    this.freq = null
    this.level = -100
    this.history = []
  }

  private onReading(r: PitchReading): void {
    const s = this.getSettings()
    const now = performance.now()
    this.level = 20 * Math.log10(Math.max(r.rms, 1e-5))

    // Follow the current note (even a held one) at a lower bar so a fading string keeps reading.
    const tracking = this.freq !== null && now - this.lastHeard <= SUSTAIN_GAP_MS ? this.freq : null
    if (accepts({ freq: r.freq, clarity: r.clarity, level: this.level }, s.sensitivity, tracking)) {
      this.history.push(r.freq)
      const size = smoothingWindow(s.response)
      if (this.history.length > size) this.history.splice(0, this.history.length - size)
      this.freq = median(this.history)
      this.active = true
      this.lastHeard = now
      return
    }

    const quietFor = now - this.lastHeard
    if (this.active && quietFor > NOTE_GAP_MS) {
      this.active = false
      this.history = []
    }
    if (this.freq !== null && quietFor > HOLD_MS) this.freq = null
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}
