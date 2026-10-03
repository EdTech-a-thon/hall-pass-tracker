<script lang="ts">
  import { page } from '$app/state';
  import { applyImport, findClass, removeStudent, renameStudent, restoreStudent } from '#lib/account.svelte.ts';
  import Icon from '#lib/Icon.svelte';
  import { displayName, maxPrefix, planImport, type ImportPlan } from '#lib/roster.ts';
  import type { Student } from '#lib/types.ts';

  const cls = $derived(findClass(page.params.id ?? '')!);
  const current = $derived(cls.students.filter((student) => student.status === 'current'));
  const former = $derived(cls.students.filter((student) => student.status === 'former'));

  let pasted = $state('');
  let plan = $state(null as ImportPlan | null);
  let removing = $state([] as string[]);

  let editing = $state(null as Student | null);
  let editFirst = $state('');
  let editPrefix = $state('');
  let editError = $state('');

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
    plan = null;
    pasted = '';
  }

  function startEdit(student: Student) {
    editing = student;
    editFirst = student.firstName;
    editPrefix = student.lastPrefix;
    editError = '';
  }

  /** The same rule the import enforces: no two students may look alike on the door screen. */
  function saveEdit() {
    if (!editing) return;
    const firstName = editFirst.trim();
    const lastPrefix = editPrefix.trim().slice(0, maxPrefix);
    if (!firstName) {
      editError = 'A first name is needed.';
      return;
    }
    const name = displayName({ firstName, lastPrefix }).toLowerCase();
    const clash = current.find((other) => other.id !== editing!.id && displayName(other).toLowerCase() === name);
    if (clash) {
      editError = `${displayName(clash)} is already on this roster. Add a letter or use a nickname.`;
      return;
    }
    renameStudent(cls.id, editing.id, firstName, lastPrefix);
    editing = null;
  }
</script>

<section class="card">
  <div>
    <p class="eyebrow">Add students</p>
    <h2>Paste or upload your class list</h2>
    <p class="muted small">
      Hallway keeps only first names plus the fewest letters of the last name it needs to tell students apart. The
      rest of the last name is thrown away.
    </p>
  </div>
  <label class="field">
    One student per line
    <textarea bind:value={pasted} rows="5" placeholder={'Maya Chen\nJordan Ellis'}></textarea>
  </label>
  <div class="row">
    <button class="btn btn-primary" onclick={preview} disabled={!pasted.trim()}>Preview</button>
    <label class="btn">
      <Icon name="upload" size={16} />Choose a CSV
      <input class="sr-only" type="file" accept=".csv,text/csv,text/plain" onchange={readFile} />
    </label>
  </div>

  {#if plan}
    <div class="stack" style="padding-top:6px;border-top:1px solid var(--border)">
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
            <p class="eyebrow">Already here ({plan.matched.length})</p>
            <p class="muted">
              {plan.matched.map((change) => displayName({ firstName: change.student.firstName, lastPrefix: change.lastPrefix })).join(', ')}
            </p>
          </div>
        {/if}
        {#if plan.missing.length}
          <div class="stack" style="gap:6px">
            <p class="eyebrow">On the roster but not in your list</p>
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
        <div class="row">
          <button class="btn btn-primary" onclick={save}>Save roster</button>
          <button class="btn btn-quiet" onclick={() => (plan = null)}>Cancel</button>
        </div>
      {/if}
    </div>
  {/if}
</section>

<section class="card">
  <div>
    <p class="eyebrow">On the roster</p>
    <h2>{current.length} {current.length === 1 ? 'student' : 'students'}</h2>
  </div>
  {#if current.length}
    <div class="table-wrap">
      <table>
        <tbody>
          {#each current as student (student.id)}
            <tr>
              <td><strong>{displayName(student)}</strong></td>
              <td class="num">
                <button class="btn btn-small btn-quiet" onclick={() => startEdit(student)}>
                  <Icon name="pencil" size={14} />Edit
                </button>
                <button class="btn btn-small btn-quiet" onclick={() => removeStudent(cls.id, student.id)}>Remove</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <div class="empty">No students yet. Paste your list above.</div>
  {/if}
</section>

{#if former.length}
  <section class="card">
    <div>
      <p class="eyebrow">No longer in this class</p>
      <h2>Former students</h2>
      <p class="muted small">They're gone from the kiosk, but their trips stay in your history.</p>
    </div>
    <div class="table-wrap">
      <table>
        <tbody>
          {#each former as student (student.id)}
            <tr>
              <td>{displayName(student)}</td>
              <td class="num">
                <button class="btn btn-small btn-quiet" onclick={() => restoreStudent(cls.id, student.id)}>Bring back</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>
{/if}

{#if editing}
  <div class="backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-title">
    <form
      class="dialog"
      onsubmit={(event) => {
        event.preventDefault();
        saveEdit();
      }}
    >
      <h2 id="edit-title">Edit {displayName(editing)}</h2>
      <label class="field">First name or nickname <input bind:value={editFirst} /></label>
      <label class="field">
        Letters of the last name to show (up to {maxPrefix})
        <input bind:value={editPrefix} maxlength={maxPrefix} />
      </label>
      {#if editError}<p class="form-error" role="alert">{editError}</p>{/if}
      <div class="dialog-actions">
        <button type="button" class="btn" onclick={() => (editing = null)}>Cancel</button>
        <button class="btn btn-primary">Save</button>
      </div>
    </form>
  </div>
{/if}
