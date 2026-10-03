<script lang="ts">
  import Modal from './Modal.svelte';
  import { renameStudent } from './account.svelte';
  import { displayName, maxPrefix } from './roster';
  import type { Class, Student } from './types';

  let { cls, student, onClose }: { cls: Class; student: Student; onClose: () => void } = $props();

  // The dialog edits a copy; nothing changes until Save.
  // svelte-ignore state_referenced_locally
  let firstName = $state(student.firstName);
  // svelte-ignore state_referenced_locally
  let lastPrefix = $state(student.lastPrefix);
  let error = $state('');

  /** The same rule the import enforces: no two students may look alike at the kiosk. */
  function save(event: SubmitEvent) {
    event.preventDefault();
    const first = firstName.trim();
    const prefix = lastPrefix.trim().slice(0, maxPrefix);
    if (!first) {
      error = 'A first name is needed.';
      return;
    }
    const name = displayName({ firstName: first, lastPrefix: prefix }).toLowerCase();
    const clash = cls.students.find(
      (other) => other.id !== student.id && other.status === 'current' && displayName(other).toLowerCase() === name,
    );
    if (clash) {
      error = `${displayName(clash)} is already in this class. Add a letter or use a nickname.`;
      return;
    }
    renameStudent(cls.id, student.id, first, prefix);
    onClose();
  }
</script>

<Modal onClose={onClose} labelledby="edit-title">
  <form class="dialog" onsubmit={save}>
    <h2 id="edit-title">Edit {displayName(student)}</h2>
    <label class="field">First name or nickname <input bind:value={firstName} /></label>
    <label class="field">
      Letters of the last name to show (up to {maxPrefix})
      <input bind:value={lastPrefix} maxlength={maxPrefix} />
    </label>
    {#if error}<p class="form-error" role="alert">{error}</p>{/if}
    <div class="dialog-actions">
      <button type="button" class="btn" onclick={onClose}>Cancel</button>
      <button class="btn btn-primary">Save</button>
    </div>
  </form>
</Modal>
