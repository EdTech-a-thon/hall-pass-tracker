<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { setDoorLocked } from '#lib/account.svelte.ts';
  import {
    activeDoorClass,
    changeClass,
    checkPin,
    connectToLaptop,
    dismissNotice,
    door,
    forgetDevice,
    isLocal,
    openPassFor,
    outCount,
    pairWithCode,
    requestPass,
    setup,
    signBackIn,
    undoPass,
    waitingCount,
  } from '#lib/door.svelte.ts';
  import Icon from '#lib/Icon.svelte';

  const local = $derived(isLocal());
  const paired = $derived(!!door.device);
  const cls = $derived(activeDoorClass());

  let code = $state(page.url.searchParams.get('code') ?? '');
  let choosingFor = $state(null as { id: string; name: string } | null);
  /** The teacher menu: closed, asking for the PIN, or open. */
  let teacher = $state('closed' as 'closed' | 'pin' | 'menu');
  let pin = $state('');
  let pinError = $state('');
  let confirmForget = $state(false);

  // Opening the door screen locks it (on the laptop) or connects it (on a paired device).
  onMount(() => {
    if (local) setDoorLocked(true);
    else if (paired) connectToLaptop();
  });

  // Arriving from the QR code: pair straight away.
  let autoPaired = false;
  $effect(() => {
    if (!autoPaired && !local && !paired && /^\d{6}$/.test(code)) {
      autoPaired = true;
      pairWithCode(code);
    }
  });

  function submitCode(event: SubmitEvent) {
    event.preventDefault();
    if (/^\d{6}$/.test(code)) pairWithCode(code);
  }

  function tap(student: { id: string; name: string }) {
    if (openPassFor(student.id)) signBackIn(student.id);
    else choosingFor = student;
  }

  function choose(destination: string) {
    if (!choosingFor) return;
    requestPass(choosingFor.id, destination);
    choosingFor = null;
  }

  function openTeacher() {
    teacher = 'pin';
    pin = '';
    pinError = '';
    confirmForget = false;
  }

  function submitPin(event: SubmitEvent) {
    event.preventDefault();
    if (checkPin(pin)) {
      teacher = 'menu';
    } else {
      pinError = "That PIN isn't right.";
      pin = '';
    }
  }

  function switchTo(classId: string) {
    changeClass(classId);
    teacher = 'closed';
  }

  function exitToTeacher() {
    setDoorLocked(false);
    goto('/kiosk');
  }

  function stopBeingKiosk() {
    forgetDevice();
    teacher = 'closed';
  }
</script>

<svelte:head><title>Hallway kiosk</title></svelte:head>

<div class="door">
  {#if !local && !paired}
    <!-- Not a kiosk yet: pair with the teacher's laptop. -->
    <main class="pairing">
      <span class="mark"><Icon name="door" size={26} /></span>
      <h1>Make this device the kiosk</h1>
      {#if door.status === 'replaced'}
        <p class="lede">This device is no longer the kiosk. A different one was paired on the teacher's laptop.</p>
      {/if}
      <p class="lede">
        On the teacher's laptop, open Hallway and go to <strong>Kiosk → Pair a device</strong>. Then type the 6-digit
        code here, or scan the QR code with this device's camera.
      </p>
      <form onsubmit={submitCode}>
        <input
          class="code-input"
          inputmode="numeric"
          autocomplete="off"
          maxlength="6"
          aria-label="Pairing code"
          placeholder="000000"
          bind:value={code}
        />
        <button class="door-btn primary" disabled={!/^\d{6}$/.test(code) || door.pairing.state === 'connecting'}>
          {door.pairing.state === 'connecting' ? 'Connecting…' : 'Connect'}
        </button>
      </form>
      {#if door.pairing.state === 'error'}<p class="door-error" role="alert">{door.pairing.message}</p>{/if}
      <a class="quiet-link" href="/">This is the teacher's computer</a>
    </main>
  {:else}
    <header class="door-head">
      <div>
        <p class="door-eyebrow">{cls?.name ?? 'Hallway'}</p>
        <h1>Tap your name</h1>
      </div>
      {#if paired}
        <p class="connection" class:live={door.status === 'live'}>
          <span class="dot"></span>
          {#if door.status === 'live'}
            Connected
          {:else if waitingCount()}
            Offline · {waitingCount()} {waitingCount() === 1 ? 'pass' : 'passes'} saved here
          {:else}
            Offline
          {/if}
        </p>
      {/if}
    </header>

    {#if cls}
      {#if !cls.destinations.length}
        <p class="door-error">Your teacher hasn't set up any destinations for this class yet.</p>
      {/if}
      <main class="names" aria-label="Students in {cls.name}">
        {#each cls.students as student (student.id)}
          {@const pass = openPassFor(student.id)}
          <!-- Where they went, never how long: the door carries no clock. See docs/adr/0003. -->
          <button class="name" class:out={pass} onclick={() => tap(student)}>
            <span class="name-text">{student.name}</span>
            <span class="name-status">{pass ? `Out · ${pass.destination}` : 'In class'}</span>
          </button>
        {:else}
          <p class="lede">There are no students on this class's roster yet.</p>
        {/each}
      </main>
      <p class="count">{outCount(cls.id)} of {cls.limit} out</p>
    {:else}
      <main class="pairing">
        <p class="lede">No class is on the kiosk yet. Teacher: choose one from your laptop, or tap Teacher below.</p>
      </main>
    {/if}

    <button class="teacher-btn" onclick={openTeacher}><Icon name="lock" size={15} />Teacher</button>
  {/if}

  {#if choosingFor && cls}
    <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="choose-title">
      <div class="sheet">
        <p class="door-eyebrow">Pass for</p>
        <h2 id="choose-title">{choosingFor.name}</h2>
        <p class="lede">Where are you going?</p>
        <div class="choices">
          {#each cls.destinations as destination (destination.label)}
            <button class="door-btn choice" onclick={() => choose(destination.label)}>{destination.label}</button>
          {/each}
        </div>
        <button class="quiet-link" onclick={() => (choosingFor = null)}>Cancel</button>
      </div>
    </div>
  {/if}

  {#if door.notice}
    <div class="notice {door.notice.kind}" role="status">
      <span class="notice-symbol"><Icon name={door.notice.kind === 'denied' ? 'x' : 'check'} size={46} stroke={2.5} /></span>
      <p class="door-eyebrow">
        {door.notice.kind === 'denied' ? 'Not right now' : door.notice.kind === 'returned' ? 'Welcome back' : 'Pass approved'}
      </p>
      <h2>{door.notice.title}</h2>
      <p class="notice-message">{door.notice.message}</p>
      <div class="notice-actions">
        {#if door.notice.undoPassId}
          <button class="door-btn" onclick={() => undoPass(door.notice!.undoPassId!)}>That's not me</button>
        {/if}
        <button class="door-btn" onclick={dismissNotice}>Done</button>
      </div>
    </div>
  {/if}

  {#if teacher !== 'closed'}
    <div class="overlay" role="dialog" aria-modal="true" aria-label="Teacher menu">
      <div class="sheet">
        {#if teacher === 'pin'}
          <h2>Teacher PIN</h2>
          <form onsubmit={submitPin}>
            <!-- svelte-ignore a11y_autofocus -->
            <input class="code-input" type="password" inputmode="numeric" autocomplete="off" aria-label="PIN" bind:value={pin} autofocus />
            <button class="door-btn primary">Unlock</button>
          </form>
          {#if pinError}<p class="door-error" role="alert">{pinError}</p>{/if}
        {:else if confirmForget}
          <h2>Stop being the kiosk?</h2>
          {#if waitingCount()}
            <p class="door-error">
              {waitingCount()} {waitingCount() === 1 ? 'pass hasn’t' : 'passes haven’t'} reached the laptop yet and will be lost.
            </p>
          {/if}
          <div class="choices">
            <button class="door-btn danger" onclick={stopBeingKiosk}>Unpair this device</button>
          </div>
        {:else}
          <h2>Switch class</h2>
          <div class="choices">
            {#each setup()?.classes ?? [] as option (option.id)}
              <button class="door-btn choice" class:current={option.id === cls?.id} onclick={() => switchTo(option.id)}>
                {option.name}
              </button>
            {/each}
          </div>
          <p class="lede small">Students still out in the current class will have their passes ended.</p>
          {#if local}
            <button class="door-btn" onclick={exitToTeacher}><Icon name="unlock" size={16} />Exit kiosk</button>
          {:else}
            <button class="door-btn" onclick={() => (confirmForget = true)}>Unpair this device</button>
          {/if}
        {/if}
        <button class="quiet-link" onclick={() => (teacher = 'closed')}>Cancel</button>
      </div>
    </div>
  {/if}
</div>

<style>
  /* The door screen is dark and high-contrast: it sits on a wall all day and is read from across the room. */
  .door {
    --door-bg: #0f1a14;
    --door-tile: #1a2a21;
    --door-line: #2c4135;
    --door-text: #f1f5f2;
    --door-muted: #a9b9af;
    --door-accent: #5cc98b;
    --door-out: #f0b45a;
    min-height: 100vh;
    padding: 28px clamp(16px, 4vw, 48px) 90px;
    background: var(--door-bg);
    color: var(--door-text);
    color-scheme: dark;
  }

  h1 {
    font-size: clamp(28px, 4vw, 40px);
  }

  h2 {
    font-size: 28px;
  }

  .door-eyebrow {
    color: var(--door-accent);
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .lede {
    color: var(--door-muted);
    font-size: 17px;
    max-width: 52ch;
  }

  .small {
    font-size: 14px;
  }

  .door-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 16px;
    margin-bottom: 24px;
  }

  .connection {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--door-muted);
    font-size: 14px;
    font-weight: 700;
  }

  .connection .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--door-out);
  }

  .connection.live .dot {
    background: var(--door-accent);
  }

  .names {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 12px;
  }

  .name {
    display: grid;
    gap: 4px;
    min-height: 92px;
    padding: 16px;
    border: 1px solid var(--door-line);
    border-radius: 12px;
    background: var(--door-tile);
    text-align: left;
    cursor: pointer;
  }

  .name:hover {
    border-color: var(--door-accent);
  }

  .name-text {
    font-size: 21px;
    font-weight: 800;
  }

  .name-status {
    color: var(--door-muted);
    font-size: 14px;
    font-weight: 700;
  }

  .name.out {
    border-color: var(--door-out);
    background: #2a2416;
  }

  .name.out .name-status {
    color: var(--door-out);
  }

  .count {
    margin-top: 20px;
    color: var(--door-muted);
    font-weight: 700;
  }

  .teacher-btn {
    position: fixed;
    right: 18px;
    bottom: 18px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border: 1px solid var(--door-line);
    border-radius: 8px;
    background: transparent;
    color: var(--door-muted);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
  }

  .pairing {
    display: grid;
    justify-items: center;
    gap: 16px;
    max-width: 560px;
    margin: 8vh auto 0;
    text-align: center;
  }

  .pairing .lede {
    margin: 0 auto;
  }

  .mark {
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    border-radius: 14px;
    background: #1e5738;
  }

  form {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .code-input {
    width: 220px;
    padding: 12px 14px;
    border: 1px solid var(--door-line);
    border-radius: 10px;
    background: var(--door-tile);
    color: var(--door-text);
    font: 700 28px/1 ui-monospace, 'SF Mono', Menlo, monospace;
    letter-spacing: 0.2em;
    text-align: center;
  }

  .door-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 52px;
    padding: 12px 20px;
    border: 1px solid var(--door-line);
    border-radius: 10px;
    background: var(--door-tile);
    color: var(--door-text);
    font-size: 17px;
    font-weight: 800;
    cursor: pointer;
  }

  .door-btn.primary {
    background: var(--door-accent);
    border-color: var(--door-accent);
    color: #0b2016;
  }

  .door-btn.danger {
    background: #8d2c1c;
    border-color: #8d2c1c;
  }

  .door-btn:disabled {
    opacity: 0.5;
  }

  .door-btn.current {
    border-color: var(--door-accent);
  }

  .door-error {
    color: #ffb4a3;
    font-weight: 700;
  }

  .quiet-link {
    border: 0;
    background: none;
    color: var(--door-muted);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
  }

  .overlay {
    position: fixed;
    inset: 0;
    z-index: 10;
    display: grid;
    place-items: center;
    padding: 16px;
    background: rgb(5 10 7 / 80%);
  }

  .sheet {
    display: grid;
    gap: 16px;
    width: min(560px, 100%);
    padding: 28px;
    border: 1px solid var(--door-line);
    border-radius: 16px;
    background: #14231a;
    text-align: center;
  }

  .sheet .lede {
    margin: 0 auto;
  }

  .choices {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 10px;
  }

  .door-btn.choice {
    min-height: 72px;
    font-size: 20px;
  }

  .notice {
    position: fixed;
    inset: 0;
    z-index: 20;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 12px;
    padding: 24px;
    text-align: center;
    background: #14513a;
  }

  .notice.denied {
    background: #5a3a12;
  }

  .notice.returned {
    background: #1d3f5c;
  }

  .notice .door-eyebrow {
    color: rgb(255 255 255 / 75%);
  }

  .notice h2 {
    font-size: clamp(32px, 5vw, 52px);
  }

  .notice-symbol {
    display: grid;
    place-items: center;
    width: 86px;
    height: 86px;
    border-radius: 50%;
    background: rgb(255 255 255 / 14%);
  }

  .notice-message {
    font-size: clamp(20px, 3vw, 28px);
    font-weight: 700;
    max-width: 30ch;
  }

  .notice-actions {
    display: flex;
    gap: 12px;
    margin-top: 12px;
  }

  .notice .door-btn {
    background: rgb(255 255 255 / 12%);
    border-color: rgb(255 255 255 / 25%);
  }
</style>
