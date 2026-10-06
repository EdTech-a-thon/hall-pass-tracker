<script lang="ts">
  import { goto } from '$app/navigation';
  import {
    account,
    addSchedule,
    classScheduledNow,
    findClass,
    findSchedule,
    liveSchedule,
    openPasses,
    stopFollowingSchedule,
    useSchedule,
  } from '#lib/account.svelte.ts';
  import ConfirmDialog from '#lib/ConfirmDialog.svelte';
  import Icon from '#lib/Icon.svelte';
  import SchedulePreview from '#lib/SchedulePreview.svelte';

  /** Every schedule the teacher has, as cards: open one to change it, or pick the one the kiosk follows. */
  const live = $derived(liveSchedule());

  let confirmingUse = $state<string | null>(null);

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

  function create() {
    const id = addSchedule(`Schedule ${account.schedules.length + 1}`);
    goto(`/schedule/${id}?new`);
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
    {#if account.schedules.length}
      <button class="btn btn-primary" onclick={create}><Icon name="plus" size={16} />New schedule</button>
    {/if}
  </header>

  {#if !live && account.schedules.length}
    <div class="status" role="status">
      <span class="status-dot"></span>
      <div>
        <strong>No schedule in use.</strong> You're choosing the kiosk's class by hand. Pick <em>Use this</em> on a
        schedule to have the kiosk follow it.
      </div>
    </div>
  {/if}

  {#if !account.schedules.length}
    <button class="no-schedules" onclick={create}>
      <span class="icon-tile"><Icon name="calendar" /></span>
      <strong>No schedules</strong>
      <span class="muted">You have no schedules right now. Click here to create one.</span>
    </button>
  {:else}
    <div class="schedule-cards">
      {#each account.schedules as schedule (schedule.id)}
        {@const isLive = live?.id === schedule.id}
        <article class="card schedule-card" class:live={isLive}>
          <a class="open" href="/schedule/{schedule.id}">
            <div class="card-title">
              <h2>{schedule.name}</h2>
              {#if isLive}<span class="badge ok"><span class="status-dot live"></span>Live</span>{/if}
            </div>
            <SchedulePreview {schedule} classes={account.classes} />
          </a>
          <div class="row">
            {#if isLive}
              <button class="btn btn-small" onclick={stopFollowingSchedule}>Stop using</button>
            {:else}
              <button
                class="btn btn-primary btn-small"
                onclick={() => use(schedule.id)}
                disabled={!schedule.periods.length}
                title={schedule.periods.length ? undefined : 'Add a period first'}>Use this</button
              >
            {/if}
            <a class="btn btn-small btn-quiet" href="/schedule/{schedule.id}"><Icon name="pencil" size={14} />Edit</a>
          </div>
        </article>
      {/each}
    </div>
  {/if}
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

  .no-schedules {
    display: grid;
    justify-items: center;
    gap: 8px;
    width: 100%;
    padding: 48px 18px;
    border: 2px dashed var(--border-strong);
    border-radius: 16px;
    background: none;
    font: inherit;
    font-size: 15px;
    text-align: center;
    cursor: pointer;
  }

  .no-schedules:hover,
  .no-schedules:focus-visible {
    border-color: var(--accent);
    background: var(--accent-wash);
  }

  .no-schedules strong {
    font-size: 18px;
  }

  .schedule-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 16px;
  }

  .schedule-card {
    display: grid;
    align-content: space-between;
    gap: 14px;
  }

  .schedule-card.live {
    border-color: #9fc7ad;
    box-shadow: 0 0 0 1px #9fc7ad;
  }

  .open {
    display: grid;
    gap: 10px;
    color: inherit;
    text-decoration: none;
  }

  .open:hover h2 {
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .card-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .card-title h2 {
    font-size: 18px;
  }

  .badge .status-dot {
    margin-right: 4px;
  }
</style>
