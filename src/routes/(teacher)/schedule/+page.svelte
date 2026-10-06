<script lang="ts">
  import {
    account,
    addSchedule,
    classScheduledNow,
    currentSchedule,
    deleteSchedule,
    duplicateSchedule,
    findClass,
    findSchedule,
    openPasses,
    saveSchedule,
    useSchedule,
  } from '#lib/account.svelte.ts';
  import ConfirmDialog from '#lib/ConfirmDialog.svelte';
  import DayCalendar from '#lib/DayCalendar.svelte';
  import Icon from '#lib/Icon.svelte';
  import { newId } from '#lib/passes.ts';
  import { formatRange, periodAt, periodProblem, sortedPeriods, toClock, toMinutes } from '#lib/schedule.ts';
  import type { Schedule } from '#lib/types.ts';

  /** The schedule open on this page, which need not be the one in use. */
  let editingId = $state(account.currentScheduleId);
  const schedule = $derived(findSchedule(editingId) ?? currentSchedule());
  const inUse = $derived(schedule.id === account.currentScheduleId);
  const following = $derived(!!account.activeClass?.onSchedule);
  const classes = $derived(account.classes);

  let clock = $state(Date.now());
  $effect(() => {
    const timer = setInterval(() => (clock = Date.now()), 30_000);
    return () => clearInterval(timer);
  });
  const periodNow = $derived(following ? periodAt(currentSchedule(), clock) : null);

  /** A row whose change was refused, and why. */
  let problem = $state<{ id: string; text: string } | null>(null);
  let confirmingUse = $state<string | null>(null);
  let confirmingDelete = $state(false);

  /** Edits a copy of the schedule, then saves it whole. */
  function change(edit: (draft: Schedule) => void) {
    const draft = $state.snapshot(schedule) as Schedule;
    edit(draft);
    saveSchedule(draft);
  }

  // ---------------------------------------------------------------------------
  // Picking a schedule
  // ---------------------------------------------------------------------------

  /** Whose passes picking a schedule would end, when it moves the kiosk to another class. */
  function useWarning(id: string) {
    const leaving = findClass(account.activeClass?.id);
    if (!leaving || classScheduledNow(id) === leaving.id) return null;
    const out = openPasses(leaving.id).length;
    if (!out) return null;
    return `The kiosk will move from ${leaving.name} now. ${out} ${out === 1 ? 'student is' : 'students are'} still out there; their passes will end with an unknown return time.`;
  }

  function use(id: string) {
    if (useWarning(id)) confirmingUse = id;
    else useSchedule(id);
  }

  function addAnother() {
    editingId = addSchedule(`Schedule ${account.schedules.length + 1}`);
  }

  function duplicate() {
    editingId = duplicateSchedule(schedule.id);
  }

  function remove() {
    deleteSchedule(schedule.id);
    editingId = account.currentScheduleId;
    confirmingDelete = false;
  }

  // ---------------------------------------------------------------------------
  // Periods
  // ---------------------------------------------------------------------------

  function addPeriod() {
    const last = sortedPeriods(schedule).at(-1);
    const start = last ? toMinutes(last.end) + 5 : 8 * 60;
    change((draft) => {
      draft.periods.push({ id: newId(), classId: null, start: toClock(start), end: toClock(Math.min(start + 50, 24 * 60 - 1)) });
    });
  }

  function setPeriodTime(event: Event & { currentTarget: HTMLInputElement }, id: string, field: 'start' | 'end') {
    const input = event.currentTarget;
    const period = schedule.periods.find((each) => each.id === id);
    if (!period) return;
    const next = { ...period, [field]: input.value };
    const why = periodProblem(schedule, next);
    if (why) {
      problem = { id, text: why };
      input.value = period[field];
      return;
    }
    problem = null;
    change((draft) => Object.assign(draft.periods.find((each) => each.id === id)!, { [field]: input.value }));
  }

  // ---------------------------------------------------------------------------
  // No-pass times
  // ---------------------------------------------------------------------------

  function setNoPassTime(event: Event & { currentTarget: HTMLInputElement }, id: string, field: 'start' | 'end') {
    const input = event.currentTarget;
    const time = schedule.noPassTimes.find((each) => each.id === id);
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

  function addNoPassTime() {
    change((draft) => draft.noPassTimes.push({ id: newId(), start: '12:00', end: '12:15' }));
  }
</script>

<div class="page wide">
  <header class="page-head">
    <div>
      <p class="eyebrow">Schedule</p>
      <h1>When each class is on the kiosk</h1>
      <p class="muted">
        Enter your periods once, and the kiosk changes class by itself as each one starts. Rotating days? Make a
        schedule for each, and pick the right one when you come in.
      </p>
    </div>
  </header>

  {#if following}
    <div class="status on" role="status">
      <span class="status-dot live"></span>
      <div>
        <strong>Following {currentSchedule().name}.</strong>
        {#if periodNow}
          Right now: {findClass(periodNow.classId)?.name ?? 'no class'} ({formatRange(periodNow)}).
        {:else}
          No class right now.
        {/if}
        <span class="muted">Changing the kiosk's class by hand turns the schedule off.</span>
      </div>
    </div>
  {:else}
    <div class="status off" role="status">
      <span class="status-dot"></span>
      <div>
        <strong>Schedule off.</strong> You're choosing the kiosk's class by hand, and only no-pass times you start
        from a class's Now tab apply.
      </div>
      <button class="btn btn-primary" onclick={() => use(account.currentScheduleId)} disabled={!currentSchedule().periods.length}>
        <Icon name="calendar" size={16} />Turn on {currentSchedule().name}
      </button>
    </div>
  {/if}

  <div class="layout">
    <div class="settings">
      {#if account.schedules.length > 1}
        <nav class="schedule-tabs" aria-label="Your schedules">
          {#each account.schedules as each (each.id)}
            <button class="schedule-tab" class:active={each.id === schedule.id} onclick={() => (editingId = each.id)}>
              {each.name}
              {#if each.id === account.currentScheduleId}<span class="badge ok">In use</span>{/if}
            </button>
          {/each}
          <button class="schedule-tab add" onclick={addAnother}><Icon name="plus" size={14} />New</button>
        </nav>
      {/if}

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
        <div class="row">
          {#if !inUse || !following}
            <button class="btn btn-primary btn-small" onclick={() => use(schedule.id)} disabled={!schedule.periods.length}>
              Use this schedule
            </button>
          {/if}
          <button class="btn btn-small" onclick={duplicate}><Icon name="copy" size={14} />Duplicate</button>
          {#if account.schedules.length > 1}
            <button class="btn btn-small btn-danger" onclick={() => (confirmingDelete = true)}>
              <Icon name="trash" size={14} />Delete
            </button>
          {:else}
            <button class="btn btn-small" onclick={addAnother}><Icon name="plus" size={14} />Another schedule</button>
          {/if}
        </div>
      </section>

      <section class="card">
        <div>
          <h2>Periods</h2>
          <p class="muted small">Which class is on the kiosk, and when. Periods can't overlap.</p>
        </div>
        {#each sortedPeriods(schedule) as period (period.id)}
          <div class="time-row">
            <select
              aria-label="Class"
              value={period.classId ?? ''}
              onchange={(event) => change((draft) => (draft.periods.find((each) => each.id === period.id)!.classId = event.currentTarget.value || null))}
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
            While the kiosk follows this schedule, students can't leave at these times. If the line is on, they can
            join it and go when passes open.
          </p>
        </div>
        {#each schedule.rules as rule (rule.id)}
          <div class="rule-row">
            <select
              aria-label="First or last"
              value={rule.edge}
              onchange={(event) =>
                change((draft) => (draft.rules.find((each) => each.id === rule.id)!.edge = event.currentTarget.value as 'first' | 'last'))}
            >
              <option value="first">First</option>
              <option value="last">Last</option>
            </select>
            <input
              type="number"
              aria-label="Minutes"
              min="1"
              max="120"
              value={rule.minutes}
              onchange={(event) => {
                const minutes = Math.round(Number(event.currentTarget.value));
                if (minutes >= 1 && minutes <= 120) change((draft) => (draft.rules.find((each) => each.id === rule.id)!.minutes = minutes));
                else event.currentTarget.value = String(rule.minutes);
              }}
            />
            <span class="small">minutes of</span>
            <select
              aria-label="Which classes"
              value={rule.classId ?? ''}
              onchange={(event) =>
                change((draft) => (draft.rules.find((each) => each.id === rule.id)!.classId = event.currentTarget.value || null))}
            >
              <option value="">every class</option>
              {#each classes as cls (cls.id)}<option value={cls.id}>{cls.name}</option>{/each}
            </select>
            <button
              class="btn btn-quiet btn-small"
              aria-label="Remove this rule"
              onclick={() => change((draft) => (draft.rules = draft.rules.filter((each) => each.id !== rule.id)))}
            >
              <Icon name="x" size={15} />
            </button>
          </div>
        {/each}
        <div class="row">
          <button
            class="btn btn-small"
            onclick={() => change((draft) => draft.rules.push({ id: newId(), edge: 'first', minutes: 10, classId: null }))}
          >
            <Icon name="plus" size={14} />First or last minutes of class
          </button>
        </div>

        {#if schedule.noPassTimes.length}
          <p class="eyebrow">At set times</p>
        {/if}
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
        <div><button class="btn btn-small" onclick={addNoPassTime}><Icon name="plus" size={14} />A set time</button></div>
      </section>
    </div>

    <section class="card calendar-card" aria-label="{schedule.name} calendar">
      <div class="card-head">
        <div>
          <p class="eyebrow">{schedule.name}{inUse ? ' · in use' : ''}</p>
          <p class="muted small">Drag across empty time to add a period or a no-pass time.</p>
        </div>
      </div>
      <DayCalendar {schedule} {classes} showNow={inUse} onsave={saveSchedule} />
    </section>
  </div>
</div>

{#if confirmingUse}
  {@const id = confirmingUse}
  <ConfirmDialog
    title="Use {findSchedule(id)?.name}?"
    message={useWarning(id) ?? ''}
    confirmLabel="Use this schedule"
    onConfirm={() => {
      useSchedule(id);
      confirmingUse = null;
    }}
    onCancel={() => (confirmingUse = null)}
  />
{/if}

{#if confirmingDelete}
  <ConfirmDialog
    title="Delete {schedule.name}?"
    message={inUse
      ? `It's the schedule in use. ${account.schedules.find((each) => each.id !== schedule.id)?.name} will take its place.`
      : 'Its periods and no-pass times will be gone.'}
    confirmLabel="Delete schedule"
    danger
    onConfirm={remove}
    onCancel={() => (confirmingDelete = false)}
  />
{/if}

<style>
  .wide {
    max-width: 1240px;
  }

  .status {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    font-size: 14px;
  }

  .status > div {
    flex: 1;
  }

  .status.on {
    border-color: #c7dccd;
    background: var(--accent-wash);
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

  .schedule-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .schedule-tab {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: 1px solid var(--border-strong);
    border-radius: 999px;
    background: var(--surface);
    font-size: 13.5px;
    font-weight: 700;
    cursor: pointer;
  }

  .schedule-tab.active {
    border-color: var(--accent);
    background: var(--accent-wash);
    color: var(--accent);
  }

  .schedule-tab.add {
    border-style: dashed;
    color: var(--muted);
  }

  .time-row,
  .rule-row {
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

  .rule-row select:first-child {
    width: 82px;
    flex: 0 0 auto;
  }

  .rule-row input[type='number'] {
    width: 64px;
    flex: 0 0 auto;
  }

  .rule-row span {
    white-space: nowrap;
  }

  .rule-row select:last-of-type {
    flex: 1;
    min-width: 0;
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
