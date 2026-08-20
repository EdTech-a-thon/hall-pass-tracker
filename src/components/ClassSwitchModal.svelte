<script lang="ts">
  import { app, stillOutIn, switchActiveClass } from '../lib/store.svelte';

  let pending = $state('');
  let busy = $state(false);
  /**
   * The only step in this design that destroys information: we will never know
   * when these students actually came back. So they are named, not counted.
   */
  let stranded = $state([] as string[]);
  // Nothing is clickable until we know who is out. Otherwise a fast click races
  // the lookup and skips the one warning that matters.
  let loaded = $state(false);

  $effect(() => {
    void stillOutIn(app.activeClassId).then((names) => {
      stranded = names;
      loaded = true;
    });
  });

  async function choose(id: string) {
    if (busy || !loaded) return;
    if (id !== app.activeClassId && stranded.length && pending !== id) {
      pending = id;
      return;
    }
    busy = true;
    await switchActiveClass(id);
    busy = false;
    app.modal = null;
  }
</script>

<div class="modal-backdrop">
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="switch-title">
    <button class="modal-close" onclick={() => (app.modal = null)} aria-label="Close">×</button>
    <p class="eyebrow">DOOR SCREEN</p>
    <h2 id="switch-title">Which class is in the room?</h2>

    {#if pending}
      <p class="form-error" role="alert">
        Ending {app.classes.find((room) => room.id === app.activeClassId)?.name} will close
        {stranded.length === 1 ? 'this open trip' : 'these open trips'}, and their return
        {stranded.length === 1 ? 'time' : 'times'} will not be recorded: {stranded.join(', ')}.
      </p>
      <button class="button primary full" onclick={() => choose(pending)} disabled={busy}>
        Change class anyway
      </button>
      <button class="button outline full" onclick={() => (pending = '')}>Keep this class</button>
    {:else}
      <div class="class-list">
        {#each app.classes as room (room.id)}
          <article>
            <div class="class-identity">
              <h3>{room.name}</h3>
              {#if room.id === app.activeClassId}<span class="current">Showing now</span>{/if}
            </div>
            {#if room.id !== app.activeClassId}
              <button class="button small" onclick={() => choose(room.id)} disabled={busy || !loaded}>Show {room.name}</button>
            {/if}
          </article>
        {/each}
      </div>
    {/if}
  </div>
</div>
