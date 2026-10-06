<script lang="ts">
  import type { Pass } from './types';

  /** The rules a pass went past, each marked on its own, and how the teacher approved it. */
  let { pass }: { pass: Pass } = $props();
</script>

{#if pass.extra}<span class="badge" title="Taken after their Pass Allowance was used up">Extra</span>{/if}
{#if pass.noPassException}<span class="badge" title="You let them go during No-Pass Time">No-pass time</span>{/if}
{#if pass.lineSkip}<span class="badge" title="You let them go while the destination was full">Skipped line</span>{/if}
{#if pass.approvedBy}<span class="badge ok" title="You approved their request {pass.approvedBy === 'home' ? 'on Home' : 'with your PIN at the kiosk'}">Approved{pass.approvedBy === 'pin' ? ' by PIN' : ''}</span>{/if}
