<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { account, createClass } from '#lib/account.svelte.ts';
  import Icon from '#lib/Icon.svelte';

  let name = $state('');

  // Only on arrival: once a class is created here, its own page takes over.
  onMount(() => {
    const first = account.classes[0];
    if (first) goto(`/classes/${first.id}`, { replace: true });
  });

  function create(event: SubmitEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    goto(`/classes/${createClass(name.trim())}?add`);
  }
</script>

{#if !account.classes.length}
  <div class="page">
    <header class="page-head">
      <div>
        <p class="eyebrow">Welcome to Happy Hallways</p>
        <h1>Start with your first class</h1>
        <p class="muted">
          Happy Hallways keeps track of who is out of your room, where they went and for how long. Everything stays on this
          computer. There's nothing to sign up for.
        </p>
      </div>
    </header>

    <form class="card" onsubmit={create}>
      <label class="field">
        Class name
        <input bind:value={name} placeholder="Period 1 · Math" />
      </label>
      <div class="row">
        <button class="btn btn-primary" disabled={!name.trim()}><Icon name="plus" size={16} />Create class</button>
      </div>
    </form>

    <p class="muted small">
      Is this the tablet or Chromebook by the door? <a href="/door">Make this device the kiosk</a>.
    </p>
  </div>
{/if}
