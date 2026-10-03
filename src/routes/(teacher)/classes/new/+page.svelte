<script lang="ts">
  import { goto } from '$app/navigation';
  import { account, createClass } from '#lib/account.svelte.ts';

  let name = $state('');
  const previous = $derived(account.classes.at(-1));

  function create(event: SubmitEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    goto(`/classes/${createClass(name.trim())}/roster`);
  }
</script>

<div class="page">
  <header class="page-head">
    <div>
      <p class="eyebrow">Classes</p>
      <h1>New class</h1>
      <p class="muted">
        {#if previous}
          It starts with the same destinations and pass limit as {previous.name}. You can change them under Setup.
        {:else}
          It starts with Restroom, Water, Office and Counselor. You can change them under Setup.
        {/if}
      </p>
    </div>
  </header>

  <form class="card" onsubmit={create}>
    <label class="field">
      Class name
      <!-- svelte-ignore a11y_autofocus -->
      <input bind:value={name} placeholder="Period 3 · Science" autofocus />
    </label>
    <div class="row">
      <button class="btn btn-primary" disabled={!name.trim()}>Create class</button>
    </div>
  </form>
</div>
