<script lang="ts">
  import { goto } from '$app/navigation';
  import { updated } from '$app/state';
  import { account } from '#lib/account.svelte.ts';
  import { isPairedDevice } from '#lib/door.svelte.ts';
  import GettingStarted from '#lib/GettingStarted.svelte';
  import Icon from '#lib/Icon.svelte';
  import { askBeforeLeaving, leaveTo } from '#lib/leaving.ts';
  import { refreshLink } from '#lib/link.svelte.ts';
  import { onboarding } from '#lib/onboarding.svelte.ts';
  import OverdueReminder from '#lib/OverdueReminder.svelte';
  import Sidebar from '#lib/Sidebar.svelte';
  import SiteFooter from '#lib/SiteFooter.svelte';
  import WhatsChanged from '#lib/WhatsChanged.svelte';

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
</script>

<!-- A paired kiosk sends its passes to this page, so closing it asks first. -->
<svelte:window onbeforeunload={(event) => askBeforeLeaving(event, !belongsAtDoor && account.kiosk?.kind === 'device')} />
<svelte:document onvisibilitychange={refreshWhenHidden} />

{#if !belongsAtDoor}
  <div class="shell">
    <Sidebar />
    <main class="main">
      {#if updated.current}
        <div class="notice-bar" role="status">
          <Icon name="sparkles" />
          <span>Happy Hallways has been updated. Refresh to get the newest version.</span>
          <button class="btn btn-small" onclick={() => leaveTo(location.href)}>Refresh</button>
        </div>
      {/if}
      <OverdueReminder />
      {@render children()}
      <SiteFooter />
    </main>
  </div>
  {#if onboarding.showChecklist}<GettingStarted />{/if}
  <WhatsChanged />
{/if}
