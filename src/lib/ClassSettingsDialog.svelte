<script lang="ts">
  import { goto } from '$app/navigation';
  import { classPasses, deleteClass, updateClass } from './account.svelte';
  import Icon from './Icon.svelte';
  import type { Class } from './types';

  let { cls, onClose }: { cls: Class; onClose: () => void } = $props();

  // The dialog edits a copy; nothing changes until Save.
  // svelte-ignore state_referenced_locally
  let name = $state(cls.name);
  // svelte-ignore state_referenced_locally
  let limit = $state(cls.limit);
  let confirmingDelete = $state(false);

  function save(event: SubmitEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    updateClass(cls.id, { name: name.trim(), limit });
    onClose();
  }

  function remove() {
    deleteClass(cls.id);
    onClose();
    goto('/', { replace: true });
  }
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && onClose()} />

<div class="backdrop" role="dialog" aria-modal="true" aria-labelledby="settings-title">
  {#if confirmingDelete}
    <div class="dialog">
      <h2 id="settings-title">Delete {cls.name}?</h2>
      <p class="muted">
        Its {cls.students.length} students and {classPasses(cls.id).length} passes will be gone for good. Export your
        account first if you might need them.
      </p>
      <div class="dialog-actions">
        <button class="btn" onclick={() => (confirmingDelete = false)}>Cancel</button>
        <button class="btn btn-danger solid" onclick={remove}>Delete class</button>
      </div>
    </div>
  {:else}
    <form class="dialog" onsubmit={save}>
      <h2 id="settings-title">Class settings</h2>
      <label class="field">Class name <input bind:value={name} /></label>
      <label class="field">
        How many students may be out at once
        <select bind:value={limit}>
          {#each [1, 2, 3, 4, 5, 6] as option (option)}<option value={option}>{option}</option>{/each}
        </select>
      </label>
      <div class="dialog-actions" style="justify-content:space-between">
        <button type="button" class="btn btn-danger" onclick={() => (confirmingDelete = true)}>
          <Icon name="trash" size={15} />Delete class
        </button>
        <div class="row">
          <button type="button" class="btn" onclick={onClose}>Cancel</button>
          <button class="btn btn-primary" disabled={!name.trim()}>Save</button>
        </div>
      </div>
    </form>
  {/if}
</div>
