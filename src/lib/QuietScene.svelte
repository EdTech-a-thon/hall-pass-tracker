<script lang="ts">
  /**
   * What Home shows when no class is on the kiosk: the sun over a quiet
   * forest, in flat shapes. No box around it and nothing moves: the hills
   * round off at their ends, so it sits on the page on its own.
   */
  let { message }: { message: string } = $props();

  /**
   * Trees stand on the hills' tops, so each has its own height off the
   * ground. The far ones, on the back hill's hump, are smaller; the near ones,
   * on the front hill, larger. Each is two flat greens, lit from the left.
   */
  type Tree = { kind: 'pine'; x: number; y: number; h: number } | { kind: 'round'; x: number; y: number; r: number };
  const farTrees: Tree[] = [
    { kind: 'pine', x: 316, y: 146, h: 42 },
    { kind: 'round', x: 343, y: 142, r: 12 },
    { kind: 'pine', x: 371, y: 140, h: 50 },
    { kind: 'round', x: 401, y: 144, r: 11 },
    { kind: 'pine', x: 427, y: 152, h: 38 },
  ];
  const nearTrees: Tree[] = [
    { kind: 'pine', x: 70, y: 206, h: 66 },
    { kind: 'round', x: 108, y: 199, r: 21 },
    { kind: 'pine', x: 146, y: 197, h: 78 },
    { kind: 'round', x: 300, y: 212, r: 14 },
  ];

  /** One tier of a pine: a wide triangle with soft corners, `w` across at its base. */
  function tier(top: number, base: number, w: number) {
    return `M0 ${top} Q2 ${top} 4 ${top + 3} L${w / 2} ${base - 2} Q${w / 2 + 1} ${base} ${w / 2 - 3} ${base} H${-w / 2 + 3} Q${-w / 2 - 1} ${base} ${-w / 2} ${base - 2} L-4 ${top + 3} Q-2 ${top} 0 ${top} Z`;
  }

  /** The tier's left half, in the lighter green, as if the sun is on that side. */
  function litSide(top: number, base: number, w: number) {
    return `M0 ${top} Q-2 ${top} -4 ${top + 3} L${-w / 2} ${base - 2} Q${-w / 2 - 1} ${base} ${-w / 2 + 3} ${base} H0 Z`;
  }
</script>

{#snippet drawTree(tree: Tree)}
  <g transform="translate({tree.x} {tree.y})">
    {#if tree.kind === 'pine'}
      {@const w = tree.h * 0.62}
      <rect x={-tree.h * 0.04} y={-tree.h * 0.16} width={tree.h * 0.08} height={tree.h * 0.18} rx="1.5" fill="#7a5a3a" />
      {#each [0, 1, 2] as level (level)}
        {@const top = -tree.h + level * tree.h * 0.26}
        {@const base = top + tree.h * 0.42}
        {@const width = w * (0.62 + level * 0.19)}
        <path d={tier(top, base, width)} fill="#1f6343" />
        <path d={litSide(top, base, width)} fill="#2f7a52" />
      {/each}
    {:else}
      {@const cy = -tree.r * 0.6 - tree.r * 0.95}
      <rect x={-tree.r * 0.15} y={-tree.r * 0.75} width={tree.r * 0.3} height={tree.r * 0.8} rx="2" fill="#7a5a3a" />
      <circle cx="0" {cy} r={tree.r} fill="#2f6b47" />
      <circle cx={-tree.r * 0.18} cy={cy - tree.r * 0.16} r={tree.r * 0.82} fill="#4a8a5c" />
      <circle cx={tree.r * 0.42} cy={cy - tree.r * 0.42} r={tree.r * 0.13} fill="#6ea978" />
    {/if}
  </g>
{/snippet}

<figure class="quiet">
  <svg viewBox="0 0 480 250" role="img" aria-label="The sun over a quiet forest">
    <g transform="translate(200 98)">
      {#each Array.from({ length: 12 }, (_, index) => index * 30) as angle (angle)}
        <line x1="0" y1="-46" x2="0" y2="-60" transform="rotate({angle})" stroke="#f59e0b" stroke-width="5" stroke-linecap="round" />
      {/each}
      <circle r="34" fill="#fbbf24" />
    </g>

    <!-- Clouds: a soft blue-white, so they read against the page. -->
    <g fill="#dde9f2">
      <path d="M70 70c-10 0-14-10-6-15 0-10 12-15 20-9 4-11 22-12 27-1 10-2 17 6 13 13 6 3 4 12-4 12z" />
      <path d="M358 50c-8 0-11-8-5-12 0-8 10-12 16-7 3-9 18-10 22-1 8-1 13 5 10 10 5 3 3 10-3 10z" />
    </g>

    <!-- The back hill rises to a big hump on the right; the front one is lower, highest on the left. -->
    <path
      d="M20 214c0-18 50-28 110-30 60-2 100-14 160-34 50-17 120-20 156 10 20 17 22 40 12 54-8 14-78 20-218 20S20 230 20 214z"
      fill="#cfe3cf"
    />
    {#each farTrees as tree (tree.x)}{@render drawTree(tree)}{/each}

    <path
      d="M36 228c0-22 54-34 124-32 70 2 130 16 200 18 60 2 92 8 92 18s-72 14-212 14S36 244 36 228z"
      fill="#a9cdb0"
    />
    {#each nearTrees as tree (tree.x)}{@render drawTree(tree)}{/each}
  </svg>
  <figcaption>{message}</figcaption>
</figure>

<style>
  /* It fills the space Home has free and sits in the middle of it. */
  .quiet {
    flex: 1;
    display: grid;
    align-content: center;
    justify-items: center;
    gap: 10px;
    margin: 0;
  }

  svg {
    width: min(100%, 520px);
    height: auto;
  }

  figcaption {
    color: var(--muted);
    font-size: 15px;
    font-weight: 700;
    text-align: center;
  }
</style>
