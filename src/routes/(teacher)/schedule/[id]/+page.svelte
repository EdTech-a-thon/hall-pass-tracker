<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import {
    account,
    classScheduledNow,
    deleteSchedule,
    duplicateSchedule,
    findClass,
    findSchedule,
    liveSchedule,
    openPasses,
    saveSchedule,
    stopFollowingSchedule,
    useSchedule,
  } from '#lib/account.svelte.ts';
  import ConfirmDialog from '#lib/ConfirmDialog.svelte';
  import DayCalendar from '#lib/DayCalendar.svelte';
  import Icon from '#lib/Icon.svelte';
  import { newId } from '#lib/passes.ts';
  import { periodProblem, sortedPeriods, toClock, toMinutes } from '#lib/schedule.ts';
  import type { Schedule } from '#lib/types.ts';

  /**
   * One schedule, full page: its name and lists on the left, its day as a
   * calendar on the right. Both change the same schedule; the calendar is the
   * quick way, the lists the keyboard way.
   */
  const schedule = $derived(findSchedule(page.params.id ?? ''));
  const isNew = $derived(page.url.searchParams.has('new'));
  const isLive = $derived(!!schedule && liveSchedule()?.id === schedule.id);
  const classes = $derived(account.classes);

  /** A row whose change was refused, and why. */
  let problem = $state<{ id: string; text: string } | null>(null);
  let confirmingUse = $state(false);
  let confirmingDelete = $state(false);

  /** Edits a copy of the schedule, then saves it whole. */
  function change(edit: (draft: Schedule) => void) {
    if (!schedule) return;
    const draft = $state.snapshot(schedule) as Schedule;
    edit(draft);
    saveSchedule(draft);
  }

  /** Whose passes using this schedule would end, when it moves the kiosk to another class. */
  function useWarning(id: string) {
    const leaving = findClass(account.activeClass?.id);
    if (!leaving || classScheduledNow(id) === leaving.id) return null;
    const out = openPasses(leaving.id).length;
    if (!out) return null;
    return `The kiosk will move from ${leaving.name} now. ${out} ${out === 1 ? 'student is' : 'students are'} still out there; their passes will end with an unknown return time.`;
  }

  function use(id: string) {
    if (useWarning(id)) confirmingUse = true;
    else useSchedule(id);
  }

  function duplicate(id: string) {
    goto(`/schedule/${duplicateSchedule(id)}`);
  }

  function remove(id: string) {
    deleteSchedule(id);
    confirmingDelete = false;
    goto('/schedule');
  }

  function addPeriod() {
    change((draft) => {
      const last = sortedPeriods(draft).at(-1);
      const start = last ? toMinutes(last.end) + 5 : 8 * 60;
      const end = toClock(Math.min(start + 50, 24 * 60 - 1));
      draft.periods.push({ id: newId(), classId: null, start: toClock(start), end, noPass: { first: 0, last: 0 } });
    });
  }

  function setPeriodTime(event: Event & { currentTarget: HTMLInputElement }, id: string, field: 'start' | 'end') {
    const input = event.currentTarget;
    const period = schedule?.periods.find((each) => each.id === id);
    if (!schedule || !period) return;
    const why = periodProblem(schedule, { ...period, [field]: input.value });
    if (why) {
      problem = { id, text: why };
      input.value = period[field];
      return;
    }
    problem = null;
    change((draft) => Object.assign(draft.periods.find((each) => each.id === id)!, { [field]: input.value }));
  }

  function setNoPassTime(event: Event & { currentTarget: HTMLInputElement }, id: string, field: 'start' | 'end') {
    const input = event.currentTarget;
    const time = schedule?.noPassTimes.find((each) => each.id === id);
    if (!time) return;
    const next = { ...time, [field]: input.value };
    if (!next.start || !next.end || next.start >= next.end) {
      problem = { id, text: 'A no-pass time needs to start before it ends.' };
      input.value = time[field];
      return;
    }
    problem = null;
    change((draft) => Object.assign(draft.noPassTimes.find((each) => each.id === id)!, { [field]: input.value }));
  }
</script>

{#if !schedule}
  <div class="page">
    <a class="back" href="/schedule"><Icon name="arrow-left" size={16} />All schedules</a>
    <div class="empty">That schedule isn't here anymore.</div>
  </div>
{:else}
  <div class="page editor">
    <header class="editor-head">
      <div class="stack" style="gap:4px">
        <a class="back" href="/schedule"><Icon name="arrow-left" size={16} />All schedules</a>
        <h1>{isNew ? 'Create new schedule' : 'Edit schedule'}</h1>
      </div>
      <div class="row">
        {#if isLive}
          <span class="badge ok"><span class="status-dot live"></span>Live</span>
          <button class="btn btn-small" onclick={stopFollowingSchedule}>Stop using</button>
        {:else}
          <button
            class="btn btn-primary btn-small"
            onclick={() => use(schedule.id)}
            disabled={!schedule.periods.length}
            title={schedule.periods.length ? undefined : 'Add a period first'}>Use this schedule</button
          >
        {/if}
        <button class="btn btn-small" onclick={() => duplicate(schedule.id)}><Icon name="copy" size={14} />Duplicate</button>
        <button class="btn btn-small btn-danger" onclick={() => (confirmingDelete = true)}>
          <Icon name="trash" size={14} />Delete
        </button>
      </div>
    </header>

    <div class="layout">
      <div class="settings">
        <section class="card">
          <label class="field">
            Schedule name
            <input
              value={schedule.name}
              onchange={(event) => {
                const name = event.currentTarget.value.trim();
                if (name) change((draft) => (draft.name = name));
                else event.currentTarget.value = schedule.name;
              }}
            />
          </label>
        </section>

        <section class="card">
          <div>
            <h2>Periods</h2>
            <p class="muted small">
              Which class is on the kiosk, and when. Periods can't overlap. Click a period on the calendar to set
              no-pass minutes at its start and end.
            </p>
          </div>
          {#each sortedPeriods(schedule) as period (period.id)}
            <div class="time-row">
              <select
                aria-label="Class"
                value={period.classId ?? ''}
                onchange={(event) =>
                  change((draft) => (draft.periods.find((each) => each.id === period.id)!.classId = event.currentTarget.value || null))}
              >
                <option value="">No class</option>
                {#each classes as cls (cls.id)}<option value={cls.id}>{cls.name}</option>{/each}
              </select>
              <input type="time" aria-label="Starts" value={period.start} onchange={(event) => setPeriodTime(event, period.id, 'start')} />
              <input type="time" aria-label="Ends" value={period.end} onchange={(event) => setPeriodTime(event, period.id, 'end')} />
              <button
                class="btn btn-quiet btn-small"
                aria-label="Remove this period"
                onclick={() => change((draft) => (draft.periods = draft.periods.filter((each) => each.id !== period.id)))}
              >
                <Icon name="x" size={15} />
              </button>
            </div>
            {#if problem?.id === period.id}<p class="form-error" role="alert">{problem.text}</p>{/if}
          {:else}
            <p class="muted small">No periods yet. Add one here, or drag across the calendar.</p>
          {/each}
          <div><button class="btn btn-small" onclick={addPeriod}><Icon name="plus" size={14} />Add a period</button></div>
          {#if !classes.length}
            <p class="muted small"><a href="/classes/new">Create a class</a> to put it in a period.</p>
          {/if}
        </section>

        <section class="card">
          <div>
            <h2>No-pass times</h2>
            <p class="muted small">
              Set times when nobody can leave, whichever class is on the kiosk. They apply while the kiosk follows
              this schedule. If the line is on, students can join it and go when passes open.
            </p>
          </div>
          {#each schedule.noPassTimes as time (time.id)}
            <div class="time-row">
              <span class="small muted">No passes</span>
              <input type="time" aria-label="No passes from" value={time.start} onchange={(event) => setNoPassTime(event, time.id, 'start')} />
              <input type="time" aria-label="No passes until" value={time.end} onchange={(event) => setNoPassTime(event, time.id, 'end')} />
              <button
                class="btn btn-quiet btn-small"
                aria-label="Remove this no-pass time"
                onclick={() => change((draft) => (draft.noPassTimes = draft.noPassTimes.filter((each) => each.id !== time.id)))}
              >
                <Icon name="x" size={15} />
              </button>
            </div>
            {#if problem?.id === time.id}<p class="form-error" role="alert">{problem.text}</p>{/if}
          {/each}
          <div>
            <button class="btn btn-small" onclick={() => change((draft) => draft.noPassTimes.push({ id: newId(), start: '12:00', end: '12:15' }))}>
              <Icon name="plus" size={14} />A set time
            </button>
          </div>
        </section>
      </div>

      <section class="card calendar-card" aria-label="{schedule.name} calendar">
        <DayCalendar {schedule} {classes} showNow={isLive} onsave={saveSchedule} />
      </section>
    </div>
  </div>

  {#if confirmingUse}
    <ConfirmDialog
      title="Use {schedule.name}?"
      message={useWarning(schedule.id) ?? ''}
      confirmLabel="Use this schedule"
      onConfirm={() => {
        useSchedule(schedule.id);
        confirmingUse = false;
      }}
      onCancel={() => (confirmingUse = false)}
    />
  {/if}

  {#if confirmingDelete}
    <ConfirmDialog
      title="Delete {schedule.name}?"
      message={isLive
        ? "The kiosk is following it. It will stay on the class it has now, and you'll choose classes by hand."
        : 'Its periods and no-pass times will be gone.'}
      confirmLabel="Delete schedule"
      danger
      onConfirm={() => remove(schedule.id)}
      onCancel={() => (confirmingDelete = false)}
    />
  {/if}
{/if}

<style>
  .editor {
    max-width: none;
  }

  .editor-head {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px 18px;
  }

  .back {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--muted);
    font-size: 14px;
    font-weight: 700;
    text-decoration: none;
  }

  .back:hover {
    color: var(--accent);
  }

  .layout {
    display: grid;
    grid-template-columns: minmax(0, 480px) minmax(0, 1fr);
    align-items: start;
    gap: 18px;
  }

  .settings {
    display: grid;
    gap: 14px;
  }

  .time-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .time-row select {
    flex: 1;
    min-width: 0;
  }

  .time-row input[type='time'] {
    width: 132px;
    flex: 0 0 auto;
  }

  .time-row > .small {
    flex: 1;
  }

  .badge .status-dot {
    margin-right: 4px;
  }

  .calendar-card {
    position: sticky;
    top: 16px;
    max-height: calc(100vh - 32px);
    overflow-y: auto;
  }

  @media (max-width: 900px) {
    .layout {
      grid-template-columns: 1fr;
    }

    .calendar-card {
      position: static;
      max-height: none;
    }
  }
</style>
