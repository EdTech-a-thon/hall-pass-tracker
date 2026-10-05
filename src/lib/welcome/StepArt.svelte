<script lang="ts">
  import type { StepKey } from './steps';

  /** A drawing of the app's own screens for each step: the roster, the destinations, the kiosk. */
  let { step }: { step: StepKey } = $props();

  const names = ['Maya C.', 'Jordan E.', 'Elliot R.', 'Priya S.', 'Duncan J.', 'Leo M.', 'Josh P.', 'Ava T.', 'Sam K.'];
  const roster = ['Maya Chen', 'Jordan Ellis', 'Elliot Roe', 'Duncan Johnson', 'Josh Pullin'];
  const places = [
    { label: 'Bathroom', minutes: '5 min', strong: '#2361a6', soft: '#e1ecf8' },
    { label: 'Nurse', minutes: '15 min', strong: '#b03a68', soft: '#f8e2eb' },
    { label: 'Office', minutes: '10 min', strong: '#b4530b', soft: '#fbebd9' },
    { label: 'Library', minutes: '10 min', strong: '#6a4cbb', soft: '#ece6f8' },
  ];
  const labels = {
    class: 'A class roster with five students pasted in',
    destinations: 'A list of destinations, each with a time limit',
    kiosk: 'The kiosk by the door: students tap their name, and one is out at the bathroom',
  };
</script>

<div class="art" role="img" aria-label={labels[step]}>
  <svg viewBox="0 0 600 480">
    <defs>
      <!-- Measured in drawing units, not shape percentages, so small chips get as much shadow room as big panels. -->
      <filter id="art-shadow-{step}" filterUnits="userSpaceOnUse" x="-100" y="-100" width="800" height="700">
        <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#5a4320" flood-opacity=".12" />
      </filter>
    </defs>

    <!-- The sun, rising behind every step. -->
    <g transform="translate(470 70)">
      <circle r="58" fill="var(--sun)" opacity=".18" />
      <g stroke="var(--sun-ray)" stroke-width="7" stroke-linecap="round">
        <path d="M0-50v-14M0 50v14M-50 0h-14M50 0h14M-35-35l-10-10M35 35l10 10M-35 35l-10 10M35-35l10-10" />
      </g>
      <circle r="32" fill="var(--sun)" />
    </g>

    {#if step === 'kiosk'}
      <!-- A tablet by the door -->
      <g filter="url(#art-shadow-kiosk)">
        <rect x="70" y="70" width="430" height="330" rx="26" fill="#2f2a22" />
        <rect x="86" y="86" width="398" height="298" rx="14" fill="var(--bg)" />
      </g>
      <text x="110" y="122" class="eyebrow-text">PERIOD 2 · ENGLISH</text>
      <text x="110" y="150" class="title-text">Tap your name</text>
      {#each names as name, i (name)}
        {@const x = 110 + (i % 3) * 122}
        {@const y = 170 + Math.floor(i / 3) * 66}
        {@const out = name === 'Elliot R.'}
        <rect {x} {y} width="112" height="56" rx="10" fill={out ? '#fbefdc' : '#fff'} stroke={out ? '#e6c48f' : 'var(--border)'} />
        <text x={x + 14} y={y + (out ? 25 : 34)} class="name-text">{name}</text>
        {#if out}<text x={x + 14} y={y + 43} class="out-text">Out · Bathroom</text>{/if}
      {/each}

      <g transform="translate(330 400) rotate(-4)" filter="url(#art-shadow-kiosk)">
        <rect width="238" height="52" rx="14" fill="var(--accent)" />
        <text x="20" y="32" class="chip-text light">✓ Josh P. is back in class</text>
      </g>
      <g transform="translate(30 398) rotate(5)" filter="url(#art-shadow-kiosk)">
        <rect width="150" height="46" rx="13" fill="#fff" stroke="var(--border)" />
        <text x="18" y="29" class="chip-text">1 student out</text>
      </g>
    {:else if step === 'class'}
      <g filter="url(#art-shadow-class)">
        <rect x="110" y="70" width="360" height="350" rx="18" fill="var(--surface)" stroke="var(--border)" />
      </g>
      <text x="138" y="112" class="eyebrow-text">NEW CLASS</text>
      <text x="138" y="142" class="title-text">Period 2 · English</text>
      <rect x="138" y="164" width="304" height="228" rx="10" fill="#fff" stroke="var(--border-strong)" />
      {#each roster as name, i (name)}
        <text x="158" y={198 + i * 38} class="name-text">{name}</text>
      {/each}
      <rect x="157" y="372" width="2" height="18" fill="var(--accent)" />

      <g transform="translate(360 396) rotate(-4)" filter="url(#art-shadow-class)">
        <rect width="200" height="52" rx="14" fill="var(--accent)" />
        <text x="22" y="32" class="chip-text light">✓ 5 students added</text>
      </g>
    {:else}
      <g filter="url(#art-shadow-destinations)">
        <rect x="100" y="80" width="380" height="330" rx="18" fill="var(--surface)" stroke="var(--border)" />
      </g>
      <text x="128" y="122" class="eyebrow-text">DESTINATIONS</text>
      <text x="128" y="152" class="title-text">Where students go</text>
      {#each places as place, i (place.label)}
        {@const y = 176 + i * 56}
        <rect x="128" {y} width="324" height="46" rx="10" fill="#fff" stroke="var(--border)" />
        <rect x="140" y={y + 9} width="28" height="28" rx="8" fill={place.soft} />
        <circle cx="154" cy={y + 23} r="6" fill={place.strong} />
        <text x="182" y={y + 28} class="name-text">{place.label}</text>
        <text x="436" y={y + 28} class="muted-text" text-anchor="end">{place.minutes}</text>
      {/each}

      <g transform="translate(40 330) rotate(-5)" filter="url(#art-shadow-destinations)">
        <rect width="170" height="48" rx="14" fill="#fff" stroke="var(--border)" />
        <text x="20" y="30" class="chip-text">+ Add a place</text>
      </g>
    {/if}
  </svg>
</div>

<style>
  .art {
    width: 100%;
    max-width: 580px;
  }

  svg {
    display: block;
    width: 100%;
    height: auto;
    /* Let the shadows of chips near the bottom edge spill past the drawing instead of being cut off. */
    overflow: visible;
    font-family: var(--sans);
  }

  .eyebrow-text {
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.12em;
    fill: var(--faint);
  }

  .title-text {
    font-size: 22px;
    font-weight: 800;
    fill: var(--text);
  }

  .name-text {
    font-size: 15px;
    font-weight: 700;
    fill: var(--text);
  }

  .out-text {
    font-size: 12px;
    font-weight: 700;
    fill: #a8620f;
  }

  .muted-text {
    font-size: 14px;
    font-weight: 600;
    fill: var(--muted);
  }

  .chip-text {
    font-size: 16px;
    font-weight: 800;
    fill: var(--text);
  }

  .chip-text.light {
    fill: #fff;
  }
</style>
