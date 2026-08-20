<script lang="ts">
  import { app, applyImport, archiveStudent, deleteStudent, previewImport, renameStudent } from '../lib/store.svelte';
  import { displayName } from '../lib/roster';
  import type { ImportPlan } from '../lib/roster';

  let { classId, name, onBack }: { classId: string; name: string; onBack: () => void } = $props();

  let pasted = $state('');
  let plan = $state(null as ImportPlan | null);
  let removing = $state([] as string[]);
  let busy = $state(false);
  let saveError = $state('');

  const current = $derived(app.roster.filter((student) => student.status === 'current'));
  const former = $derived(app.roster.filter((student) => student.status === 'former'));

  function preview() {
    saveError = '';
    plan = previewImport(pasted);
    removing = [];
  }

  async function readFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    pasted = await file.text();
    preview();
  }

  async function save() {
    if (!plan || busy) return;
    busy = true;
    saveError = await applyImport(classId, plan, removing);
    busy = false;
    if (!saveError) {
      plan = null;
      pasted = '';
    }
  }

  function toggleRemoval(recordId: string, checked: boolean) {
    removing = checked ? [...removing, recordId] : removing.filter((id) => id !== recordId);
  }

  async function edit(recordId: string, firstName: string, lastPrefix: string) {
    const nextFirst = prompt('First name', firstName);
    if (nextFirst === null) return;
    const nextPrefix = prompt('Letters of the last name to show (up to 3)', lastPrefix);
    if (nextPrefix === null) return;
    await renameStudent(recordId, nextFirst.trim(), nextPrefix.trim());
  }
</script>

<section class="workspace-head">
  <div>
    <p class="eyebrow">ROSTER</p>
    <h1>{name}</h1>
    <p>Only a first name and the first few letters of a last name are ever stored.</p>
  </div>
  <button class="button outline" onclick={onBack}>Back to classes</button>
</section>

<section class="panel">
  <div class="panel-head">
    <div>
      <p class="eyebrow">ADD STUDENTS</p>
      <h2>Paste or upload your list</h2>
    </div>
  </div>
  <label>
    Paste your class list
    <textarea bind:value={pasted} rows="6" placeholder={'Maya Chen\nJordan Ellis'}></textarea>
  </label>
  <label class="file-row">
    Or choose a CSV file
    <input type="file" accept=".csv,text/csv,text/plain" onchange={readFile} />
  </label>
  <button class="button primary" onclick={preview} disabled={!pasted.trim()}>Preview import</button>

  {#if plan}
    <div class="import-preview">
      {#if plan.error}
        <p class="form-error" role="alert">{plan.error}</p>
      {:else}
        <p class="eyebrow">WHAT WILL HAPPEN</p>
        <ul>
          {#each plan.added as entry, index (index)}
            <li><strong>Add</strong> {displayName(entry)}</li>
          {/each}
          {#each plan.matched as change (change.student.recordId)}
            <li><strong>Already here</strong> {displayName({ firstName: change.student.firstName, lastPrefix: change.lastPrefix })}</li>
          {/each}
        </ul>
        {#if plan.missing.length}
          <p class="eyebrow">NO LONGER ON YOUR LIST</p>
          <ul>
            {#each plan.missing as student (student.recordId)}
              <li>
                <label>
                  <input type="checkbox" onchange={(event) => toggleRemoval(student.recordId, event.currentTarget.checked)} />
                  Remove {student.name}
                </label>
              </li>
            {/each}
          </ul>
        {/if}
        <button class="button primary" onclick={save} disabled={busy}>Save roster</button>
      {/if}
      {#if saveError}<p class="form-error" role="alert">{saveError}</p>{/if}
    </div>
  {/if}
</section>

<section class="panel">
  <div class="panel-head">
    <div>
      <p class="eyebrow">ON THE ROSTER</p>
      <h2>{current.length} students</h2>
    </div>
  </div>
  <div class="class-list">
    {#each current as student (student.recordId)}
      <article>
        <div class="class-identity"><h3>{student.name}</h3></div>
        <div class="class-actions">
          <button class="button small" onclick={() => edit(student.recordId, student.firstName, student.lastPrefix)}>Edit {student.name}</button>
          <button class="button small outline" onclick={() => archiveStudent(student.recordId)}>Remove {student.name}</button>
          <button class="button small outline" onclick={() => deleteStudent(student.recordId)}>Delete {student.name}</button>
        </div>
      </article>
    {:else}
      <div class="empty-state">No students yet. Paste your list above.</div>
    {/each}
  </div>
</section>

{#if former.length}
  <section class="panel">
    <div class="panel-head">
      <div>
        <p class="eyebrow">NO LONGER IN THIS CLASS</p>
        <h2>Former students</h2>
      </div>
    </div>
    <div class="class-list">
      {#each former as student (student.recordId)}
        <article>
          <div class="class-identity"><h3>{student.name}</h3><span class="current">History kept</span></div>
        </article>
      {/each}
    </div>
  </section>
{/if}
