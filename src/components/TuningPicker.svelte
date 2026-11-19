<script lang="ts">
  import { tick } from 'svelte'
  import { specName } from '../lib/music'
  import { INSTRUMENTS, findTuning } from '../lib/tunings'
  import BottomSheet from './BottomSheet.svelte'
  import Segmented from './Segmented.svelte'

  interface Props {
    value: string
  }

  let { value = $bindable() }: Props = $props()

  let open = $state(false)
  let list = $state<HTMLElement>()
  const current = $derived(findTuning(value))
  /** Instrument tab shown in the sheet; starts on the current tuning's instrument. */
  let browsing = $state(INSTRUMENTS[0].id)
  const browsed = $derived(INSTRUMENTS.find((i) => i.id === browsing) ?? INSTRUMENTS[0])

  const tabs = INSTRUMENTS.map((i) => ({ value: i.id, label: i.name.replace(' guitar', '') }))

  async function show() {
    browsing = current.instrument.id
    open = true
    await tick()
    list?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus()
  }

  function choose(id: string) {
    value = id
    open = false
  }

  /** Arrow keys move between options, like a native listbox. */
  function onKeydown(e: KeyboardEvent) {
    if (!list || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
    const options = [...list.querySelectorAll<HTMLElement>('[role="option"]')]
    const i = options.indexOf(document.activeElement as HTMLElement)
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? options.length - 1 : i + (e.key === 'ArrowDown' ? 1 : -1)
    options[Math.max(0, Math.min(options.length - 1, next))]?.focus()
    e.preventDefault()
  }
</script>

<button
  type="button"
  aria-haspopup="dialog"
  aria-expanded={open}
  onclick={show}
  class="group flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition active:scale-[0.99] active:bg-white/[0.07]"
>
  <span class="min-w-0 flex-1">
    <span class="block text-[11px] font-semibold tracking-[0.14em] text-zinc-500 uppercase">{current.instrument.name}</span>
    <span class="block truncate text-base font-semibold text-zinc-100">{current.tuning.name}</span>
  </span>
  <span class="flex gap-1 font-mono text-xs text-zinc-400" aria-hidden="true">
    {#each current.tuning.notes as n, i (i)}<span>{specName(n)}</span>{/each}
  </span>
  <svg viewBox="0 0 20 20" class="size-5 shrink-0 text-zinc-500 transition group-active:translate-y-0.5" aria-hidden="true">
    <path d="M5.5 7.5 10 12l4.5-4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</button>

<BottomSheet bind:open title="Tuning" height="50dvh">
  {#snippet toolbar()}
    <Segmented label="Instrument" options={tabs} bind:value={browsing} />
  {/snippet}

  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <div bind:this={list} role="listbox" aria-label="{browsed.name} tunings" class="space-y-1.5" onkeydown={onKeydown}>
    {#each browsed.tunings as t (t.id)}
      {@const selected = t.id === value}
      <button
        type="button"
        role="option"
        aria-selected={selected}
        onclick={() => choose(t.id)}
        class="flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-inset active:scale-[0.99]
          {selected ? 'border-sky-400/60 bg-sky-400/10' : 'border-white/5 bg-white/[0.03] active:bg-white/[0.07]'}"
      >
        <span class="min-w-0 flex-1 text-[15px] leading-tight font-medium {selected ? 'text-sky-200' : 'text-zinc-100'}">{t.name}</span>
        <span class="flex shrink-0 gap-0.5">
          {#each t.notes as n, i (i)}
            <span class="min-w-[1.4rem] rounded px-1 py-0.5 text-center font-mono text-[11px] {selected ? 'bg-sky-400/15 text-sky-200' : 'bg-white/5 text-zinc-400'}">{specName(n)}</span>
          {/each}
        </span>
        <span class="grid size-5 shrink-0 place-items-center rounded-full {selected ? 'bg-sky-400 text-zinc-900' : 'border border-white/15'}" aria-hidden="true">
          {#if selected}
            <svg viewBox="0 0 16 16" class="size-3"><path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
          {/if}
        </span>
      </button>
    {/each}
  </div>
</BottomSheet>
