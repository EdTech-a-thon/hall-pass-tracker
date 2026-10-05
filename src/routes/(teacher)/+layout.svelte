<script lang="ts">
  import { goto } from '$app/navigation';
  import { account } from '#lib/account.svelte.ts';
  import { isPairedDevice } from '#lib/door.svelte.ts';
  import GettingStarted from '#lib/GettingStarted.svelte';
  import { askBeforeLeaving } from '#lib/leaving.ts';
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
</script>

<!-- A paired kiosk sends its passes to this page, so closing it asks first. -->
<svelte:window onbeforeunload={(event) => askBeforeLeaving(event, !belongsAtDoor && account.kiosk?.kind === 'device')} />

{#if !belongsAtDoor}
  <div class="shell">
    <Sidebar />
    <main class="main">
      <OverdueReminder />
      {@render children()}
      <SiteFooter />
    </main>
  </div>
  {#if onboarding.showChecklist}<GettingStarted />{/if}
  <WhatsChanged />
{/if}
