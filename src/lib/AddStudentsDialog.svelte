<script lang="ts">
  import { applyImport } from './account.svelte';
  import Icon from './Icon.svelte';
  import { displayName, planImport, type ImportPlan } from './roster';
  import type { Class } from './types';

  let { cls, onClose }: { cls: Class; onClose: () => void } = $props();

  let pasted = $state('');
  let plan = $state(null as ImportPlan | null);
  let removing = $state([] as string[]);

  function preview() {
    plan = planImport(pasted, cls.students);
    removing = [];
  }

  async function readFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    pasted = await file.text();
    preview();
  }

  function save() {
    if (!plan || plan.error) return;
    applyImport(cls.id, plan, removing);
    onClose();
  }
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && onClose()} />

<div class="backdrop" role="dialog" aria-modal="true" aria-labelledby="add-title">
  <div class="dialog" style="width:min(560px,100%)">
    <div class="dialog-head">
      <div>
        <p class="eyebrow">{cls.name}</p>
        <h2 id="add-title">Add students</h2>
      </div>
      <button class="btn btn-small btn-quiet" onclick={onClose} aria-label="Close"><Icon name="x" size={16} /></button>
    </div>
    <p class="muted small">
      Paste a list, one student per line, or choose a CSV. Hallway keeps only first names plus the fewest letters of
      the last name it needs to tell students apart.
    </p>
    <textarea aria-label="One student per line" bind:value={pasted} rows="7" placeholder={'Maya Chen\nJordan Ellis'}></textarea>
    <div class="row">
      <button class="btn btn-primary" onclick={preview} disabled={!pasted.trim()}>Preview</button>
      <label class="btn">
        <Icon name="upload" size={16} />Choose a CSV
        <input class="sr-only" type="file" accept=".csv,text/csv,text/plain" onchange={readFile} />
      </label>
    </div>

    {#if plan}
      <div class="stack" style="padding-top:12px;border-top:1px solid var(--border)">
        {#if plan.error}
          <p class="form-error" role="alert">{plan.error}</p>
        {:else}
          {#if plan.added.length}
            <div>
              <p class="eyebrow">Will be added ({plan.added.length})</p>
              <p>{plan.added.map(displayName).join(', ')}</p>
            </div>
          {/if}
          {#if plan.matched.length}
            <div>
              <p class="eyebrow">Already in the class ({plan.matched.length})</p>
              <p class="muted">
                {plan.matched.map((change) => displayName({ firstName: change.student.firstName, lastPrefix: change.lastPrefix })).join(', ')}
              </p>
            </div>
          {/if}
          {#if plan.missing.length}
            <div class="stack" style="gap:6px">
              <p class="eyebrow">In the class but not in your list</p>
              {#each plan.missing as student (student.id)}
                <label class="row small">
                  <input
                    type="checkbox"
                    onchange={(event) =>
                      (removing = event.currentTarget.checked
                        ? [...removing, student.id]
                        : removing.filter((id) => id !== student.id))}
                  />
                  Remove {displayName(student)}
                </label>
              {/each}
            </div>
          {/if}
          <div class="dialog-actions">
            <button class="btn btn-primary" onclick={save}>Save students</button>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
