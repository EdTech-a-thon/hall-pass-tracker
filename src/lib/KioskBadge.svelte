<script lang="ts">
  import { account } from './account.svelte';
  import Icon from './Icon.svelte';
  import { link } from './link.svelte';

  /** Compact shows only the icon and the dot, for the sidebar. */
  let { compact = false }: { compact?: boolean } = $props();

  const live = $derived(account.kiosk?.kind === 'this-computer' || link.status === 'live');
  const label = $derived(live ? 'On the kiosk, live' : 'On the kiosk, offline');
</script>

<span class="kiosk-badge" class:compact class:live title={label} aria-label={label}>
  <Icon name="tablet" size={13} />
  {#if !compact}On the kiosk{/if}
  <span class="status-dot" class:live aria-hidden="true"></span>
</span>
