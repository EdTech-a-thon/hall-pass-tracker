<script lang="ts">
  import { goto } from '$app/navigation';
  import { account } from '#lib/account.svelte.ts';
  import { isPairedDevice } from '#lib/door.svelte.ts';
  import { refreshLink } from '#lib/link.svelte.ts';
  import Sidebar from '#lib/Sidebar.svelte';
  import SiteFooter from '#lib/SiteFooter.svelte';

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

{#if !belongsAtDoor}
  <div class="shell">
    <Sidebar />
    <main class="main">
      {@render children()}
      <SiteFooter />
    </main>
  </div>
{/if}
