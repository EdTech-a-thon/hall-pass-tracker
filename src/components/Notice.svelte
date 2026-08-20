<script lang="ts">
  import { cancelLastPass } from '../lib/store.svelte';
  import type { Notice } from '../lib/types';

  let { notice }: { notice: Notice } = $props();

  const heading = $derived(
    notice.kind === 'denied' ? 'PASS PAUSED' : notice.kind === 'returned' ? 'WELCOME BACK' : 'PASS APPROVED',
  );
</script>

<div class="notice {notice.kind}" role="status">
  <div class="notice-symbol">{notice.kind === 'denied' ? '×' : '✓'}</div>
  <p>{heading}</p>
  <h2>{notice.title}</h2>
  <div class="notice-message">
    {#if notice.detail}
      <strong>{notice.message}</strong><span>{notice.detail}</span>
    {:else}
      {notice.message}
    {/if}
  </div>
  {#if notice.undo}
    <!-- The log cannot be rewritten, so this adds a line saying the trip was
         cancelled. Without it the wrong student holds a pass they cannot sign
         back in from. See docs/adr/0004. -->
    <button class="button outline notice-undo" onclick={() => cancelLastPass()}>That's not me</button>
  {/if}
  <div class="notice-countdown">Returning to kiosk…</div>
</div>
