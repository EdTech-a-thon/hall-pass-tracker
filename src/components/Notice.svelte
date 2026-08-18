<script lang="ts">
  import { out } from '../lib/store.svelte';
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
  {#if notice.kind === 'denied'}
    <div class="notice-out">
      <strong>Currently out</strong>
      {#each out() as pass (pass.id)}
        <span>{pass.studentName}</span>
      {/each}
    </div>
  {/if}
  <div class="notice-countdown">Returning to kiosk…</div>
</div>
