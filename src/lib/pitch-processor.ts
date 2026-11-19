/**
 * AudioWorklet that detects the pitch of the microphone signal off the main thread.
 *
 * Algorithm: McLeod Pitch Method (normalised square difference function), with the
 * autocorrelation computed through an FFT so each analysis costs O(N log N).
 *
 * Posts `{ freq, clarity, rms }` to the main thread every HOP samples.
 * `freq` is 0 when no confident pitch was found.
 */

// Globals that exist inside AudioWorkletGlobalScope but not in the DOM typings.
declare const sampleRate: number
declare function registerProcessor(name: string, ctor: unknown): void
declare class AudioWorkletProcessor {
  readonly port: MessagePort
}

const WINDOW = 4096 // ~85 ms at 48 kHz: enough periods for a low B on a 5-string bass
const HOP = 1024 // analyze ~47 times per second at 48 kHz
const FFT_SIZE = WINDOW * 2 // zero-padded so the circular autocorrelation equals the linear one
const MIN_FREQ = 27 // just under B0 (30.87 Hz)
const MAX_FREQ = 4200 // above C8, plenty for chromatic mode
const PEAK_THRESHOLD = 0.9 // MPM "k": first key maximum within 90% of the highest one
const SILENCE_RMS = 0.00003 // ~-90 dBFS: skip analysis only on near-digital silence
/**
 * Low-pass cutoff applied before analysis. Guitar, bass and ukulele fundamentals sit below
 * ~1.4 kHz, while mic hiss spreads across the whole 24 kHz band; cutting it here raises the
 * signal-to-noise ratio a lot, so a fading string stays readable for much longer.
 */
const LOWPASS_HZ = 1500

/** RBJ biquad low-pass section (Direct Form I). */
class Biquad {
  private readonly b0: number
  private readonly b1: number
  private readonly b2: number
  private readonly a1: number
  private readonly a2: number
  private x1 = 0
  private x2 = 0
  private y1 = 0
  private y2 = 0

  constructor(freq: number, q: number) {
    const w = (2 * Math.PI * freq) / sampleRate
    const alpha = Math.sin(w) / (2 * q)
    const cos = Math.cos(w)
    const a0 = 1 + alpha
    this.b0 = (1 - cos) / 2 / a0
    this.b1 = (1 - cos) / a0
    this.b2 = this.b0
    this.a1 = (-2 * cos) / a0
    this.a2 = (1 - alpha) / a0
  }

  step(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2
    this.x2 = this.x1
    this.x1 = x
    this.y2 = this.y1
    this.y1 = y
    return y
  }
}

class FFT {
  private readonly n: number
  private readonly cos: Float64Array
  private readonly sin: Float64Array
  private readonly rev: Uint32Array

  constructor(n: number) {
    this.n = n
    this.cos = new Float64Array(n / 2)
    this.sin = new Float64Array(n / 2)
    for (let i = 0; i < n / 2; i++) {
      this.cos[i] = Math.cos((2 * Math.PI * i) / n)
      this.sin[i] = -Math.sin((2 * Math.PI * i) / n)
    }
    const bits = Math.log2(n)
    this.rev = new Uint32Array(n)
    for (let i = 0; i < n; i++) {
      let r = 0
      for (let b = 0; b < bits; b++) r = (r << 1) | ((i >> b) & 1)
      this.rev[i] = r
    }
  }

  /** In-place forward transform. Pass `inverse` to run the unscaled inverse. */
  transform(re: Float64Array, im: Float64Array, inverse = false): void {
    const { n, rev, cos } = this
    const sinSign = inverse ? -1 : 1
    for (let i = 0; i < n; i++) {
      const j = rev[i]
      if (j > i) {
        let t = re[i]; re[i] = re[j]; re[j] = t
        t = im[i]; im[i] = im[j]; im[j] = t
      }
    }
    for (let size = 2; size <= n; size *= 2) {
      const half = size / 2
      const step = n / size
      for (let start = 0; start < n; start += size) {
        for (let k = 0; k < half; k++) {
          const wr = cos[k * step]
          const wi = this.sin[k * step] * sinSign
          const a = start + k
          const b = a + half
          const tr = re[b] * wr - im[b] * wi
          const ti = re[b] * wi + im[b] * wr
          re[b] = re[a] - tr
          im[b] = im[a] - ti
          re[a] += tr
          im[a] += ti
        }
      }
    }
  }
}

class PitchProcessor extends AudioWorkletProcessor {
  private readonly ring = new Float32Array(WINDOW)
  private writePos = 0
  private sinceLast = 0
  private readonly frame = new Float64Array(WINDOW)
  private readonly re = new Float64Array(FFT_SIZE)
  private readonly im = new Float64Array(FFT_SIZE)
  private readonly nsdf = new Float64Array(WINDOW)
  private readonly fft = new FFT(FFT_SIZE)
  private readonly tauMin = Math.floor(sampleRate / MAX_FREQ)
  private readonly tauMax = Math.min(Math.ceil(sampleRate / MIN_FREQ), WINDOW - 2)
  /** Two sections with Butterworth Qs make a 4th-order low-pass (24 dB/octave). */
  private readonly lowpass = [new Biquad(LOWPASS_HZ, 0.5412), new Biquad(LOWPASS_HZ, 1.3066)]

  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0]
    if (!channel) return true

    const [lp1, lp2] = this.lowpass
    for (let i = 0; i < channel.length; i++) {
      this.ring[this.writePos] = lp2.step(lp1.step(channel[i]))
      this.writePos = (this.writePos + 1) % WINDOW
    }
    this.sinceLast += channel.length
    if (this.sinceLast >= HOP) {
      this.sinceLast = 0
      this.analyse()
    }
    return true
  }

  private analyse(): void {
    const { frame, ring, re, im, nsdf, tauMin, tauMax } = this

    // Unroll the ring buffer (oldest sample first) and remove DC offset.
    let mean = 0
    for (let i = 0; i < WINDOW; i++) {
      frame[i] = ring[(this.writePos + i) % WINDOW]
      mean += frame[i]
    }
    mean /= WINDOW
    let energy = 0
    for (let i = 0; i < WINDOW; i++) {
      frame[i] -= mean
      energy += frame[i] * frame[i]
    }
    const rms = Math.sqrt(energy / WINDOW)
    if (rms < SILENCE_RMS) {
      this.port.postMessage({ freq: 0, clarity: 0, rms })
      return
    }

    // Autocorrelation r(tau) = IFFT(|FFT(x)|^2), zero-padded to avoid wrap-around.
    re.fill(0)
    im.fill(0)
    re.set(frame)
    this.fft.transform(re, im)
    for (let i = 0; i < FFT_SIZE; i++) {
      re[i] = re[i] * re[i] + im[i] * im[i]
      im[i] = 0
    }
    this.fft.transform(re, im, true)
    // re[tau] / FFT_SIZE is now the autocorrelation at lag tau.

    // NSDF n(tau) = 2 r(tau) / m(tau), with m(tau) = sum x[j]^2 + x[j+tau]^2 updated incrementally.
    let m = 2 * energy
    for (let tau = 0; tau <= tauMax; tau++) {
      if (tau > 0) {
        m -= frame[tau - 1] * frame[tau - 1] + frame[WINDOW - tau] * frame[WINDOW - tau]
      }
      nsdf[tau] = m > 0 ? (2 * re[tau]) / FFT_SIZE / m : 0
    }

    // Peak picking: one key maximum per positive lobe after the first negative zero crossing.
    let tau = 1
    while (tau < tauMax && nsdf[tau] > 0) tau++ // skip the lobe around lag 0
    let highest = 0
    const peaks: number[] = []
    while (tau < tauMax) {
      while (tau < tauMax && nsdf[tau] <= 0) tau++
      let best = -1
      while (tau < tauMax && nsdf[tau] > 0) {
        if (tau >= tauMin && (best < 0 || nsdf[tau] > nsdf[best])) best = tau
        tau++
      }
      if (best > 0) {
        peaks.push(best)
        if (nsdf[best] > highest) highest = nsdf[best]
      }
    }
    if (peaks.length === 0) {
      this.port.postMessage({ freq: 0, clarity: 0, rms })
      return
    }

    const cutoff = PEAK_THRESHOLD * highest
    let chosen = peaks[0]
    for (const p of peaks) {
      if (nsdf[p] >= cutoff) {
        chosen = p
        break
      }
    }

    // Parabolic interpolation for sub-sample accuracy.
    const a = nsdf[chosen - 1]
    const b = nsdf[chosen]
    const c = nsdf[chosen + 1]
    const denom = a - 2 * b + c
    const shift = denom !== 0 ? (0.5 * (a - c)) / denom : 0
    const period = chosen + shift
    const clarity = b - 0.25 * (a - c) * shift

    this.port.postMessage({ freq: sampleRate / period, clarity, rms })
  }
}

registerProcessor('pitch-processor', PitchProcessor)
