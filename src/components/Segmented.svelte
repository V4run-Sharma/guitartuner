<script lang="ts" generics="T extends string | number">
  interface Props {
    options: { value: T; label: string }[]
    value: T
    label: string
  }

  let { options, value = $bindable(), label }: Props = $props()
</script>

<div role="radiogroup" aria-label={label} class="grid gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]" style:grid-template-columns="repeat({options.length}, minmax(0, 1fr))">
  {#each options as option (option.value)}
    <button
      type="button"
      role="radio"
      aria-checked={value === option.value}
      class="rounded-lg px-2 py-2 text-sm font-medium transition-colors {value === option.value
        ? 'bg-zinc-100 text-zinc-900 shadow-[0_2px_8px_rgba(0,0,0,0.35)]'
        : 'text-zinc-400 active:bg-white/10'} outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      onclick={() => (value = option.value)}
    >
      {option.label}
    </button>
  {/each}
</div>
