<script lang="ts">
  import { app, archiveClass, createClass, moveClass, renameClass } from '../lib/store.svelte';

  let newName = $state('');
  let renamingId = $state('');
  let renameValue = $state('');
  let busy = $state(false);

  async function add(event: SubmitEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!name || busy) return;
    busy = true;
    await createClass(name);
    busy = false;
    newName = '';
  }

  function startRename(id: string, name: string) {
    renamingId = id;
    renameValue = name;
  }

  async function saveRename(event: SubmitEvent) {
    event.preventDefault();
    const name = renameValue.trim();
    if (!name || busy) return;
    busy = true;
    await renameClass(renamingId, name);
    busy = false;
    renamingId = '';
  }
</script>

<section class="workspace-head">
  <div>
    <p class="eyebrow">YOUR DAY</p>
    <h1>Classes</h1>
    <p>Each class keeps its own roster and its own pass history.</p>
  </div>
</section>

<section class="panel">
  <div class="panel-head">
    <div>
      <p class="eyebrow">ADD A CLASS</p>
      <h2>New class</h2>
    </div>
  </div>
  <form class="class-add" onsubmit={add}>
    <label>
      Name of the new class
      <input bind:value={newName} name="className" maxlength="60" placeholder="Period 3" required />
    </label>
    <button class="button primary" type="submit" disabled={busy}>Add class</button>
  </form>
</section>

<section class="panel">
  <div class="panel-head">
    <div>
      <p class="eyebrow">IN ORDER OF YOUR DAY</p>
      <h2>Your classes</h2>
    </div>
  </div>
  <div class="class-list">
    {#each app.classes as room, index (room.id)}
      <article>
        {#if renamingId === room.id}
          <form class="class-rename" onsubmit={saveRename}>
            <label>
              Class name
              <input bind:value={renameValue} name="renameClass" maxlength="60" required />
            </label>
            <button class="button small" type="submit" disabled={busy}>Save class name</button>
            <button class="button small outline" type="button" onclick={() => (renamingId = '')}>Cancel</button>
          </form>
        {:else}
          <div class="class-identity">
            <h3>{room.name}</h3>
            {#if room.id === app.activeClassId}
              <span class="current">Showing on the door screen</span>
            {/if}
          </div>
          <div class="class-actions">
            <button class="button small outline" onclick={() => moveClass(room.id, -1)} disabled={index === 0} aria-label="Move {room.name} earlier">↑</button>
            <button class="button small outline" onclick={() => moveClass(room.id, 1)} disabled={index === app.classes.length - 1} aria-label="Move {room.name} later">↓</button>
            <button class="button small" onclick={() => startRename(room.id, room.name)}>Rename {room.name}</button>
            <button class="button small outline" onclick={() => archiveClass(room.id)}>Archive {room.name}</button>
          </div>
        {/if}
      </article>
    {:else}
      <div class="empty-state">No classes yet. Add your first one above.</div>
    {/each}
  </div>
  <p class="muted">Archiving a class hides it here. Its students and its pass history are kept.</p>
</section>
