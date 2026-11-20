import type { Subdivision } from './settings'

export interface MetronomeConfig {
  bpm: number
  beats: number
  subdivision: Subdivision
  accent: boolean
}

type ClickKind = 'accent' | 'beat' | 'sub'

/** How far ahead clicks are scheduled on the audio clock. */
const LOOKAHEAD_S = 0.12
/** How often the scheduler wakes up; must be well under the lookahead. */
const TICK_MS = 25

const CLICKS: Record<ClickKind, { freq: number; gain: number }> = {
  accent: { freq: 1760, gain: 1 },
  beat: { freq: 1320, gain: 0.7 },
  sub: { freq: 990, gain: 0.35 },
}

/** Safari 16.4+ lets a page say it plays audio, so it isn't muted by the silent switch. */
type AudioSessionNavigator = Navigator & { audioSession?: { type: string } }

function setAudioSession(type: 'playback' | 'auto'): void {
  const session = (navigator as AudioSessionNavigator).audioSession
  if (!session) return
  try {
    session.type = type
  } catch {
    // Unsupported value on this browser; ignore.
  }
}

/**
 * Sample-accurate metronome: a timer schedules clicks a little ahead on the Web Audio clock,
 * so timing stays steady even when the main thread is busy.
 * `start()` must be called from a user gesture (iOS requirement).
 */
export class Metronome {
  playing = $state(false)
  /** Beat in the bar that is sounding now (0-based), or -1 when stopped. */
  beat = $state(-1)
  /** Counts every beat so the UI can retrigger a pulse animation. */
  pulse = $state(0)

  private readonly getConfig: () => MetronomeConfig
  private ctx: AudioContext | null = null
  private out: GainNode | null = null
  private buffers: Record<ClickKind, AudioBuffer> | null = null
  private timer = 0
  private raf = 0
  private nextTime = 0
  private nextBeat = 0
  private nextSub = 0
  /** Beats scheduled but not yet shown, so the display follows what you hear. */
  private queue: { time: number; beat: number }[] = []
  private readonly onVisibility = () => {
    if (document.visibilityState === 'visible' && this.ctx && this.ctx.state !== 'running') void this.ctx.resume()
  }

  constructor(getConfig: () => MetronomeConfig) {
    this.getConfig = getConfig
  }

  start(): void {
    if (this.ctx) return
    setAudioSession('playback')
    // Created synchronously inside the tap so iOS lets it make sound.
    const ctx = new AudioContext({ latencyHint: 'interactive' })
    this.ctx = ctx
    void ctx.resume()
    this.out = ctx.createGain()
    this.out.connect(ctx.destination)
    this.buffers = {
      accent: makeClick(ctx, CLICKS.accent),
      beat: makeClick(ctx, CLICKS.beat),
      sub: makeClick(ctx, CLICKS.sub),
    }
    this.nextTime = ctx.currentTime + 0.08
    this.nextBeat = 0
    this.nextSub = 0
    this.queue = []
    this.playing = true
    this.schedule()
    this.timer = window.setInterval(() => this.schedule(), TICK_MS)
    this.raf = requestAnimationFrame(this.draw)
    document.addEventListener('visibilitychange', this.onVisibility)
  }

  stop(): void {
    document.removeEventListener('visibilitychange', this.onVisibility)
    clearInterval(this.timer)
    cancelAnimationFrame(this.raf)
    const ctx = this.ctx
    this.ctx = null
    this.out = null
    this.buffers = null
    this.queue = []
    this.playing = false
    this.beat = -1
    if (ctx && ctx.state !== 'closed') void ctx.close()
    setAudioSession('auto')
  }

  toggle(): void {
    if (this.playing) this.stop()
    else this.start()
  }

  private schedule(): void {
    const ctx = this.ctx
    if (!ctx) return
    // If the app was suspended, don't fire a burst of missed clicks on return.
    if (this.nextTime < ctx.currentTime - 0.05) this.nextTime = ctx.currentTime + 0.05

    while (this.nextTime < ctx.currentTime + LOOKAHEAD_S) {
      const { bpm, beats, subdivision, accent } = this.getConfig()
      // Settings may have changed since the last click.
      if (this.nextBeat >= beats) this.nextBeat = 0
      if (this.nextSub >= subdivision) this.nextSub = 0

      const kind: ClickKind = this.nextSub > 0 ? 'sub' : this.nextBeat === 0 && accent && beats > 1 ? 'accent' : 'beat'
      this.play(kind, this.nextTime)
      if (this.nextSub === 0) this.queue.push({ time: this.nextTime, beat: this.nextBeat })

      this.nextTime += 60 / bpm / subdivision
      if (++this.nextSub >= subdivision) {
        this.nextSub = 0
        this.nextBeat = (this.nextBeat + 1) % beats
      }
    }
  }

  private play(kind: ClickKind, time: number): void {
    if (!this.ctx || !this.buffers || !this.out) return
    const src = this.ctx.createBufferSource()
    src.buffer = this.buffers[kind]
    src.connect(this.out)
    src.start(time)
  }

  private readonly draw = () => {
    const ctx = this.ctx
    if (!ctx) return
    const now = ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0)
    while (this.queue.length && this.queue[0].time <= now) {
      this.beat = this.queue.shift()!.beat
      this.pulse++
    }
    this.raf = requestAnimationFrame(this.draw)
  }
}

/** A short woodblock-like tick: two decaying partials with a soft attack. */
function makeClick(ctx: AudioContext, { freq, gain }: { freq: number; gain: number }): AudioBuffer {
  const rate = ctx.sampleRate
  const length = Math.round(rate * 0.06)
  const buffer = ctx.createBuffer(1, length, rate)
  const data = buffer.getChannelData(0)
  const attack = rate * 0.001
  for (let i = 0; i < length; i++) {
    const t = i / rate
    const env = Math.min(1, i / attack) * Math.exp(-t / 0.012)
    const tone = Math.sin(2 * Math.PI * freq * t) + 0.35 * Math.sin(2 * Math.PI * freq * 2.76 * t)
    data[i] = gain * 0.7 * env * tone
  }
  return buffer
}

/** Traditional Italian tempo marking for a BPM. */
export function tempoName(bpm: number): string {
  if (bpm < 40) return 'Grave'
  if (bpm < 60) return 'Largo'
  if (bpm < 66) return 'Larghetto'
  if (bpm < 76) return 'Adagio'
  if (bpm < 108) return 'Andante'
  if (bpm < 120) return 'Moderato'
  if (bpm < 156) return 'Allegro'
  if (bpm < 176) return 'Vivace'
  if (bpm < 200) return 'Presto'
  return 'Prestissimo'
}
