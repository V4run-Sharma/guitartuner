<script lang="ts">
  import type { Metronome } from '../lib/metronome.svelte'
  import { BEATS_MAX, BEATS_MIN, BPM_MAX, BPM_MIN, type Settings, type Subdivision } from '../lib/settings'
  import Segmented from './Segmented.svelte'

  interface Props {
    settings: Settings
    metronome: Metronome
  }

  let { settings = $bindable(), metronome }: Props = $props()

  const subdivisionOptions: { value: Subdivision; label: string }[] = [
    { value: 1, label: '♩' },
    { value: 2, label: '♫' },
    { value: 3, label: '♪³' },
    { value: 4, label: '♬' },
  ]

  const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

  function nudgeBpm(delta: number) {
    settings.bpm = clamp(settings.bpm + delta, BPM_MIN, BPM_MAX)
  }

  // Hold − / + to keep stepping, speeding up the longer it's held.
  let holdTimer = 0
  function startHold(delta: number) {
    nudgeBpm(delta)
    let wait = 400
    const repeat = () => {
      nudgeBpm(delta)
      wait = Math.max(50, wait * 0.8)
      holdTimer = window.setTimeout(repeat, wait)
    }
    holdTimer = window.setTimeout(repeat, wait)
  }
  function endHold() {
    clearTimeout(holdTimer)
  }

  let taps: number[] = []
  function tap() {
    const now = performance.now()
    if (taps.length && now - taps[taps.length - 1] > 2000) taps = []
    taps = [...taps.slice(-4), now]
    if (taps.length < 2) return
    const avg = (taps[taps.length - 1] - taps[0]) / (taps.length - 1)
    settings.bpm = clamp(Math.round(60000 / avg), BPM_MIN, BPM_MAX)
  }

  const dotSize = $derived(settings.beats <= 6 ? 'size-6' : settings.beats <= 9 ? 'size-5' : 'size-4')
</script>

<section class="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 short:gap-4 pt-4" aria-label="Metronome">
  <div class="flex flex-wrap items-center justify-center gap-2.5" aria-hidden="true">
    {#each Array.from({ length: settings.beats }, (_, i) => i) as i (i)}
      {@const lit = metronome.beat === i}
      {@const accented = i === 0 && settings.accent && settings.beats > 1}
      <span
        class="{dotSize} rounded-full border transition-[background-color,box-shadow,transform] duration-75
          {lit
          ? accented
            ? 'scale-110 border-amber-300 bg-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.7)]'
            : 'scale-110 border-sky-300 bg-sky-400 shadow-[0_0_18px_rgba(56,189,248,0.7)]'
          : accented
            ? 'border-amber-400/50 bg-amber-400/10'
            : 'border-white/15 bg-white/[0.06]'}"
      ></span>
    {/each}
  </div>

  <div class="relative flex flex-col items-center">
    {#key metronome.pulse}
      {#if metronome.playing}
        <span
          class="beat-ring pointer-events-none absolute top-1/2 left-1/2 size-48 short:size-40 rounded-full border-2 {metronome.beat === 0 && settings.accent && settings.beats > 1 ? 'border-amber-400' : 'border-sky-400'}"
          aria-hidden="true"
        ></span>
      {/if}
    {/key}
    <span class="text-[11px] font-semibold tracking-[0.14em] text-zinc-500 uppercase">BPM</span>
    <span class="text-[112px] short:text-[84px] leading-none font-bold tracking-tighter text-zinc-50 tabular-nums" aria-live="polite">{settings.bpm}</span>
  </div>

  <div class="flex w-full items-center gap-3">
    <button
      type="button"
      class="size-12 shrink-0 touch-none rounded-xl border border-white/10 bg-white/[0.04] text-2xl text-zinc-200 select-none active:bg-white/10 disabled:opacity-30"
      aria-label="Slower"
      disabled={settings.bpm <= BPM_MIN}
      onpointerdown={() => startHold(-1)}
      onpointerup={endHold}
      onpointerleave={endHold}
      onpointercancel={endHold}
      onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), nudgeBpm(-1))}>−</button
    >
    <input type="range" min={BPM_MIN} max={BPM_MAX} step="1" bind:value={settings.bpm} class="min-w-0 flex-1 accent-sky-400" aria-label="Tempo" />
    <button
      type="button"
      class="size-12 shrink-0 touch-none rounded-xl border border-white/10 bg-white/[0.04] text-2xl text-zinc-200 select-none active:bg-white/10 disabled:opacity-30"
      aria-label="Faster"
      disabled={settings.bpm >= BPM_MAX}
      onpointerdown={() => startHold(1)}
      onpointerup={endHold}
      onpointerleave={endHold}
      onpointercancel={endHold}
      onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), nudgeBpm(1))}>+</button
    >
  </div>

  <button
    type="button"
    class="h-11 w-32 touch-manipulation rounded-full border border-white/10 bg-white/[0.04] text-sm font-semibold tracking-wide text-zinc-200 select-none active:scale-95 active:bg-white/10"
    onpointerdown={tap}
    onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), tap())}
  >
    Tap tempo
  </button>
</section>

<div class="mb-4 flex h-28 flex-col justify-end gap-3">
  <div class="flex items-center gap-3">
    <div class="flex flex-1 items-center rounded-xl border border-white/10 bg-white/[0.04] p-1">
      <button type="button" class="size-9 rounded-lg text-xl text-zinc-300 active:bg-white/10 disabled:opacity-30" aria-label="Fewer beats per bar" disabled={settings.beats <= BEATS_MIN} onclick={() => (settings.beats = Math.max(BEATS_MIN, settings.beats - 1))}>−</button>
      <span class="flex-1 text-center text-sm text-zinc-400"><span class="font-semibold text-zinc-100 tabular-nums">{settings.beats}</span> beats / bar</span>
      <button type="button" class="size-9 rounded-lg text-xl text-zinc-300 active:bg-white/10 disabled:opacity-30" aria-label="More beats per bar" disabled={settings.beats >= BEATS_MAX} onclick={() => (settings.beats = Math.min(BEATS_MAX, settings.beats + 1))}>+</button>
    </div>
    <button
      type="button"
      class="h-11 rounded-xl border px-4 text-sm font-medium transition-colors {settings.accent ? 'border-amber-400/40 bg-amber-400/10 text-amber-300' : 'border-white/10 bg-white/[0.04] text-zinc-400'}"
      aria-pressed={settings.accent}
      onclick={() => (settings.accent = !settings.accent)}
    >
      Accent
    </button>
  </div>
  <Segmented label="Subdivision" options={subdivisionOptions} bind:value={settings.subdivision} />
</div>

<button
  type="button"
  class="flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-lg font-semibold transition active:scale-[0.99] {metronome.playing
    ? 'border border-white/10 bg-white/[0.03] text-zinc-300 active:bg-white/[0.07]'
    : 'bg-gradient-to-b from-sky-400 to-sky-600 text-white shadow-[0_10px_30px_-8px_rgba(56,189,248,0.6),inset_0_1px_0_rgba(255,255,255,0.3)] active:brightness-95'}"
  onclick={() => metronome.toggle()}
>
  {#if metronome.playing}
    <svg viewBox="0 0 24 24" class="size-5" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
    Stop
  {:else}
    <svg viewBox="0 0 24 24" class="size-5" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5Z" /></svg>
    Start metronome
  {/if}
</button>

<style>
  .beat-ring {
    transform: translate(-50%, -50%) scale(0.85);
    opacity: 0.6;
    animation: ring 380ms ease-out forwards;
  }
  @keyframes ring {
    to {
      transform: translate(-50%, -50%) scale(1.15);
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .beat-ring {
      animation: none;
      opacity: 0;
    }
  }
</style>
