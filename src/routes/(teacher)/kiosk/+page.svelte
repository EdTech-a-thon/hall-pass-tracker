<script lang="ts">
  import { goto } from '$app/navigation';
  import {
    account,
    currentSchedule,
    findClass,
    moveWarning,
    removeKiosk,
    setActiveClass,
    setDoorLocked,
    setNetworkBlocked,
    setPin,
    useThisComputer,
  } from '#lib/account.svelte.ts';
  import ConfirmDialog from '#lib/ConfirmDialog.svelte';
  import Icon from '#lib/Icon.svelte';
  import { cancelPairing, link, refreshLink } from '#lib/link.svelte.ts';
  import PairingDialog from '#lib/PairingDialog.svelte';
  import { now, time } from '#lib/passes.ts';

  let newPin = $state('');
  let pinError = $state('');
  let changingPin = $state(false);
  let pendingClass = $state('');
  let confirmRemove = $state(false);

  let pairing = $state(false);

  const kiosk = $derived(account.kiosk);

  function savePin(event: SubmitEvent) {
    event.preventDefault();
    if (!/^\d{4,8}$/.test(newPin)) {
      pinError = 'Use 4 to 8 digits.';
      return;
    }
    setPin(newPin);
    newPin = '';
    pinError = '';
    changingPin = false;
  }

  function chooseClass(id: string) {
    if (id === account.activeClass?.id) return;
    if (moveWarning(id)) {
      pendingClass = id;
      return;
    }
    setActiveClass({ id, changedAt: now() });
  }

  function confirmClass() {
    setActiveClass({ id: pendingClass, changedAt: now() });
    pendingClass = '';
  }

  function pair() {
    pairing = true;
  }

  function thisComputer() {
    pairing = false;
    cancelPairing();
    useThisComputer();
    refreshLink();
  }

  function openDoor() {
    setDoorLocked(true);
    goto('/door');
  }

  function remove() {
    cancelPairing();
    removeKiosk();
    refreshLink();
    confirmRemove = false;
  }
</script>

<div class="page">
  <header class="page-head">
    <div>
      <p class="eyebrow">Kiosk</p>
      <h1>The screen by your door</h1>
      <p class="muted">
        Students tap their name to sign out and back in. Use a spare tablet or Chromebook, or this computer. You can
        have one kiosk at a time.
      </p>
    </div>
  </header>

  {#if kiosk}
    <div class="notice-bar" role="note">
      <Icon name="alert-triangle" />
      {#if kiosk.kind === 'device'}
        Keep Happy Hallways open on this laptop and on the kiosk all day. Passes reach you only while both are open;
        until then they wait on the kiosk.
      {:else}
        Keep the kiosk screen open all day. While it's closed, students can't sign out.
      {/if}
    </div>
  {/if}

  {#if link.status === 'taken'}
    <div class="notice-bar" role="alert">
      <Icon name="alert-triangle" />
      Happy Hallways is open in another tab, so the kiosk connects there. Changes you make here still reach it while that tab
      stays open. If this account was imported on another computer, the kiosk can only connect to one of them.
    </div>
  {/if}

  {#if !account.pin || changingPin}
    <form class="card" onsubmit={savePin}>
      <div>
        <p class="eyebrow">{account.pin ? 'Change PIN' : 'Step 1'}</p>
        <h2>{account.pin ? 'Choose a new teacher PIN' : 'Choose a teacher PIN'}</h2>
        <p class="muted small">
          You'll need it at the kiosk to switch class or to stop using the device as a kiosk. Students shouldn't know
          it.
        </p>
      </div>
      <label class="field" style="max-width:220px">
        PIN (4 to 8 digits)
        <input type="password" inputmode="numeric" autocomplete="off" bind:value={newPin} />
      </label>
      {#if pinError}<p class="form-error" role="alert">{pinError}</p>{/if}
      <div class="row">
        <button class="btn btn-primary">Save PIN</button>
        {#if changingPin}<button type="button" class="btn btn-quiet" onclick={() => (changingPin = false)}>Cancel</button>{/if}
      </div>
    </form>
  {:else}
    {#if kiosk}
      <section class="card">
        <div class="card-head">
          <div>
            <p class="eyebrow">Current kiosk</p>
            {#if kiosk.kind === 'this-computer'}
              <h2>This computer</h2>
              <p class="muted small">Open the kiosk screen when class starts. Leaving it needs your PIN.</p>
            {:else if link.status === 'live'}
              <h2 class="row"><span class="status-dot live"></span>Paired device · Live</h2>
              <p class="muted small">Passes arrive here as students sign out.</p>
            {:else}
              <h2 class="row"><span class="status-dot"></span>Paired device · Offline</h2>
              <p class="muted small">
                {kiosk.lastSeenAt ? `Last connected at ${time(kiosk.lastSeenAt)}. ` : ''}It keeps working on its
                own and sends its passes when it reconnects.
              </p>
            {/if}
          </div>
          {#if kiosk.kind === 'this-computer'}
            <button class="btn btn-primary" onclick={openDoor} disabled={!account.activeClass}>
              <Icon name="lock" size={16} />Open kiosk screen
            </button>
          {/if}
        </div>

        <label class="field" style="max-width:320px">
          Class on the kiosk
          <select value={account.activeClass?.id ?? ''} onchange={(event) => chooseClass(event.currentTarget.value)}>
            {#if !account.activeClass}<option value="" disabled>Choose a class</option>{/if}
            {#if account.activeClass && !account.activeClass.id}<option value="" disabled>No class right now</option>{/if}
            {#each account.classes as cls (cls.id)}<option value={cls.id}>{cls.name}</option>{/each}
          </select>
        </label>
        {#if !account.classes.length}
          <p class="muted small">Create a class first, and it will show here.</p>
        {:else if account.activeClass?.onSchedule}
          <p class="muted small">
            Following <a href="/schedule">{currentSchedule().name}</a>: the kiosk changes class by itself as each period starts.
          </p>
        {:else}
          <p class="muted small">Want it to change class by itself? Set up your <a href="/schedule">schedule</a>.</p>
        {/if}

        <div class="row">
          {#if kiosk.kind === 'device'}
            <button class="btn" onclick={pair}>
              <Icon name="tablet" size={16} />Pair a different device
            </button>
            <button class="btn" onclick={thisComputer}><Icon name="monitor" size={16} />Use this computer instead</button>
          {:else}
            <button class="btn" onclick={pair}>
              <Icon name="tablet" size={16} />Pair a device instead
            </button>
          {/if}
          <button class="btn btn-quiet" onclick={() => (confirmRemove = true)}>Stop using a kiosk</button>
        </div>
      </section>
    {:else}
      <div class="choice-cards">
        <section class="choice-card" class:disabled={account.networkBlocked}>
          <span class="icon-tile"><Icon name="tablet" /></span>
          <h2>Pair a device</h2>
          <p class="muted small">
            A tablet or Chromebook by the door. It talks straight to this laptop and keeps working while the laptop
            is closed.
          </p>
          <div><button class="btn btn-primary" onclick={pair}>Pair a device</button></div>
        </section>
        <section class="choice-card">
          <span class="icon-tile"><Icon name="monitor" /></span>
          <h2>Use this computer</h2>
          <p class="muted small">No second device needed. This screen locks into kiosk mode until you enter your PIN.</p>
          <p class="muted small">
            You won't get overdue reminders while this screen is the kiosk. You can still see overdue passes in each
            class's history.
          </p>
          <div><button class="btn" onclick={thisComputer}>Use this computer</button></div>
        </section>
      </div>
    {/if}

    {#if account.networkBlocked}
      <div class="notice-bar" role="status">
        <Icon name="alert-triangle" />
        <div class="stack" style="gap:6px">
          <span>
            The last pairing attempt showed that this network won't let two devices connect directly, so only this
            computer can be the kiosk here.
          </span>
          <div><button class="btn btn-small" onclick={() => setNetworkBlocked(false)}>Try pairing again</button></div>
        </div>
      </div>
    {/if}

    <section class="card">
      <div class="card-head">
        <div>
          <p class="eyebrow">Teacher PIN</p>
          <h2>Set</h2>
          <p class="muted small">Needed at the kiosk to switch class or to stop being a kiosk.</p>
        </div>
        <button class="btn" onclick={() => (changingPin = true)}>Change PIN</button>
      </div>
    </section>
  {/if}
</div>

{#if pairing}
  <PairingDialog onClose={() => (pairing = false)} onUseThisComputer={thisComputer} />
{/if}

{#if pendingClass}
  <ConfirmDialog
    title="Switch the kiosk to {findClass(pendingClass)?.name}?"
    message={moveWarning(pendingClass) ?? ''}
    confirmLabel="Switch class"
    onConfirm={confirmClass}
    onCancel={() => (pendingClass = '')}
  />
{/if}

{#if confirmRemove}
  <ConfirmDialog
    title="Stop using a kiosk?"
    message={kiosk?.kind === 'device'
      ? "The paired device will be disconnected. If it's holding passes this laptop hasn't received yet, they'll still arrive the next time it connects."
      : 'This computer will no longer be the kiosk.'}
    confirmLabel="Stop using it"
    onConfirm={remove}
    onCancel={() => (confirmRemove = false)}
  />
{/if}
