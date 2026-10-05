<script lang="ts">
  import { goto, replaceState } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { setDoorLocked } from '#lib/account.svelte.ts';
  import {
    activeDoorClass,
    allowanceFor,
    changeClass,
    checkPin,
    clearLine,
    connectToLaptop,
    dismissNotice,
    door,
    forgetDevice,
    isFull,
    isLocal,
    joinLine,
    leaveLine,
    line,
    lineSpotFor,
    noPassNow,
    openPassFor,
    outCount,
    pairWithCode,
    requestPass,
    setup,
    signBackIn,
    undoPass,
    upNext,
    waitingCount,
  } from '#lib/door.svelte.ts';
  import BrandMark from '#lib/BrandMark.svelte';
  import DestinationIcon from '#lib/DestinationIcon.svelte';
  import Icon from '#lib/Icon.svelte';
  import { askBeforeLeaving } from '#lib/leaving.ts';
  import Modal from '#lib/Modal.svelte';
  import { formatClock } from '#lib/schedule.ts';

  const local = $derived(isLocal());
  const paired = $derived(!!door.device);
  const cls = $derived(activeDoorClass());
  const destinations = $derived(setup()?.destinations ?? []);
  // No-Pass Times start and end on their own, so look at the clock regularly.
  let clock = $state(Date.now());
  onMount(() => {
    const timer = setInterval(() => (clock = Date.now()), 15_000);
    return () => clearInterval(timer);
  });

  const waiting = $derived(line());
  /** Each destination's line, in the order the destinations are listed. */
  const lines = $derived(
    destinations
      .map((destination) => ({ destination: destination.label, spots: line(destination.label) }))
      .filter((each) => each.spots.length),
  );
  const ready = $derived(upNext(clock));
  const isUpNext = (studentId: string) => ready.some((spot) => spot.studentId === studentId);
  const blocked = $derived(noPassNow(clock));

  let code = $state(page.url.searchParams.get('code') ?? '');
  let choosingFor = $state(null as { id: string; name: string } | null);
  /** A student in the Line who tapped their name before it was their turn. */
  let waitingFor = $state(null as { id: string; name: string } | null);
  /** The teacher menu: closed, asking for the PIN, or open. */
  let teacher = $state('closed' as 'closed' | 'pin' | 'menu');
  /** Set while the PIN is asked for to let a student go past whatever is stopping them. */
  let lettingGo = $state(null as { studentId: string; destination: string } | null);
  let pin = $state('');
  let pinError = $state('');
  let confirmForget = $state(false);

  onMount(() => {
    // Opening the door screen locks it (on the laptop) or connects it (on a paired device).
    if (local) setDoorLocked(true);
    else if (paired) connectToLaptop();
    // Arriving from the QR code: pair straight away, then drop the code from the
    // address so a later reload never retries a code that has been used up.
    if (page.url.searchParams.has('code')) replaceState('/door', {});
    else return;
    if (!local && !paired && /^\d{6}$/.test(code)) pairWithCode(code);
  });

  /** Puts the cursor in a field as soon as it appears, so the teacher can just type. */
  function focusOnShow(input: HTMLInputElement) {
    input.focus();
  }

  function submitCode(event: SubmitEvent) {
    event.preventDefault();
    if (/^\d{6}$/.test(code)) pairWithCode(code);
  }

  function tap(student: { id: string; name: string }) {
    if (openPassFor(student.id)) {
      signBackIn(student.id);
      return;
    }
    const spot = lineSpotFor(student.id);
    if (!spot) choosingFor = student;
    // Their turn: go straight to where they lined up for.
    else if (isUpNext(student.id)) requestPass(student.id, spot.destination);
    else waitingFor = student;
  }

  function ordinal(position: number) {
    return position === 1 ? '1st' : position === 2 ? '2nd' : position === 3 ? '3rd' : `${position}th`;
  }

  function choose(destination: string) {
    if (!choosingFor) return;
    requestPass(choosingFor.id, destination);
    choosingFor = null;
  }

  function openTeacher() {
    lettingGo = null;
    teacher = 'pin';
    pin = '';
    pinError = '';
    confirmForget = false;
  }

  function submitPin(event: SubmitEvent) {
    event.preventDefault();
    if (checkPin(pin) && lettingGo) {
      requestPass(lettingGo.studentId, lettingGo.destination, true);
      lettingGo = null;
      teacher = 'closed';
    } else if (checkPin(pin)) {
      teacher = 'menu';
    } else {
      pinError = "That PIN isn't right.";
      pin = '';
    }
  }

  /** "Teacher: let them go", wherever a rule has stopped a student. */
  function askToLetGo(offer: { studentId: string; destination: string }) {
    dismissNotice();
    openTeacher();
    lettingGo = offer;
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

<svelte:head><title>Happy Hallways kiosk</title></svelte:head>

<!-- Closing the kiosk stops students signing out, and may strand passes not yet sent. -->
<svelte:window onbeforeunload={(event) => askBeforeLeaving(event, local || paired)} />

<div class="door">
  {#if !local && !paired}
    <!-- Not a kiosk yet: pair with the teacher's laptop. -->
    <main class="pairing">
      <span class="mark"><BrandMark size={52} /></span>
      <h1>Make this device the kiosk</h1>
      {#if door.status === 'replaced'}
        <p class="lede">This device is no longer the kiosk. A different one was paired on the teacher's laptop.</p>
      {/if}
      <p class="lede">
        On the teacher's laptop, open Happy Hallways and go to <strong>Kiosk → Pair a device</strong>. Then type the 6-digit
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
      {#if door.pairing.state === 'connecting' && door.pairing.slow}
        <p class="lede small" role="status">Still trying… Check that the code matches the one on the teacher's screen.</p>
      {/if}
      <a class="quiet-link" href="/">This is the teacher's computer</a>
    </main>
  {:else}
    <header class="door-head">
      <div>
        <p class="door-eyebrow">{cls?.name ?? 'Happy Hallways'}</p>
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

    {#if cls && blocked}
      <div class="no-pass" role="status">
        <Icon name="clock" size={20} />
        <span><strong>No passes right now.</strong> Passes open at {formatClock(blocked.end)}.</span>
      </div>
    {/if}

    {#if cls}
      {#each lines as each (each.destination)}
        <div class="line-strip" aria-label="The line for {each.destination}">
          <strong class="line-name">
            <DestinationIcon label={each.destination} list={destinations} size={22} />{each.destination} line
          </strong>
          {#each each.spots as spot, index (spot.studentId)}
            <span class="line-spot" class:next={isUpNext(spot.studentId)}>
              <span class="line-number">{index + 1}</span>{spot.studentName}
              {#if isUpNext(spot.studentId)}· your turn!{/if}
            </span>
          {/each}
        </div>
      {/each}
    {/if}

    {#if cls}
      {#if !destinations.length}
        <p class="door-error">Your teacher hasn't set up any destinations yet.</p>
      {/if}
      <main class="names" aria-label="Students in {cls.name}">
        {#each cls.students as student (student.id)}
          {@const pass = openPassFor(student.id)}
          {@const spot = pass ? null : lineSpotFor(student.id)}
          {@const isNext = isUpNext(student.id)}
          <!-- Where they went, never how long: the door carries no clock. See docs/adr/0003. -->
          <button class="name" class:out={pass} class:waiting={spot && !isNext} class:up-next={isNext} onclick={() => tap(student)}>
            <span class="name-text">{student.name}</span>
            {#if pass}
              <span class="name-status out-status">
                <DestinationIcon label={pass.destination} list={destinations} size={22} />Out · {pass.destination}
              </span>
            {:else if isNext && spot}
              <span class="name-status next-status">
                <DestinationIcon label={spot.destination} list={destinations} size={22} />Your turn: tap!
              </span>
            {:else if spot}
              <span class="name-status waiting-status">
                <DestinationIcon label={spot.destination} list={destinations} size={22} />{ordinal(spot.position)} in line
              </span>
            {:else}
              <span class="name-status">In class</span>
            {/if}
          </button>
        {:else}
          <p class="lede">There are no students on this class's roster yet.</p>
        {/each}
      </main>
      <p class="count">
        {outCount(cls.id)} out{waiting.length ? ` · ${waiting.length} in line` : ''}
      </p>
    {:else}
      <main class="pairing">
        <p class="lede">No class is on the kiosk yet. Teacher: choose one from your laptop, or tap Teacher below.</p>
      </main>
    {/if}

    <button class="teacher-btn" onclick={openTeacher}><Icon name="lock" size={15} />Teacher</button>
  {/if}

  {#if choosingFor && cls}
    <Modal overlay="overlay" labelledby="choose-title" onClose={() => (choosingFor = null)}>
      <div class="sheet">
        <p class="door-eyebrow">Pass for</p>
        <h2 id="choose-title">{choosingFor.name}</h2>
        <p class="lede">Where are you going?</p>
        {#if allowanceFor(choosingFor.id)}
          {@const allowance = allowanceFor(choosingFor.id)!}
          <p class="allowance" class:used-up={allowance.usedUp && !allowance.gift}>
            {allowance.usedUp && allowance.gift ? 'Your teacher gave you an extra pass.' : allowance.text}
          </p>
        {/if}
        <div class="choices">
          {#each destinations as destination (destination.id)}
            {@const lineLength = line(destination.label).length}
            <button class="door-btn choice" onclick={() => choose(destination.label)}>
              <DestinationIcon label={destination.label} list={destinations} size={40} />
              <span class="choice-text">
                {destination.label}
                {#if isFull(destination.label)}
                  <span class="choice-status">Full{lineLength ? ` · ${lineLength} waiting` : ''}</span>
                {:else if lineLength}
                  <span class="choice-status">{lineLength} waiting</span>
                {/if}
              </span>
            </button>
          {/each}
        </div>
        <button class="quiet-link" onclick={() => (choosingFor = null)}>Cancel</button>
      </div>
    </Modal>
  {/if}

  {#if waitingFor}
    {@const spot = lineSpotFor(waitingFor.id)}
    <Modal overlay="overlay" labelledby="waiting-title" onClose={() => (waitingFor = null)}>
      <div class="sheet">
        <p class="door-eyebrow">In line</p>
        <h2 id="waiting-title">{waitingFor.name}</h2>
        {#if spot}
          <p class="lede">
            You're {ordinal(spot.position)} in line for {spot.destination}. When your name turns green, tap it to go.
          </p>
        {/if}
        <div class="choices">
          <button class="door-btn primary" onclick={() => (waitingFor = null)}>Stay in line</button>
          <button
            class="door-btn"
            onclick={() => {
              choosingFor = waitingFor;
              waitingFor = null;
            }}>Go somewhere else</button
          >
          <button
            class="door-btn"
            onclick={() => {
              if (waitingFor) leaveLine(waitingFor.id);
              waitingFor = null;
            }}>Leave the line</button
          >
        </div>
        {#if spot}
          <button
            class="quiet-link"
            onclick={() => {
              waitingFor = null;
              askToLetGo({ studentId: spot.studentId, destination: spot.destination });
            }}><Icon name="lock" size={14} /> Teacher: let them go now</button
          >
        {/if}
      </div>
    </Modal>
  {/if}

  {#if door.notice}
    <div class="notice {door.notice.kind}" role="status">
      <span class="notice-symbol"><Icon name={door.notice.kind === 'denied' ? 'x' : 'check'} size={46} stroke={2.5} /></span>
      <p class="door-eyebrow">
        {door.notice.eyebrow ??
          (door.notice.kind === 'denied' ? 'Not right now' : door.notice.kind === 'returned' ? 'Welcome back' : 'Pass approved')}
      </p>
      <h2>{door.notice.title}</h2>
      <p class="notice-message">{door.notice.message}</p>
      <div class="notice-actions">
        {#if door.notice.undoPassId}
          <button class="door-btn" onclick={() => undoPass(door.notice!.undoPassId!)}>That's not me</button>
        {/if}
        {#if door.notice.offerLine}
          {@const offer = door.notice.offerLine}
          <button class="door-btn primary" onclick={() => joinLine(offer.studentId, offer.destination)}>Join the line</button>
          <button class="door-btn" onclick={dismissNotice}>Not now</button>
        {:else}
          <button class="door-btn" class:primary={door.notice.offerTeacher} onclick={dismissNotice}>Done</button>
        {/if}
        {#if door.notice.offerTeacher}
          {@const offer = door.notice.offerTeacher}
          <button class="door-btn" onclick={() => askToLetGo(offer)}><Icon name="lock" size={16} />Teacher: let them go</button>
        {/if}
      </div>
    </div>
  {/if}

  {#if teacher !== 'closed'}
    <Modal overlay="overlay" label="Teacher menu" onClose={() => (teacher = 'closed')}>
      <div class="sheet">
        {#if teacher === 'pin'}
          <h2>Teacher PIN</h2>
          {#if lettingGo}<p class="lede small">Enter your PIN to let this student go now. Their pass will show you let them go.</p>{/if}
          <form onsubmit={submitPin}>
            <input class="code-input" type="password" inputmode="numeric" autocomplete="off" aria-label="PIN" bind:value={pin} {@attach focusOnShow} />
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
          <p class="lede small">Students still out in the current class will have their passes ended, and the line will be cleared.</p>
          {#if waiting.length}
            <button
              class="door-btn"
              onclick={() => {
                clearLine();
                teacher = 'closed';
              }}>Clear the line ({waiting.length})</button
            >
          {/if}
          {#if local}
            <button class="door-btn" onclick={exitToTeacher}><Icon name="unlock" size={16} />Exit kiosk</button>
          {:else}
            <button class="door-btn" onclick={() => (confirmForget = true)}>Unpair this device</button>
          {/if}
        {/if}
        <button class="quiet-link" onclick={() => (teacher = 'closed')}>Cancel</button>
      </div>
    </Modal>
  {/if}
</div>

<style>
  /* The door screen is read from across the room: large type, plain light surfaces, strong contrast. */
  .door {
    --door-bg: var(--bg);
    --door-tile: #fff;
    --door-line: var(--border);
    --door-text: var(--text);
    --door-muted: var(--muted);
    --door-accent: var(--accent);
    --door-out: #a8620f;
    min-height: 100vh;
    padding: 28px clamp(16px, 4vw, 48px) 90px;
    background: var(--door-bg);
    color: var(--door-text);
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

  .allowance {
    margin-top: 6px;
    font-size: 17px;
    font-weight: 700;
    color: var(--door-accent);
  }

  .allowance.used-up {
    color: var(--door-out);
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
    border-color: #e6c48f;
    background: #fdf6ea;
  }

  .out-status {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--door-out);
  }

  .name.waiting {
    border-color: #b9d0ec;
    background: #f1f6fd;
  }

  .name.up-next {
    border-color: var(--accent);
    border-width: 2px;
    background: #e9f4ec;
  }

  .waiting-status,
  .next-status {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .waiting-status {
    color: #2361a6;
  }

  .next-status {
    color: var(--accent);
  }

  .no-pass {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
    padding: 12px 16px;
    border: 1px solid #ecd3ac;
    border-radius: 12px;
    background: var(--warn-wash);
    color: var(--warn);
    font-size: 17px;
  }

  .line-strip {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-bottom: 18px;
    padding: 10px 14px;
    border: 1px solid #b9d0ec;
    border-radius: 12px;
    background: #f1f6fd;
    font-size: 16px;
  }

  .line-name {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .line-strip + .line-strip {
    margin-top: -8px;
  }

  .line-spot {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px 4px 4px;
    border-radius: 999px;
    background: #fff;
    font-weight: 700;
  }

  .line-spot.next {
    background: var(--accent);
    color: #fff;
  }

  .line-number {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #e1ecf8;
    color: #2361a6;
    font-size: 12px;
    font-weight: 800;
  }

  .line-spot.next .line-number {
    background: #fff;
    color: var(--accent);
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
    color: #fff;
  }

  .door-btn.danger {
    background: var(--danger);
    border-color: var(--danger);
    color: #fff;
  }

  .door-btn:disabled {
    opacity: 0.5;
  }

  .door-btn.current {
    border-color: var(--door-accent);
  }

  .door-error {
    color: var(--danger);
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

  :global(.overlay) {
    position: fixed;
    inset: 0;
    z-index: 10;
    display: grid;
    place-items: center;
    padding: 16px;
    background: rgb(42 34 22 / 40%);
    backdrop-filter: blur(3px);
  }

  .sheet {
    display: grid;
    gap: 16px;
    width: min(560px, 100%);
    padding: 28px;
    border: 1px solid var(--door-line);
    border-radius: 16px;
    background: #fff;
    box-shadow: 0 16px 48px rgb(42 34 22 / 18%);
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
    justify-content: flex-start;
    gap: 14px;
    min-height: 72px;
    font-size: 20px;
  }

  .choice-text {
    display: grid;
    text-align: left;
  }

  .choice-status {
    color: var(--door-out);
    font-size: 14px;
  }

  .notice-actions {
    flex-wrap: wrap;
    justify-content: center;
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
    background: #e3f0e7;
    --notice-strong: var(--accent);
  }

  .notice.denied {
    background: #fbefdc;
    --notice-strong: #a8620f;
  }

  .notice.returned {
    background: #e1ecf8;
    --notice-strong: #2361a6;
  }

  .notice .door-eyebrow {
    color: var(--notice-strong);
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
    background: var(--notice-strong);
    color: #fff;
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
</style>
