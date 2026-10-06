<script lang="ts">
  import type { PopupArt } from './popups';

  /** A drawing of the app's own screens for one "What's changed" item, in the style of the welcome tour. */
  let { art }: { art: PopupArt } = $props();

  const restroom = { strong: '#2361a6', soft: '#e1ecf8' };
  const nurse = { strong: '#b03a68', soft: '#f8e2eb' };
  const counselor = { strong: '#6a4cbb', soft: '#ece6f8' };

  const labels: Record<PopupArt, string> = {
    'destination-limits':
      'The kiosk asking where a student is going: the Restroom is full with 2 waiting, while the Nurse and the Counselor are open',
    home: 'The sidebar status box: Period 3, kiosk online, A Day, 1 request, above the list of settings',
    requests: 'A request on Home: Maya C. asks to go to the Restroom, out of passes, with Deny and Approve buttons',
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
    {:else if art === 'home'}
      <g filter="url(#update-shadow-{art})">
        <rect x="24" y="20" width="352" height="228" rx="16" fill="var(--surface)" stroke="var(--border)" />
      </g>
      <text x="48" y="54" class="name-text">☀ Happy Hallways</text>
      <rect x="44" y="68" width="200" height="104" rx="10" fill="var(--accent-wash)" stroke="#a9c9b2" />
      <text x="58" y="88" class="eyebrow-text" style="fill:var(--accent)">HOME</text>
      <text x="58" y="108" class="name-text">Period 3</text>
      <circle cx="62" cy="124" r="4" fill="var(--live)" />
      <text x="74" y="128" class="muted-text">Kiosk online</text>
      <text x="58" y="146" class="muted-text">▦  A Day</text>
      <text x="58" y="164" class="muted-text" style="fill:#6a4cbb;font-weight:800">✋ 1 request</text>
      {#each ['Classes', 'Destinations', 'Schedule', 'History'] as item, i (item)}
        <text x="58" y={196 + i * 15} class="muted-text" style="font-size:11px">{item}</text>
      {/each}
      <text x="262" y="100" class="muted-text">Click it from</text>
      <text x="262" y="116" class="muted-text">any page to</text>
      <text x="262" y="132" class="muted-text">get back to</text>
      <text x="262" y="148" class="name-text" style="fill:var(--accent)">Home</text>
    {:else if art === 'requests'}
      <g filter="url(#update-shadow-{art})">
        <rect x="24" y="20" width="352" height="228" rx="16" fill="var(--surface)" stroke="var(--border)" />
      </g>
      <text x="48" y="56" class="eyebrow-text">REQUESTS</text>
      <text x="48" y="82" class="title-text">1 waiting for you</text>
      <line x1="48" x2="352" y1="100" y2="100" stroke="var(--border)" />
      <text x="48" y="124" class="name-text">Maya C.</text>
      <rect x="112" y="110" width="24" height="20" rx="6" fill={restroom.soft} />
      <circle cx="124" cy="120" r="4.5" fill={restroom.strong} />
      <text x="142" y="124" class="muted-text">Restroom · just now</text>
      <rect x="48" y="136" width="92" height="18" rx="9" fill="#fbefdc" />
      <text x="58" y="149" class="badge-text" fill="#a8620f">Out of passes</text>
      <rect x="186" y="172" width="70" height="30" rx="8" fill="#fff" stroke="var(--border-strong)" />
      <text x="221" y="192" class="name-text" text-anchor="middle" style="font-size:12.5px">Deny</text>
      <rect x="264" y="172" width="88" height="30" rx="8" fill="var(--accent)" />
      <text x="308" y="192" class="button-text" text-anchor="middle">✓ Approve</text>
      <text x="48" y="230" class="muted-text">Approve, and her pass starts right away.</text>
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
</style>
