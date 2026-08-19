<script lang="ts">
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
  <div class="notice-countdown">Returning to kiosk…</div>
</div>
