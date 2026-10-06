<script lang="ts">
  import { afterNavigate, goto } from '$app/navigation';
  import { page, updated } from '$app/state';
  import { account, keepToSchedule, waitingRequests } from '#lib/account.svelte.ts';
  import { isPairedDevice } from '#lib/door.svelte.ts';
  import GettingStarted from '#lib/GettingStarted.svelte';
  import { askBeforeLeaving, leaveTo } from '#lib/leaving.ts';
  import { refreshLink } from '#lib/link.svelte.ts';
  import { onboarding } from '#lib/onboarding.svelte.ts';
  import OverdueReminder from '#lib/OverdueReminder.svelte';
  import Sidebar from '#lib/Sidebar.svelte';
  import SiteFooter from '#lib/SiteFooter.svelte';
  import Toast from '#lib/Toast.svelte';
  import Popups from '#lib/Popups.svelte';

  let { children } = $props();

  /**
   * The teacher's pages are for the teacher's laptop. A paired kiosk device, or
   * this computer while it is locked as the kiosk, goes back to the door screen.
   */
  const belongsAtDoor = $derived(
    isPairedDevice() || (account.kiosk?.kind === 'this-computer' && account.kiosk.locked),
  );

  $effect(() => {
    if (belongsAtDoor) goto('/door', { replace: true });
  });

  $effect(() => {
    if (!belongsAtDoor) refreshLink();
  });

  /**
   * On Schedule, the class on the kiosk changes as each period starts. A
   * paired kiosk does that itself and tells this laptop; otherwise the laptop
   * keeps to the schedule here.
   */
  $effect(() => {
    if (belongsAtDoor || account.kiosk?.kind === 'device') return;
    keepToSchedule();
    const timer = setInterval(keepToSchedule, 15_000);
    return () => clearInterval(timer);
  });

  /**
   * After an update, the teacher's page refreshes itself while it's in the
   * background, so it never stays on an older version than the kiosk. While
   * the teacher is looking at it, a bar offers the refresh instead, so nothing
   * they are typing is lost.
   */
  function refreshWhenHidden() {
    if (updated.current && document.visibilityState === 'hidden') leaveTo(location.href);
  }

  $effect(() => {
    if (updated.current) refreshWhenHidden();
  });

  // Waiting Requests show at the front of the tab's title, so a teacher in another tab sees them.
  const titlePrefix = /\(\d+\) Requests? · /;
  let navigated = $state(0);
  afterNavigate(() => navigated++);
  $effect(() => {
    void navigated;
    const count = belongsAtDoor ? 0 : waitingRequests().length;
    const base = document.title.replace(titlePrefix, '');
    document.title = count ? `(${count}) ${count === 1 ? 'Request' : 'Requests'} · ${base}` : base;
  });
</script>

<!-- A paired kiosk sends its passes to this page, so closing it asks first. -->
<svelte:window onbeforeunload={(event) => askBeforeLeaving(event, !belongsAtDoor && account.kiosk?.kind === 'device')} />
<svelte:document onvisibilitychange={refreshWhenHidden} />

{#if !belongsAtDoor}
  <div class="shell">
    <Sidebar />
    <main class="main">
      {@render children()}
      <!-- Home places the footer itself, under its middle column, so the page fits the window without scrolling. -->
      {#if page.url.pathname !== '/' || !account.classes.length}<SiteFooter />{/if}
    </main>
  </div>
  <!-- Messages for every page float in this corner, above the checklist, so the page never shifts. -->
  <div class="corner">
    {#if updated.current}
      <Toast icon="sparkles">
        <div class="update">
          <span>Happy Hallways has been updated. Refresh to get the newest version.</span>
          <button class="btn btn-small" onclick={() => leaveTo(location.href)}>Refresh</button>
        </div>
      </Toast>
    {/if}
    <OverdueReminder />
    {#if onboarding.showChecklist}<GettingStarted />{/if}
  </div>
  <Popups />
{/if}

<style>
  .corner {
    position: fixed;
    right: 20px;
    bottom: 20px;
    z-index: 45;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 10px;
    width: min(400px, calc(100vw - 40px));
    pointer-events: none;
  }

  .update {
    display: flex;
    align-items: center;
    gap: 12px;
  }
</style>
