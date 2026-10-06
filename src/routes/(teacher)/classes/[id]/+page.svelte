<script lang="ts">
  import { page } from '$app/state';
  import { account, classPasses, findClass, removeStudent, restoreStudent } from '#lib/account.svelte.ts';
  import { usedBy } from '#lib/allowance.ts';
  import EditStudentDialog from '#lib/EditStudentDialog.svelte';
  import Icon from '#lib/Icon.svelte';
  import { studentSummaries } from '#lib/stats.ts';
  import type { Student } from '#lib/types.ts';

  /**
   * A class is its roster. How often each student goes is shown for a glance;
   * their passes are in History, one click away.
   */
  const cls = $derived(findClass(page.params.id ?? '')!);
  const allowance = $derived(account.passAllowance);
  let editing = $state(null as Student | null);

  const rows = $derived.by(() => {
    const passes = classPasses(cls.id);
    return studentSummaries(cls, passes)
      .map((summary) => ({
        ...summary,
        student: cls.students.find((student) => student.id === summary.id)!,
        allowanceUsed: usedBy(allowance, cls.id, summary.id, passes),
      }))
      .sort((a, b) => Number(a.former) - Number(b.former) || a.name.localeCompare(b.name));
  });
</script>

<section class="card" data-tip="tip-roster">
  <div>
    <p class="eyebrow">Roster</p>
    <h2>Students</h2>
  </div>
  {#if rows.length}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Student</th>
            {#if allowance.enabled}<th class="num">Passes used</th>{/if}
            <th class="num">This week</th>
            <th class="num">Min. this week</th>
            <th><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {#each rows as row (row.id)}
            <tr>
              <td>
                <a class="student-link" href="/history?class={cls.id}&student={row.id}" title="See {row.name}'s passes in History">
                  <strong>{row.name}</strong>
                </a>
                {#if row.former}<span class="badge">Former</span>{/if}
                {#if row.student.exempt}<span class="badge">Exempt</span>{/if}
                {#if allowance.enabled && !row.student.exempt && !row.former && row.allowanceUsed >= allowance.passes}
                  <span class="badge warn">Out of passes</span>
                {/if}
              </td>
              {#if allowance.enabled}
                <td class="num">{row.student.exempt ? '–' : `${row.allowanceUsed} of ${allowance.passes}`}</td>
              {/if}
              <td class="num">{row.week}</td>
              <td class="num">{row.minutesWeek}</td>
              <td class="num" style="white-space:nowrap">
                {#if row.former}
                  <button class="btn btn-small btn-quiet" onclick={() => restoreStudent(cls.id, row.id)}>Bring back</button>
                {:else}
                  <button class="btn btn-small btn-quiet" aria-label="Edit {row.name}" onclick={() => (editing = row.student)}>
                    <Icon name="pencil" size={14} />
                  </button>
                  <button class="btn btn-small btn-quiet" onclick={() => removeStudent(cls.id, row.id)}>Remove</button>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="muted small">Click a student to see their passes in History. Removed students keep their history.</p>
  {:else}
    <div class="empty">
      <span class="icon-tile"><Icon name="users" /></span>
      No students yet. Use Add students at the top to paste your class list.
    </div>
  {/if}
</section>

{#if editing}
  <EditStudentDialog {cls} student={editing} onClose={() => (editing = null)} />
{/if}

<style>
  .student-link {
    color: inherit;
    text-decoration: none;
  }

  .student-link:hover strong {
    color: var(--accent);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
</style>
