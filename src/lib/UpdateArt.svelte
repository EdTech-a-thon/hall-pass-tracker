<script lang="ts">
  import type { UpdateArt } from './updates';

  /** A drawing of the app's own screens for one "What's changed" item, in the style of the welcome tour. */
  let { art }: { art: UpdateArt } = $props();

  const restroom = { strong: '#2361a6', soft: '#e1ecf8' };
  const nurse = { strong: '#b03a68', soft: '#f8e2eb' };
  const counselor = { strong: '#6a4cbb', soft: '#ece6f8' };

  const labels: Record<UpdateArt, string> = {
    'destination-limits':
      'The kiosk asking where a student is going: the Restroom is full with 2 waiting, while the Nurse and the Counselor are open',
    'let-go': 'The Let a student go list: Maya is held by No-Pass Time and Jordan is waiting in line, each with a button to let them go',
    'check-destinations': 'The destinations list: the Restroom is one at a time, the Nurse and the Counselor have no limit',
    schedule: 'A day calendar for A Day: Biology, then Chemistry, then lunch, with a line marking now inside Chemistry',
    'no-pass-rules': 'Schedule settings reading: First 10 minutes of every class, and Last 5 minutes of every class, are no-pass time',
  };
  const periodLook = { strong: '#2a7a52', soft: '#e3f1e9' };
</script>

<div class="art" role="img" aria-label={labels[art]}>
  <svg viewBox="0 0 400 270">
    <defs>
      <filter id="update-shadow-{art}" filterUnits="userSpaceOnUse" x="-60" y="-60" width="520" height="400">
        <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#5a4320" flood-opacity=".12" />
      </filter>
    </defs>

    {#if art === 'destination-limits'}
      <g filter="url(#update-shadow-{art})">
        <rect x="20" y="16" width="360" height="238" rx="20" fill="#2f2a22" />
        <rect x="32" y="28" width="336" height="214" rx="12" fill="var(--bg)" />
      </g>
      <text x="200" y="60" class="eyebrow-text" text-anchor="middle">PASS FOR MAYA C.</text>
      <text x="200" y="86" class="title-text" text-anchor="middle">Where are you going?</text>
      {#each [{ label: 'Restroom', look: restroom, status: 'Full · 2 waiting' }, { label: 'Nurse', look: nurse, status: '' }, { label: 'Counselor', look: counselor, status: '' }] as place, i (place.label)}
        {@const y = 104 + i * 44}
        <rect x="56" {y} width="288" height="36" rx="9" fill="#fff" stroke="var(--border)" />
        <rect x="64" y={y + 6} width="24" height="24" rx="7" fill={place.look.soft} />
        <circle cx="76" cy={y + 18} r="5" fill={place.look.strong} />
        <text x="98" y={y + 23} class="name-text">{place.label}</text>
        {#if place.status}<text x="332" y={y + 23} class="out-text" text-anchor="end">{place.status}</text>{/if}
      {/each}
    {:else if art === 'let-go'}
      <g filter="url(#update-shadow-{art})">
        <rect x="24" y="20" width="352" height="228" rx="16" fill="var(--surface)" stroke="var(--border)" />
      </g>
      <text x="48" y="56" class="eyebrow-text">NOW · PERIOD 3</text>
      <text x="48" y="82" class="title-text">Let a student go</text>
      {#each [{ name: 'Maya C.', hold: 'No-pass time', given: false }, { name: 'Jordan E.', hold: 'Waiting for Restroom (1st)', given: true }, { name: 'Ava T.', hold: '', given: false }] as row, i (row.name)}
        {@const y = 100 + i * 46}
        <line x1="48" x2="352" y1={y} y2={y} stroke="var(--border)" />
        <text x="48" y={y + 20} class="name-text">{row.name}</text>
        {#if row.hold}
          <rect x="48" y={y + 27} width={row.hold.length * 5.6 + 14} height="16" rx="8" fill={row.given ? '#e1f0e6' : '#fbefdc'} />
          <text x="55" y={y + 39} class="badge-text" fill={row.given ? '#1e6b43' : '#a8620f'}>{row.hold}</text>
        {:else}
          <text x="48" y={y + 38} class="muted-text">Nothing's stopping them</text>
        {/if}
        {#if row.hold && !row.given}
          <rect x="232" y={y + 10} width="120" height="28" rx="8" fill="var(--accent)" />
          <text x="292" y={y + 29} class="button-text" text-anchor="middle">Let Maya C. go</text>
        {:else if row.given}
          <text x="352" y={y + 29} class="ok-text" text-anchor="end">✓ Let go</text>
        {/if}
      {/each}
    {:else if art === 'schedule'}
      <g filter="url(#update-shadow-{art})">
        <rect x="24" y="20" width="352" height="228" rx="16" fill="var(--surface)" stroke="var(--border)" />
      </g>
      <text x="48" y="56" class="eyebrow-text">SCHEDULE · A DAY</text>
      {#each ['8 AM', '9 AM', '10 AM', '11 AM'] as hour, i (hour)}
        <text x="48" y={86 + i * 44} class="muted-text">{hour}</text>
        <line x1="96" x2="352" y1={82 + i * 44} y2={82 + i * 44} stroke="var(--border)" />
      {/each}
      {#each [{ label: 'Biology', y: 86, h: 38 }, { label: 'Chemistry', y: 130, h: 50 }, { label: 'No class · Lunch', y: 186, h: 30 }] as block (block.label)}
        <rect x="100" y={block.y} width="248" height={block.h} rx="8" fill={block.label.startsWith('No') ? 'var(--bg)' : periodLook.soft} stroke={block.label.startsWith('No') ? 'var(--border)' : periodLook.strong} stroke-opacity=".35" />
        <text x="112" y={block.y + 20} class="name-text">{block.label}</text>
      {/each}
      <line x1="96" x2="352" y1="152" y2="152" stroke="#c2412d" stroke-width="2" />
      <circle cx="96" cy="152" r="4" fill="#c2412d" />
    {:else if art === 'no-pass-rules'}
      <g filter="url(#update-shadow-{art})">
        <rect x="24" y="20" width="352" height="228" rx="16" fill="var(--surface)" stroke="var(--border)" />
      </g>
      <text x="48" y="56" class="eyebrow-text">NO-PASS TIMES</text>
      <text x="48" y="82" class="title-text">Keep students in class</text>
      {#each [{ edge: 'First', minutes: '10' }, { edge: 'Last', minutes: '5' }] as rule, i (rule.edge)}
        {@const y = 104 + i * 48}
        <rect x="48" {y} width="304" height="38" rx="9" fill="#fff" stroke="var(--border)" />
        <rect x="58" y={y + 8} width="44" height="22" rx="6" fill="var(--bg)" stroke="var(--border)" />
        <text x="80" y={y + 24} class="badge-text" text-anchor="middle" fill="var(--text)">{rule.edge}</text>
        <rect x="110" y={y + 8} width="30" height="22" rx="6" fill="var(--bg)" stroke="var(--border)" />
        <text x="125" y={y + 24} class="badge-text" text-anchor="middle" fill="var(--text)">{rule.minutes}</text>
        <text x="148" y={y + 24} class="muted-text">minutes of every class</text>
      {/each}
      <rect x="48" y="210" width="150" height="16" rx="8" fill="#fbefdc" />
      <text x="56" y="222" class="badge-text" fill="#a8620f">No passes · open at 9:10</text>
    {:else}
      <g filter="url(#update-shadow-{art})">
        <rect x="24" y="20" width="352" height="228" rx="16" fill="var(--surface)" stroke="var(--border)" />
      </g>
      <text x="48" y="56" class="eyebrow-text">DESTINATIONS</text>
      <text x="48" y="82" class="title-text">Where students go</text>
      {#each [{ label: 'Restroom', look: restroom, limit: '1 at a time' }, { label: 'Nurse', look: nurse, limit: 'No limit' }, { label: 'Counselor', look: counselor, limit: 'No limit' }] as place, i (place.label)}
        {@const y = 100 + i * 46}
        <rect x="48" {y} width="304" height="38" rx="9" fill="#fff" stroke="var(--border)" />
        <rect x="56" y={y + 7} width="24" height="24" rx="7" fill={place.look.soft} />
        <circle cx="68" cy={y + 19} r="5" fill={place.look.strong} />
        <text x="90" y={y + 24} class="name-text">{place.label}</text>
        <text x="340" y={y + 24} class="muted-text" text-anchor="end">{place.limit}</text>
      {/each}
    {/if}
  </svg>
</div>

<style>
  .art {
    width: 100%;
  }

  svg {
    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
    font-family: var(--sans);
  }

  .eyebrow-text {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.12em;
    fill: var(--faint);
  }

  .title-text {
    font-size: 18px;
    font-weight: 800;
    fill: var(--text);
  }

  .name-text {
    font-size: 14px;
    font-weight: 700;
    fill: var(--text);
  }

  .out-text {
    font-size: 12px;
    font-weight: 800;
    fill: #a8620f;
  }

  .muted-text {
    font-size: 12px;
    font-weight: 600;
    fill: var(--muted);
  }

  .badge-text {
    font-size: 10.5px;
    font-weight: 700;
  }

  .button-text {
    font-size: 12px;
    font-weight: 800;
    fill: #fff;
  }

  .ok-text {
    font-size: 13px;
    font-weight: 800;
    fill: var(--accent);
  }
</style>
