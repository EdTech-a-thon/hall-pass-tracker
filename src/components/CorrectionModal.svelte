<script lang="ts">
  import { app, correctPass } from '../lib/store.svelte';
  import type { Pass } from '../lib/types';

  let { pass }: { pass: Pass } = $props();

  /** PocketBase stores "2026-08-19 10:03:12.123Z"; the input wants "2026-08-19T10:03". */
  function forInput(value?: string) {
    if (!value) return '';
    const date = new Date(value.replace(' ', 'T'));
    const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return shifted.toISOString().slice(0, 16);
  }

  function forServer(value: string) {
    return value ? new Date(value).toISOString().replace('T', ' ') : '';
  }

  // Read once on open: the dialog is mounted fresh for each trip, so these are
  // deliberately starting values rather than a live view of the pass.
  // svelte-ignore state_referenced_locally
  const startedOut = forInput(pass.outAt);
  // svelte-ignore state_referenced_locally
  const startedIn = forInput(pass.inAt);

  let student = $state('');
  let outAt = $state(startedOut);
  let inAt = $state(startedIn);
  let busy = $state(false);
  let error = $state('');

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    // A departure moved past its return would leave a trip nothing can close:
    // the fold sorts by time, so the return would arrive first and be dropped,
    // and the student would read as out forever.
    if (pass.inAt && inAt && outAt && new Date(outAt) >= new Date(inAt)) {
      error = 'A student cannot come back before they left. Check the two times.';
      return;
    }
    error = '';
    busy = true;
    try {
      await correctPass(pass, {
        student: student || undefined,
        outAt: outAt !== startedOut ? forServer(outAt) : undefined,
        inAt: pass.inAt && inAt !== startedIn ? forServer(inAt) : undefined,
      });
      app.modal = null;
    } catch {
      error = 'That correction could not be saved.';
    }
    busy = false;
  }
</script>

<div class="modal-backdrop">
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="correct-title">
    <button class="modal-close" onclick={() => (app.modal = null)} aria-label="Close">×</button>
    <p class="eyebrow">CORRECT A TRIP</p>
    <h2 id="correct-title">{pass.studentName} · {pass.destination}</h2>
    <p class="muted">
      Nothing is erased. A correction is added on top, so the original entry and every
      change to it stay on the record.
    </p>
    <form onsubmit={submit}>
      <label>
        This trip really belonged to
        <select bind:value={student}>
          <option value="">Leave as {pass.studentName}</option>
          {#each app.activeClass.students as option (option.recordId)}
            <option value={option.recordId}>{option.name}</option>
          {/each}
        </select>
      </label>
      <label>
        Left at
        <input type="datetime-local" bind:value={outAt} />
      </label>
      {#if pass.inAt}
        <label>
          Came back at
          <input type="datetime-local" bind:value={inAt} />
        </label>
      {/if}
      {#if error}<p class="form-error" role="alert">{error}</p>{/if}
      <button class="button primary full" type="submit" disabled={busy}>Save correction</button>
    </form>
  </div>
</div>
