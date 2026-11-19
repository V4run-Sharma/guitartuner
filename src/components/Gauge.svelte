<script lang="ts" module>
  export type Tone = 'idle' | 'good' | 'near' | 'far'

  export const TONE_COLORS: Record<Tone, string> = {
    idle: '#52525b',
    good: '#34d399',
    near: '#fbbf24',
    far: '#fb7185',
  }
</script>

<script lang="ts">
  interface Props {
    /** Cents off target, or null when nothing is detected. */
    cents: number | null
    tolerance: number
    tone: Tone
    /** False while showing a held (stale) reading. */
    live: boolean
  }

  let { cents, tolerance, tone, live }: Props = $props()

  const CX = 160
  const CY = 168
  const R = 138
  const SWEEP = 68 // degrees either side of centre at ±50 cents

  function point(c: number, radius: number): [number, number] {
    const a = ((c / 50) * SWEEP * Math.PI) / 180
    return [CX + radius * Math.sin(a), CY - radius * Math.cos(a)]
  }

  function arc(from: number, to: number, radius: number): string {
    const [x1, y1] = point(from, radius)
    const [x2, y2] = point(to, radius)
    return `M ${x1} ${y1} A ${radius} ${radius} 0 0 ${to > from ? 1 : 0} ${x2} ${y2}`
  }

  const ticks = Array.from({ length: 51 }, (_, i) => {
    const c = -50 + i * 2
    const major = c % 10 === 0
    const [x1, y1] = point(c, R - 16)
    const [x2, y2] = point(c, R - 16 - (c === 0 ? 16 : major ? 10 : 5))
    return { c, major, x1, y1, x2, y2 }
  })

  const labels = [-50, -25, 0, 25, 50].map((c) => {
    const [x, y] = point(c, R - 44)
    return { c, x, y, text: c > 0 ? `+${c}` : String(c) }
  })

  const [flatX, flatY] = point(-58, R)
  const [sharpX, sharpY] = point(58, R)

  const track = arc(-50, 50, R)
  const zone = $derived(arc(-tolerance, tolerance, R))
  const clamped = $derived(cents === null ? 0 : Math.max(-50, Math.min(50, cents)))
  const trail = $derived(Math.abs(clamped) > tolerance ? arc(0, clamped, R) : null)
  const angle = $derived((clamped / 50) * SWEEP)
  const color = $derived(TONE_COLORS[tone])
</script>

<svg viewBox="0 0 320 186" class="w-full overflow-visible select-none" role="img" aria-label={cents === null ? 'No pitch detected' : `${Math.round(cents)} cents`}>
  <defs>
    <linearGradient id="track" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#fb7185" />
      <stop offset="0.3" stop-color="#fbbf24" />
      <stop offset="0.5" stop-color="#34d399" />
      <stop offset="0.7" stop-color="#fbbf24" />
      <stop offset="1" stop-color="#fb7185" />
    </linearGradient>
    <linearGradient id="needle" x1="0" x2="0" y1="1" y2="0">
      <stop offset="0" stop-color={color} stop-opacity="0.35" />
      <stop offset="1" stop-color={color} />
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="5" result="blur" />
      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
  </defs>

  <!-- coloured track -->
  <path d={track} fill="none" stroke="url(#track)" stroke-width="12" stroke-linecap="round" opacity="0.16" />
  <path d={track} fill="none" stroke="url(#track)" stroke-width="2" stroke-linecap="round" opacity="0.5" />

  <!-- in-tune window -->
  <path d={zone} fill="none" stroke="#34d399" stroke-width="12" stroke-linecap="round" opacity={tone === 'good' ? 1 : 0.35} filter={tone === 'good' ? 'url(#glow)' : undefined} class="transition-opacity duration-200" />

  <!-- distance from target -->
  {#if trail}
    <path d={trail} fill="none" stroke={color} stroke-width="4" stroke-linecap="round" opacity={live ? 0.9 : 0.4} />
  {/if}

  {#each ticks as t (t.c)}
    <line x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={t.c === 0 ? '#f4f4f5' : t.major ? '#71717a' : '#3f3f46'} stroke-width={t.c === 0 ? 3 : t.major ? 2 : 1.5} stroke-linecap="round" />
  {/each}

  {#each labels as l (l.c)}
    <text x={l.x} y={l.y} fill="#71717a" font-size="10" font-weight="500" text-anchor="middle" dominant-baseline="middle" class="tabular-nums">{l.text}</text>
  {/each}

  <text x={flatX} y={flatY} fill="#a1a1aa" font-size="18" text-anchor="middle" dominant-baseline="middle">♭</text>
  <text x={sharpX} y={sharpY} fill="#a1a1aa" font-size="16" text-anchor="middle" dominant-baseline="middle">♯</text>

  <g class="needle" style:transform="rotate({angle}deg)" opacity={cents === null ? 0.25 : live ? 1 : 0.45} filter={cents !== null && live ? 'url(#glow)' : undefined}>
    <path d="M {CX - 4.5} {CY} L {CX - 1.2} {CY - R + 6} Q {CX} {CY - R + 2} {CX + 1.2} {CY - R + 6} L {CX + 4.5} {CY} Z" fill="url(#needle)" />
  </g>
  <circle cx={CX} cy={CY} r="13" fill="#0b0b10" stroke={color} stroke-width="3" class="transition-[stroke] duration-200" />
  <circle cx={CX} cy={CY} r="4.5" fill={color} class="transition-[fill] duration-200" />
</svg>

<style>
  .needle {
    transform-origin: 160px 168px;
    transition:
      transform 110ms ease-out,
      opacity 200ms;
  }
  @media (prefers-reduced-motion: reduce) {
    .needle {
      transition: none;
    }
  }
</style>
