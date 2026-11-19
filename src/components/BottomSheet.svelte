<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    open: boolean
    title: string
    /** Fixed sheet height (any CSS length, e.g. "33dvh"). Omit to size to content. */
    height?: string
    /** Pinned content under the title that does not scroll with the body. */
    toolbar?: Snippet
    children: Snippet
  }

  let { open = $bindable(), title, height, toolbar, children }: Props = $props()

  let dialog: HTMLDialogElement

  $effect(() => {
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  })
</script>

<dialog
  bind:this={dialog}
  aria-label={title}
  onclose={() => (open = false)}
  onclick={(e) => e.target === dialog && (open = false)}
  style:height
  class="sheet mx-auto mt-auto mb-0 w-full max-w-md overflow-hidden rounded-t-[28px] border border-b-0 border-white/10 bg-panel/95 p-0 text-zinc-100 shadow-[0_-20px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl backdrop:bg-black/60 backdrop:backdrop-blur-sm
    {height ? '' : 'max-h-[88dvh]'}"
>
  <div class="flex h-full max-h-[inherit] flex-col">
    <div class="shrink-0 px-5 pt-3">
      <div class="mx-auto mb-2 h-1.5 w-10 rounded-full bg-zinc-600"></div>
      <div class="flex items-center justify-between {toolbar ? 'mb-3' : 'mb-4'}">
        <h2 class="text-lg font-semibold">{title}</h2>
        <button type="button" class="rounded-full px-3 py-1.5 text-sm font-medium text-sky-400 active:bg-white/10" onclick={() => (open = false)}>Done</button>
      </div>
      {#if toolbar}
        <div class="pb-3">{@render toolbar()}</div>
      {/if}
    </div>
    <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      {@render children()}
    </div>
  </div>
</dialog>

<style>
  .sheet[open] {
    animation: sheet-up 280ms cubic-bezier(0.2, 0.9, 0.3, 1);
  }
  .sheet[open]::backdrop {
    animation: fade-in 200ms ease-out;
  }
  @keyframes sheet-up {
    from {
      transform: translateY(100%);
    }
  }
  @keyframes fade-in {
    from {
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .sheet[open],
    .sheet[open]::backdrop {
      animation: none;
    }
  }
</style>
