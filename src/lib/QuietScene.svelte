<script lang="ts">
  /**
   * What Home shows when no class is on the kiosk: the sun over a quiet
   * forest. Its rays turn slowly and the clouds drift; nothing moves for
   * anyone who has asked their computer for less motion.
   */
  let { message }: { message: string } = $props();
</script>

<figure class="quiet">
  <svg viewBox="0 0 480 260" role="img" aria-label="The sun shining over a quiet forest">
    <defs>
      <linearGradient id="quiet-sky" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="#fdf3dc" />
        <stop offset="1" stop-color="#faf6ee" />
      </linearGradient>
      <clipPath id="quiet-frame"><rect width="480" height="260" rx="18" /></clipPath>
    </defs>
    <g clip-path="url(#quiet-frame)">
    <rect width="480" height="260" fill="url(#quiet-sky)" />

    <g class="sun" transform="translate(240 112)">
      <g class="rays">
        {#each Array.from({ length: 12 }, (_, index) => index * 30) as angle (angle)}
          <line x1="0" y1="-46" x2="0" y2="-60" transform="rotate({angle})" stroke="#f59e0b" stroke-width="5" stroke-linecap="round" />
        {/each}
      </g>
      <circle r="34" fill="#fbbf24" />
    </g>

    <g class="cloud cloud-one" fill="#fff" opacity=".9">
      <ellipse cx="96" cy="70" rx="34" ry="12" />
      <ellipse cx="114" cy="62" rx="20" ry="12" />
    </g>
    <g class="cloud cloud-two" fill="#fff" opacity=".8">
      <ellipse cx="380" cy="52" rx="28" ry="10" />
      <ellipse cx="366" cy="46" rx="16" ry="10" />
    </g>

    <path d="M0 196 Q120 150 240 184 T480 172 V260 H0 Z" fill="#cfe3cf" />
    <path d="M0 220 Q140 186 280 210 T480 204 V260 H0 Z" fill="#a9cdb0" />

    {#each [{ x: 52, h: 58 }, { x: 84, h: 44 }, { x: 118, h: 64 }, { x: 352, h: 60 }, { x: 386, h: 46 }, { x: 420, h: 66 }, { x: 448, h: 50 }] as tree, index (tree.x)}
      <g class="tree" style="--delay: {index * -0.7}s" transform="translate({tree.x} {226 - tree.h})">
        <rect x="-3" y={tree.h - 6} width="6" height="14" rx="2" fill="#7a5a3a" />
        <path d="M0 0 L{tree.h * 0.32} {tree.h} H{-tree.h * 0.32} Z" fill="#1f6343" />
      </g>
    {/each}

    <path d="M196 260 Q232 222 240 214 Q248 222 284 260 Z" fill="#efe4cf" />
    </g>
  </svg>
  <figcaption>{message}</figcaption>
</figure>

<style>
  .quiet {
    display: grid;
    justify-items: center;
    gap: 14px;
    margin: 12px 0 0;
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

  .rays {
    animation: turn 60s linear infinite;
  }

  .cloud-one {
    animation: drift 18s ease-in-out infinite alternate;
  }

  .cloud-two {
    animation: drift 24s ease-in-out infinite alternate-reverse;
  }

  .tree {
    transform-box: fill-box;
    transform-origin: 50% 100%;
    animation: sway 6s ease-in-out infinite alternate;
    animation-delay: var(--delay);
  }

  @keyframes turn {
    to {
      rotate: 360deg;
    }
  }

  @keyframes drift {
    from {
      translate: -10px 0;
    }
    to {
      translate: 14px 0;
    }
  }

  @keyframes sway {
    from {
      rotate: -1.2deg;
    }
    to {
      rotate: 1.2deg;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .rays,
    .cloud,
    .tree {
      animation: none;
    }
  }
</style>
