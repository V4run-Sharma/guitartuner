import workletUrl from './pitch-processor.ts?worker&url'

export interface PitchReading {
  /** Detected fundamental in Hz, 0 when nothing confident was found. */
  freq: number
  /** MPM clarity, roughly 0..1. Higher means a cleaner periodic signal. */
  clarity: number
  /** Root-mean-square level of the analysis window (0..1). */
  rms: number
}

export type MicErrorKind = 'denied' | 'unsupported' | 'no-device' | 'other'

export class MicError extends Error {
  readonly kind: MicErrorKind
  constructor(kind: MicErrorKind, message: string) {
    super(message)
    this.kind = kind
  }
}

/**
 * Owns the microphone stream, AudioContext and pitch worklet.
 * `start()` must be called from a user gesture (iOS requirement).
 */
export class PitchListener {
  private ctx: AudioContext | null = null
  private stream: MediaStream | null = null
  private node: AudioWorkletNode | null = null
  private readonly onReading: (r: PitchReading) => void
  private readonly onVisibility = () => this.handleVisibility()

  constructor(onReading: (r: PitchReading) => void) {
    this.onReading = onReading
  }

  get running(): boolean {
    return this.ctx !== null
  }

  async start(): Promise<void> {
    if (this.ctx) return
    if (!navigator.mediaDevices?.getUserMedia || typeof AudioWorkletNode === 'undefined') {
      throw new MicError('unsupported', 'This browser cannot capture audio. On iPhone, use Safari on iOS 16.4 or later.')
    }

    // Create the context synchronously inside the gesture so iOS lets it run.
    const ctx = new AudioContext({ latencyHint: 'interactive' })
    this.ctx = ctx
    try {
      const resumed = ctx.resume()
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // Voice processing smears pitch and pumps the level; turn all of it off.
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })
      await resumed
      await ctx.audioWorklet.addModule(workletUrl)

      const source = ctx.createMediaStreamSource(this.stream)
      const node = new AudioWorkletNode(ctx, 'pitch-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1,
        channelCountMode: 'explicit',
      })
      node.port.onmessage = (e: MessageEvent<PitchReading>) => this.onReading(e.data)

      // Keep the worklet in the rendering graph without making any sound.
      const mute = ctx.createGain()
      mute.gain.value = 0
      source.connect(node).connect(mute).connect(ctx.destination)
      this.node = node

      document.addEventListener('visibilitychange', this.onVisibility)
    } catch (err) {
      await this.stop()
      throw toMicError(err)
    }
  }

  async stop(): Promise<void> {
    document.removeEventListener('visibilitychange', this.onVisibility)
    this.node?.port.close()
    this.node?.disconnect()
    this.node = null
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    const ctx = this.ctx
    this.ctx = null
    if (ctx && ctx.state !== 'closed') await ctx.close()
  }

  private handleVisibility(): void {
    const ctx = this.ctx
    if (!ctx) return
    // iOS suspends audio in the background; pick it back up when the app returns.
    if (document.visibilityState === 'visible' && ctx.state !== 'running') void ctx.resume()
  }
}

function toMicError(err: unknown): MicError {
  if (err instanceof MicError) return err
  const name = err instanceof DOMException ? err.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return new MicError('denied', 'Microphone access was blocked. Allow it in Settings › Safari › Microphone (or for this app), then try again.')
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return new MicError('no-device', 'No microphone was found.')
  }
  return new MicError('other', err instanceof Error ? err.message : 'Could not start the microphone.')
}
