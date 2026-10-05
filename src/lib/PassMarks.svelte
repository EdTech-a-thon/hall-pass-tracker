<script lang="ts">
  import type { Pass } from './types';

  /** The rules the teacher let a pass past, each marked on its own. */
  let { pass }: { pass: Pass } = $props();
</script>

{#if pass.extra}<span class="badge" title="Taken after their Pass Allowance was used up">Extra</span>{/if}
{#if pass.noPassException}<span class="badge" title="You let them go during No-Pass Time">No-pass time</span>{/if}
{#if pass.lineSkip}<span class="badge" title="You let them go while the destination was full">Skipped line</span>{/if}
