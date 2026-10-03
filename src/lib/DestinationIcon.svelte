<script lang="ts">
  import { account } from './account.svelte';
  import { lookFor } from './destinations';
  import Icon from './Icon.svelte';
  import type { Destination } from './types';

  /** A destination's icon on its color, looked up by name. Pass `list` on the kiosk, which has its own copy. */
  let { label, size = 28, list }: { label: string; size?: number; list?: Destination[] } = $props();

  const look = $derived(lookFor(list ?? account.destinations, label));
</script>

<span
  class="destination-icon"
  style:width="{size}px"
  style:height="{size}px"
  style:background={look.soft}
  style:color={look.strong}
  aria-hidden="true"
>
  <Icon name={look.icon} size={Math.round(size * 0.58)} />
</span>
