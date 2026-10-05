<script lang="ts">
  import Modal from './Modal.svelte';
  import { applyImport } from './account.svelte';
  import Icon from './Icon.svelte';
  import { planImport } from './roster';
  import type { Class } from './types';

  let { cls, onClose }: { cls: Class; onClose: () => void } = $props();

  let pasted = $state('');
  let error = $state('');

  /**
   * Adds everyone new in the list. Students already in the class are kept as
   * they are, and nobody is ever removed from here: that's on the Students page.
   */
  function add() {
    const plan = planImport(pasted, cls.students);
    if (plan.error) {
      error = plan.error;
      return;
    }
    applyImport(cls.id, plan, []);
    onClose();
  }

  async function readFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    pasted = await file.text();
    add();
  }
</script>

<Modal onClose={onClose} labelledby="add-title">
  <div class="dialog" style="width:min(560px,100%)">
    <div class="dialog-head">
      <div>
        <p class="eyebrow">{cls.name}</p>
        <h2 id="add-title">Add students</h2>
      </div>
      <button class="btn btn-small btn-quiet" onclick={onClose} aria-label="Close"><Icon name="x" size={16} /></button>
    </div>
    <p class="muted small">
      Paste a list, one student per line, or choose a CSV. Happy Hallways keeps only first names plus the fewest letters of
      the last name it needs to tell students apart.
    </p>
    <textarea aria-label="One student per line" bind:value={pasted} oninput={() => (error = '')} rows="7" placeholder={'Maya Chen\nJordan Ellis'}></textarea>
    {#if error}<p class="form-error" role="alert">{error}</p>{/if}
    <div class="row">
      <button class="btn btn-primary" onclick={add} disabled={!pasted.trim()}>Add students</button>
      <label class="btn">
        <Icon name="upload" size={16} />Choose a CSV
        <input class="sr-only" type="file" accept=".csv,text/csv,text/plain" onchange={readFile} />
      </label>
    </div>
  </div>
</Modal>
