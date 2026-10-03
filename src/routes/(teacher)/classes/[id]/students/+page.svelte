<script lang="ts">
  import { page } from '$app/state';
  import { classPasses, findClass, removeStudent, restoreStudent } from '#lib/account.svelte.ts';
  import EditStudentDialog from '#lib/EditStudentDialog.svelte';
  import Icon from '#lib/Icon.svelte';
  import type { Student } from '#lib/types.ts';
  import { duration, hasRealDuration, isOverdue, shortDate, time } from '#lib/passes.ts';
  import { studentSummaries, type StudentSummary } from '#lib/stats.ts';

  const cls = $derived(findClass(page.params.id ?? '')!);

  type SortKey = 'minutesWeek' | 'week' | 'today' | 'total' | 'minutesTotal' | 'overdue' | 'name';
  let sortBy = $state<SortKey>('minutesWeek');
  let open = $state('');
  let editing = $state(null as Student | null);

  function studentFor(id: string) {
    return cls.students.find((student) => student.id === id);
  }

  const rows = $derived.by(() => {
    const summaries = studentSummaries(cls, classPasses(cls.id));
    const key = sortBy;
    if (key === 'name') return summaries.sort((a, b) => a.name.localeCompare(b.name));
    return summaries.sort((a, b) => b[key] - a[key] || a.name.localeCompare(b.name));
  });

  const columns: { key: SortKey; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'This week' },
    { key: 'minutesWeek', label: 'Min. this week' },
    { key: 'total', label: 'All time' },
    { key: 'minutesTotal', label: 'Min. all time' },
    { key: 'overdue', label: 'Overdue' },
  ];

  function toggle(summary: StudentSummary) {
    open = open === summary.id ? '' : summary.id;
  }
</script>

<section class="card">
  <div class="card-head">
    <div>
      <p class="eyebrow">Per student</p>
      <h2>Who goes, and how much class they miss</h2>
      <p class="muted small">
        Minutes count only trips whose return someone saw. Click a student to see their trips.
        Removed students keep their history here.
      </p>
    </div>
  </div>
  {#if rows.length}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th aria-sort={sortBy === 'name' ? 'ascending' : 'none'}>
              <button class="btn btn-small btn-quiet" onclick={() => (sortBy = 'name')}>Student</button>
            </th>
            {#each columns as column (column.key)}
              <th class="num" aria-sort={sortBy === column.key ? 'descending' : 'none'}>
                <button class="btn btn-small btn-quiet" style:color={sortBy === column.key ? 'var(--accent)' : ''} onclick={() => (sortBy = column.key)}>
                  {column.label}
                </button>
              </th>
            {/each}
            <th><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {#each rows as summary (summary.id)}
            <tr class="clickable" onclick={() => toggle(summary)}>
              <td>
                <strong>{summary.name}</strong>
                {#if summary.former}<span class="badge">Former</span>{/if}
              </td>
              <td class="num">{summary.today}</td>
              <td class="num">{summary.week}</td>
              <td class="num"><strong>{summary.minutesWeek}</strong></td>
              <td class="num">{summary.total}</td>
              <td class="num">{summary.minutesTotal}</td>
              <td class="num">
                {#if summary.overdue}<span class="badge warn">{summary.overdue}</span>{:else}0{/if}
              </td>
              <td class="num" style="white-space:nowrap">
                {#if summary.former}
                  <button class="btn btn-small btn-quiet" onclick={(event) => { event.stopPropagation(); restoreStudent(cls.id, summary.id); }}>
                    Bring back
                  </button>
                {:else}
                  <button
                    class="btn btn-small btn-quiet"
                    aria-label="Edit {summary.name}"
                    onclick={(event) => { event.stopPropagation(); editing = studentFor(summary.id) ?? null; }}
                  >
                    <Icon name="pencil" size={14} />
                  </button>
                  <button class="btn btn-small btn-quiet" onclick={(event) => { event.stopPropagation(); removeStudent(cls.id, summary.id); }}>
                    Remove
                  </button>
                {/if}
              </td>
            </tr>
            {#if open === summary.id}
              <tr class="detail">
                <td colspan="8">
                  {#if summary.passes.length}
                    <ul class="trips">
                      {#each summary.passes.slice(0, 15) as pass (pass.id)}
                        <li>
                          <span>{shortDate(pass.outAt)}, {time(pass.outAt)}</span>
                          <span>{pass.destination}</span>
                          <span>
                            {#if !pass.inAt}still out{:else if hasRealDuration(pass)}{duration(pass)} min{:else}return unknown{/if}
                            {#if isOverdue(pass)}<span class="badge warn">Overdue</span>{/if}
                          </span>
                        </li>
                      {/each}
                    </ul>
                    {#if summary.passes.length > 15}
                      <p class="muted small">Showing the latest 15 of {summary.passes.length}. The CSV on the Now tab has them all.</p>
                    {/if}
                  {:else}
                    <span class="muted">No trips yet.</span>
                  {/if}
                </td>
              </tr>
            {/if}
          {/each}
        </tbody>
      </table>
    </div>
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
  th .btn {
    padding: 0;
    min-height: 0;
    font: inherit;
    letter-spacing: inherit;
    text-transform: inherit;
  }

  .trips {
    display: grid;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 13.5px;
  }

  .trips li {
    display: grid;
    grid-template-columns: 160px 1fr auto;
    gap: 12px;
  }
</style>
