<script lang="ts">
  import { A4_MAX, A4_MIN, DEFAULT_SETTINGS, TOLERANCES, gateDb, type Response, type Settings } from '../lib/settings'
  import type { Accidentals } from '../lib/music'
  import BottomSheet from './BottomSheet.svelte'
  import Segmented from './Segmented.svelte'

  interface Props {
    settings: Settings
    /** Live input level in dBFS, for calibrating sensitivity. */
    level: number
    listening: boolean
    open: boolean
  }

  let { settings = $bindable(), level, listening, open = $bindable() }: Props = $props()

  const LEVEL_FLOOR = -80
  const toPct = (db: number) => Math.max(0, Math.min(100, ((db - LEVEL_FLOOR) / -LEVEL_FLOOR) * 100))
  const gatePct = $derived(toPct(gateDb(settings.sensitivity)))
  const levelPct = $derived(toPct(level))
  const aboveGate = $derived(level >= gateDb(settings.sensitivity))

  const responseOptions: { value: Response; label: string }[] = [
    { value: 'fast', label: 'Fast' },
    { value: 'balanced', label: 'Balanced' },
    { value: 'stable', label: 'Stable' },
  ]
  const accidentalOptions: { value: Accidentals; label: string }[] = [
    { value: 'sharps', label: 'C♯ D♯ F♯' },
    { value: 'flats', label: 'D♭ E♭ G♭' },
  ]
  const toleranceOptions = TOLERANCES.map((t) => ({ value: t, label: `±${t}¢` }))

  function nudgeA4(delta: number) {
    settings.a4 = Math.max(A4_MIN, Math.min(A4_MAX, settings.a4 + delta))
  }
</script>

<BottomSheet bind:open title="Settings">
  <div class="space-y-6">
    <section class="space-y-3">
      <div class="flex items-baseline justify-between">
        <h3 class="text-sm font-medium">Sensitivity</h3>
        <span class="text-sm text-zinc-400 tabular-nums">{settings.sensitivity} / 10</span>
      </div>
      <input type="range" min="1" max="10" step="1" bind:value={settings.sensitivity} class="w-full accent-sky-400" aria-label="Sensitivity" />
      <div class="flex justify-between text-xs text-zinc-500">
        <span>Noisy room</span>
        <span>Quiet room</span>
      </div>
      <div class="space-y-1.5">
        <div class="relative h-2.5 overflow-hidden rounded-full bg-black/50" aria-hidden="true">
          <div class="h-full rounded-full transition-[width] duration-75 {aboveGate ? 'bg-emerald-400' : 'bg-zinc-500'}" style:width="{listening ? levelPct : 0}%"></div>
          <div class="absolute top-0 h-full w-0.5 bg-zinc-100" style:left="{gatePct}%"></div>
        </div>
        <p class="text-xs text-zinc-500">
          {#if listening}
            Pluck a string: the bar should pass the white line. Background noise should stay below it.
          {:else}
            Start the tuner to see the live input level here.
          {/if}
        </p>
      </div>
    </section>

    <section class="space-y-3">
      <h3 class="text-sm font-medium">In-tune range</h3>
      <Segmented label="In-tune range" options={toleranceOptions} bind:value={settings.tolerance} />
    </section>

    <section class="space-y-3">
      <h3 class="text-sm font-medium">Needle response</h3>
      <Segmented label="Needle response" options={responseOptions} bind:value={settings.response} />
      <p class="text-xs text-zinc-500">Fast reacts quickest; Stable smooths out a wobbly needle.</p>
    </section>

    <section class="space-y-3">
      <h3 class="text-sm font-medium">Reference pitch</h3>
      <div class="flex items-center gap-3">
        <button type="button" class="size-11 rounded-xl bg-black/40 text-xl active:bg-white/10 disabled:opacity-30" onclick={() => nudgeA4(-1)} disabled={settings.a4 <= A4_MIN} aria-label="Lower reference pitch">−</button>
        <div class="flex-1 text-center tabular-nums"><span class="text-zinc-400">A4 =</span> <span class="text-lg font-semibold">{settings.a4}</span> <span class="text-zinc-400">Hz</span></div>
        <button type="button" class="size-11 rounded-xl bg-black/40 text-xl active:bg-white/10 disabled:opacity-30" onclick={() => nudgeA4(1)} disabled={settings.a4 >= A4_MAX} aria-label="Raise reference pitch">+</button>
      </div>
      {#if settings.a4 !== DEFAULT_SETTINGS.a4}
        <button type="button" class="text-xs text-sky-400" onclick={() => (settings.a4 = DEFAULT_SETTINGS.a4)}>Reset to 440 Hz</button>
      {/if}
    </section>

    <section class="space-y-3">
      <h3 class="text-sm font-medium">Chromatic note names</h3>
      <Segmented label="Chromatic note names" options={accidentalOptions} bind:value={settings.accidentals} />
    </section>

    <label class="flex items-center justify-between gap-4">
      <span>
        <span class="block text-sm font-medium">Keep screen on</span>
        <span class="block text-xs text-zinc-500">While the tuner is listening</span>
      </span>
      <input type="checkbox" bind:checked={settings.keepAwake} class="size-5 accent-sky-400" />
    </label>
  </div>
</BottomSheet>
