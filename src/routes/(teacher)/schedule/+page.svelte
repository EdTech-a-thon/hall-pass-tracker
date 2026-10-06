<script lang="ts">
  import { goto } from '$app/navigation';
  import { account, addSchedule } from '#lib/account.svelte.ts';
  import Icon from '#lib/Icon.svelte';
  import SchedulePreview from '#lib/SchedulePreview.svelte';

  /** Every schedule the teacher has, as cards to open and change. Which one is in use today is picked on Home. */
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
        schedule for each, and pick the right one on <a href="/">Home</a> when you come in.
      </p>
    </div>
    {#if account.schedules.length}
      <button class="btn btn-primary" onclick={create}><Icon name="plus" size={16} />New schedule</button>
    {/if}
  </header>

  {#if !account.schedules.length}
    <button class="no-schedules" onclick={create}>
      <span class="icon-tile"><Icon name="calendar" /></span>
      <strong>No schedules</strong>
      <span class="muted">You have no schedules right now. Click here to create one.</span>
    </button>
  {:else}
    <div class="schedule-cards">
      {#each account.schedules as schedule (schedule.id)}
        <article class="card schedule-card">
          <a class="open" href="/schedule/{schedule.id}">
            <div class="card-title">
              <h2>{schedule.name}</h2>
            </div>
            <SchedulePreview {schedule} classes={account.classes} />
          </a>
          <div class="row">
            <a class="btn btn-small btn-quiet" href="/schedule/{schedule.id}"><Icon name="pencil" size={14} />Edit</a>
          </div>
        </article>
      {/each}
    </div>
  {/if}
</div>

<style>
  .wide {
    max-width: 1240px;
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
</style>
