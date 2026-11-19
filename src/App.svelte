<script lang="ts">
  import { untrack } from 'svelte'
  import Gauge, { TONE_COLORS, type Tone } from './components/Gauge.svelte'
  import Segmented from './components/Segmented.svelte'
  import SettingsSheet from './components/SettingsSheet.svelte'
  import TuningPicker from './components/TuningPicker.svelte'
  import { centsBetween, freqToMidi, midiToFreq, noteFromMidi, parseNote, specName } from './lib/music'
  import { loadSettings, saveSettings, type Mode } from './lib/settings'
  import { Tuner } from './lib/tuner.svelte'
  import { findTuning } from './lib/tunings'

  let settings = $state(loadSettings())
  $effect(() => saveSettings($state.snapshot(settings)))

  const tuner = new Tuner(() => settings)

  let settingsOpen = $state(false)
  /** String index the user tapped to lock onto, or null for automatic. */
  let lockedString = $state<number | null>(null)
  /** Strings that have been held in tune since the tuning was picked. */
  let tuned = $state<boolean[]>([])

  const { instrument, tuning } = $derived(findTuning(settings.tuningId))
  const strings = $derived(
    tuning.notes.map((spec) => {
      const midi = parseNote(spec)
      return { spec, midi, name: specName(spec), octave: Math.floor(midi / 12) - 1 }
    }),
  )
  /** Lowest note in the tuning, used to draw thicker strings for lower pitches. */
  const range = $derived({ low: Math.min(...strings.map((s) => s.midi)), high: Math.max(...strings.map((s) => s.midi)) })

  const modeOptions: { value: Mode; label: string }[] = [
    { value: 'instrument', label: 'Instrument' },
    { value: 'chromatic', label: 'Chromatic' },
  ]

  interface Target {
    name: string
    octave: number
    freq: number
    stringIndex: number
  }

  const target = $derived.by((): Target | null => {
    const freq = tuner.freq
    if (freq === null) return null
    if (settings.mode === 'chromatic') {
      const midi = Math.round(freqToMidi(freq, settings.a4))
      const note = noteFromMidi(midi, settings.accidentals)
      return { name: note.name, octave: note.octave, freq: midiToFreq(midi, settings.a4), stringIndex: -1 }
    }
    let index = lockedString
    if (index === null) {
      const detected = freqToMidi(freq, settings.a4)
      index = 0
      strings.forEach((s, i) => {
        if (Math.abs(s.midi - detected) < Math.abs(strings[index!].midi - detected)) index = i
      })
    }
    const s = strings[index]
    return { name: s.name, octave: s.octave, freq: midiToFreq(s.midi, settings.a4), stringIndex: index }
  })

  const cents = $derived(target && tuner.freq !== null ? centsBetween(tuner.freq, target.freq) : null)
  const inTune = $derived(cents !== null && Math.abs(cents) <= settings.tolerance)
  const tone = $derived<Tone>(cents === null ? 'idle' : inTune ? 'good' : Math.abs(cents) <= 15 ? 'near' : 'far')
  const toneColor = $derived(TONE_COLORS[tone])
  const glowOn = $derived(tone !== 'idle' && tuner.active)

  // Mark a string as tuned once it has stayed in range for a moment.
  let inTuneSince = 0
  let inTuneString = -1
  $effect(() => {
    const index = target?.stringIndex ?? -1
    if (!inTune || !tuner.active || index < 0) {
      inTuneSince = 0
      return
    }
    const now = performance.now()
    if (index !== inTuneString || inTuneSince === 0) {
      inTuneString = index
      inTuneSince = now
    } else if (now - inTuneSince > 600 && !tuned[index]) {
      tuned[index] = true
    }
  })

  // A new tuning starts with no locked string and nothing ticked off.
  $effect(() => {
    void settings.tuningId
    untrack(() => {
      lockedString = null
      tuned = []
    })
  })

  function toggleLock(index: number) {
    lockedString = lockedString === index ? null : index
  }

  // Keep the screen awake while listening (iOS 16.4+). The lock drops when the app is
  // hidden, so take it again when it comes back.
  $effect(() => {
    if (!tuner.listening || !settings.keepAwake || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    const acquire = async () => {
      if (document.visibilityState !== 'visible' || lock) return
      try {
        lock = await navigator.wakeLock.request('screen')
        lock.addEventListener('release', () => (lock = null))
        if (cancelled) void lock.release()
      } catch {
        // Not allowed right now (e.g. low power mode); nothing to do.
      }
    }
    void acquire()
    document.addEventListener('visibilitychange', acquire)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', acquire)
      void lock?.release()
    }
  })

  function formatCents(c: number): string {
    const r = Math.round(Math.abs(c))
    return `${c < 0 ? '−' : '+'}${r}`
  }
</script>

<div class="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
  <div class="absolute inset-0 bg-[radial-gradient(120%_70%_at_50%_0%,#1b1b26_0%,#0b0b10_60%)]"></div>
  <div
    class="absolute top-[18%] left-1/2 size-[130vw] max-w-[640px] -translate-x-1/2 rounded-full blur-3xl transition-[background-color,opacity] duration-500"
    style:background-color={toneColor}
    style:opacity={glowOn ? (tone === 'good' ? 0.22 : 0.12) : 0}
  ></div>
</div>

<main class="mx-auto flex h-dvh max-w-md flex-col px-4 pt-[calc(env(safe-area-inset-top,0px)+1.5rem)] pb-[max(1rem,env(safe-area-inset-bottom))]">
  <header class="flex items-center gap-3">
    <div class="flex-1">
      <Segmented label="Tuner mode" options={modeOptions} bind:value={settings.mode} />
    </div>
    <button type="button" class="grid size-11 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300 active:bg-white/10" aria-label="Settings" onclick={() => (settingsOpen = true)}>
      <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
        <circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" />
      </svg>
    </button>
  </header>

  <!-- Same height in both modes so the gauge never moves when switching. -->
  <div class="mt-3">
    {#if settings.mode === 'instrument'}
      <TuningPicker bind:value={settings.tuningId} />
    {:else}
      <div class="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <span class="min-w-0 flex-1">
          <span class="block text-[11px] font-semibold tracking-[0.14em] text-zinc-500 uppercase">Chromatic</span>
          <span class="block truncate text-base font-semibold text-zinc-100">Any note</span>
        </span>
        <span class="font-mono text-xs text-zinc-400">A4 = {settings.a4} Hz</span>
      </div>
    {/if}
  </div>

  <section class="flex min-h-0 flex-1 flex-col items-center pt-4" aria-live="polite">
    <!-- The gauge scales to whatever height is left, so the page fits short and tall screens. -->
    <div class="relative min-h-0 w-full flex-1 px-1">
      <Gauge {cents} tolerance={settings.tolerance} {tone} live={tuner.active} />
    </div>

    <div class="relative flex h-32 short:h-24 items-center justify-center">
      <div
        class="flex items-start leading-none transition-[color,text-shadow,opacity] duration-200"
        style:color={target ? (tuner.active ? (tone === 'good' ? '#d1fae5' : '#fafafa') : '#71717a') : '#3f3f46'}
        style:text-shadow={glowOn ? `0 0 32px ${toneColor}66` : 'none'}
      >
        <span class="text-[112px] short:text-[84px] font-bold tracking-tighter">{target?.name ?? '–'}</span>
        {#if target}<span class="mt-3 ml-1 text-3xl short:mt-2 short:text-2xl font-semibold text-zinc-500">{target.octave}</span>{/if}
      </div>
    </div>

    <div class="flex h-16 flex-col items-center justify-start">
      {#if cents !== null && target}
        <div
          class="flex items-center gap-2 rounded-full border px-4 py-1.5 text-base font-semibold tabular-nums transition-colors"
          style:color={toneColor}
          style:border-color="{toneColor}55"
          style:background-color="{toneColor}14"
        >
          {#if inTune}
            <svg viewBox="0 0 16 16" class="size-4" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
            In tune
          {:else}
            <svg viewBox="0 0 16 16" class="size-3.5 {cents < 0 ? '' : 'rotate-180'}" aria-hidden="true"><path d="M8 3 13.5 12h-11Z" fill="currentColor" /></svg>
            {formatCents(cents)}¢ · {cents < 0 ? 'Tune up' : 'Tune down'}
          {/if}
        </div>
        <p class="mt-2 text-xs text-zinc-500 tabular-nums">
          {tuner.freq!.toFixed(1)} Hz <span class="text-zinc-700">→</span> {target.freq.toFixed(1)} Hz
        </p>
      {:else if tuner.listening}
        <p class="flex items-center gap-2 text-sm text-zinc-500">
          <span class="flex h-4 items-end gap-0.5" aria-hidden="true">
            {#each [0, 1, 2, 3] as i (i)}
              <span class="eq w-0.5 rounded-full bg-zinc-500" style:animation-delay="{i * 120}ms"></span>
            {/each}
          </span>
          Play a note
        </p>
      {/if}
    </div>
  </section>

  <div class="mb-4 h-28">
  {#if settings.mode === 'instrument'}
    <div>
      <div class="flex items-end justify-center gap-1.5">
        {#each strings as s, i (i)}
          {@const isTarget = target?.stringIndex === i && tuner.active}
          {@const isLocked = lockedString === i}
          {@const thickness = 1.5 + ((range.high - s.midi) / Math.max(1, range.high - range.low)) * 3.5}
          <button
            type="button"
            class="group relative flex w-12 flex-col items-center gap-1.5 outline-none"
            aria-pressed={isLocked}
            aria-label="{s.name}{s.octave}{isLocked ? ', locked' : ''}{tuned[i] ? ', tuned' : ''}"
            onclick={() => toggleLock(i)}
          >
            <span
              class="relative grid size-12 place-items-center rounded-full border text-lg font-semibold transition-all duration-150 group-focus-visible:ring-2 group-focus-visible:ring-sky-400 group-active:scale-95
                {isTarget
                ? inTune
                  ? 'border-emerald-300 bg-emerald-400 text-zinc-900 shadow-[0_0_24px_rgba(52,211,153,0.55)]'
                  : 'border-white bg-zinc-100 text-zinc-900 shadow-[0_0_20px_rgba(255,255,255,0.25)]'
                : tuned[i]
                  ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-300'
                  : 'border-white/10 bg-white/[0.04] text-zinc-300'}
                {isLocked ? 'ring-2 ring-sky-400 ring-offset-2 ring-offset-ink' : ''}"
            >
              {s.name}
              {#if tuned[i]}
                <span class="absolute -top-1 -right-1 grid size-4.5 place-items-center rounded-full bg-emerald-400 text-zinc-900 ring-2 ring-ink" aria-hidden="true">
                  <svg viewBox="0 0 16 16" class="size-3"><path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
                </span>
              {/if}
            </span>
            <!-- string, thicker for lower notes -->
            <span
              class="h-7 rounded-full transition-colors {isTarget ? (inTune ? 'bg-emerald-400' : 'bg-zinc-200') : 'bg-gradient-to-b from-zinc-400 to-zinc-600'}"
              style:width="{thickness}px"
              aria-hidden="true"
            ></span>
          </button>
        {/each}
      </div>
      <p class="mt-2 text-center text-xs text-zinc-500">
        {lockedString === null ? `${instrument.name} · auto-detecting string. Tap one to lock it.` : 'Locked to one string. Tap it again for auto.'}
      </p>
    </div>
  {:else}
    <p class="flex h-full items-center justify-center text-center text-xs text-zinc-500">Detects any note across the whole range.</p>
  {/if}
  </div>

  <div class="relative">
  {#if tuner.error}
    <!-- Floats above the button so it doesn't push the tuner up. -->
    <p class="absolute inset-x-0 bottom-full mb-3 rounded-xl border border-rose-500/20 bg-rose-950/90 px-4 py-3 text-sm text-rose-300 backdrop-blur" role="alert">{tuner.error}</p>
  {/if}

  {#if tuner.listening}
    <button type="button" class="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] text-sm font-medium text-zinc-300 active:bg-white/[0.07]" onclick={() => tuner.stop()}>
      <span class="relative flex size-2.5">
        <span class="absolute inset-0 animate-ping rounded-full bg-rose-500 opacity-60"></span>
        <span class="relative size-2.5 rounded-full bg-rose-500"></span>
      </span>
      Listening · tap to stop
    </button>
  {:else}
    <button
      type="button"
      class="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-sky-400 to-sky-600 text-lg font-semibold text-white shadow-[0_10px_30px_-8px_rgba(56,189,248,0.6),inset_0_1px_0_rgba(255,255,255,0.3)] transition active:scale-[0.99] active:brightness-95 disabled:opacity-60"
      disabled={tuner.starting}
      onclick={() => tuner.start()}
    >
      <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      </svg>
      {tuner.starting ? 'Starting…' : 'Start tuning'}
    </button>
  {/if}
  </div>
</main>

<SettingsSheet bind:settings bind:open={settingsOpen} level={tuner.level} listening={tuner.listening} />

<style>
  .eq {
    height: 30%;
    animation: eq 900ms ease-in-out infinite;
  }
  @keyframes eq {
    50% {
      height: 100%;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .eq {
      animation: none;
    }
  }
</style>
