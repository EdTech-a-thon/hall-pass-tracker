<script lang="ts">
  import { goto } from '$app/navigation';
  import Modal from './Modal.svelte';
  import { classPasses, deleteClass, updateClass } from './account.svelte';
  import Icon from './Icon.svelte';
  import type { Class, NoPassTime } from './types';

  let { cls, onClose }: { cls: Class; onClose: () => void } = $props();

  // The dialog edits a copy; nothing changes until Save.
  // svelte-ignore state_referenced_locally
  let name = $state(cls.name);
  // svelte-ignore state_referenced_locally
  let noPassTimes = $state<NoPassTime[]>(cls.noPassTimes.map((time) => ({ ...time })));
  let confirmingDelete = $state(false);
  let error = $state('');

  function save(event: SubmitEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    if (noPassTimes.some((time) => !time.start || !time.end || time.start >= time.end)) {
      error = 'Each no-pass time needs a start before its end.';
      return;
    }
    const sorted = [...noPassTimes].sort((a, b) => a.start.localeCompare(b.start));
    updateClass(cls.id, { name: name.trim(), noPassTimes: sorted });
    onClose();
  }

  function remove() {
    deleteClass(cls.id);
    onClose();
    goto('/', { replace: true });
  }
</script>

<Modal onClose={onClose} labelledby="settings-title">
  {#if confirmingDelete}
    <div class="dialog">
      <h2 id="settings-title">Delete {cls.name}?</h2>
      <p class="muted">
        Its {cls.students.length} students and {classPasses(cls.id).length} passes will be gone for good. Download a backup first
        if you might need them.
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

      <div class="field">
        <span>No-pass times</span>
        <span class="muted small" style="font-weight:500">
          While this class is on the kiosk, students can't leave during these times. If the line is on, they can join
          it and go when passes open.
        </span>
        {#each noPassTimes as time, index (index)}
          <div class="row" style="flex-wrap:nowrap">
            <input type="time" aria-label="No passes from" bind:value={time.start} required />
            <span class="muted small">to</span>
            <input type="time" aria-label="No passes until" bind:value={time.end} required />
            <button
              type="button"
              class="btn btn-small btn-quiet"
              aria-label="Remove this no-pass time"
              onclick={() => (noPassTimes = noPassTimes.filter((_, other) => other !== index))}
            >
              <Icon name="x" size={15} />
            </button>
          </div>
        {/each}
        <div>
          <button type="button" class="btn btn-small" onclick={() => noPassTimes.push({ start: '', end: '' })}>
            <Icon name="plus" size={14} />Add a no-pass time
          </button>
        </div>
      </div>

      {#if error}<p class="form-error" role="alert">{error}</p>{/if}
      <p class="muted small">How many students may be out at once is set for all classes in Pass Options.</p>
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
</Modal>
