<script lang="ts">
  import { goto } from '$app/navigation';
  import {
    account,
    activeClassLabel,
    createClass,
    currentSchedule,
    endNoPassTime,
    findClass,
    findSchedule,
    liveSchedule,
    markReturned,
    moveWarning,
    noPassNow,
    openPasses,
    setActiveClass,
    setDoorLocked,
    startNoPassTime,
    stopFollowingSchedule,
    useSchedule,
    useWarning,
    waitingRequests,
  } from '#lib/account.svelte.ts';
  import ConfirmDialog from '#lib/ConfirmDialog.svelte';
  import DestinationIcon from '#lib/DestinationIcon.svelte';
  import Icon from '#lib/Icon.svelte';
  import { answerRequest, canAnswer, kioskState, link } from '#lib/link.svelte.ts';
  import PassMarks from '#lib/PassMarks.svelte';
  import { dayKey, duration, isOverdue, now, time } from '#lib/passes.ts';
  import { formatClock, formatRange, nextClassPeriod, periodAt } from '#lib/schedule.ts';
  import type { Block, PassRequest } from '#lib/types.ts';

  /**
   * Home: the one page a teacher keeps open all day. Everything happening at
   * the door right now, and the switches for the day. See CONTEXT.md.
   */
  let name = $state('');

  // Re-read the clock every 15 seconds so "minutes out", Overdue and the schedule stay current.
  let clock = $state(Date.now());
  $effect(() => {
    const timer = setInterval(() => (clock = Date.now()), 15_000);
    return () => clearInterval(timer);
  });

  const classId = $derived(account.activeClass?.id ?? null);
  const live = $derived(liveSchedule());
  const period = $derived(live ? periodAt(live, clock) : null);
  const next = $derived.by(() => {
    if (!live || classId) return null;
    const upcoming = nextClassPeriod(live, clock);
    const cls = findClass(upcoming?.classId);
    return upcoming && cls ? `Next: ${cls.name} at ${formatClock(upcoming.start)}` : "That's all the classes on today's schedule.";
  });
  const noPass = $derived(classId ? noPassNow(classId, clock) : null);
  const kiosk = $derived(kioskState());

  const requests = $derived(waitingRequests());
  const out = $derived(classId ? openPasses(classId).sort((a, b) => a.outAt.localeCompare(b.outAt)) : []);
  const waiting = $derived(account.line.filter((spot) => spot.classId === classId));
  /** Each destination has its own line. */
  const lines = $derived(
    [...new Set(waiting.map((spot) => spot.destination))].map((destination) => ({
      destination,
      spots: waiting.filter((spot) => spot.destination === destination),
    })),
  );
  const today = $derived(
    account.passes.filter(
      (pass) => pass.classId === classId && dayKey(pass.outAt) === dayKey(new Date(clock)) && pass.endedBy !== 'cancelled',
    ),
  );

  /** A change that needs the teacher's OK first: moving the kiosk off schedule, or ending passes. */
  let confirming = $state(null as null | { title: string; message: string; label: string; run: () => void });

  function chooseClass(id: string) {
    if (id === classId) return;
    const move = () => setActiveClass({ id, changedAt: now() });
    const warning = moveWarning(id);
    if (warning) confirming = { title: `Switch the kiosk to ${findClass(id)?.name}?`, message: warning, label: 'Switch class', run: move };
    else move();
  }

  function chooseSchedule(id: string) {
    if (!id) {
      stopFollowingSchedule();
      return;
    }
    const warning = useWarning(id);
    if (warning) {
      confirming = { title: `Use ${findSchedule(id)?.name}?`, message: warning, label: 'Use this schedule', run: () => useSchedule(id) };
    } else useSchedule(id);
  }

  function create(event: SubmitEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    goto(`/classes/${createClass(name.trim())}?add`);
  }

  function openDoor() {
    setDoorLocked(true);
    goto('/door');
  }

  const blockText: Record<Block, (request: PassRequest) => string> = {
    allowance: () => 'Out of passes',
    'no-pass': () => 'No-pass time',
    full: (request) => `${request.destination} is full`,
  };

  function minutesAgo(at: string) {
    const minutes = Math.floor((clock - new Date(at).getTime()) / 60_000);
    return minutes < 1 ? 'just now' : `${minutes} min ago`;
  }
</script>

{#if !account.classes.length}
  <div class="page">
    <header class="page-head">
      <div>
        <p class="eyebrow">Welcome to Happy Hallways</p>
        <h1>Start with your first class</h1>
        <p class="muted">
          Happy Hallways keeps track of who is out of your room, where they went and for how long. Everything stays on this
          computer. There's nothing to sign up for.
        </p>
      </div>
    </header>

    <form class="card" onsubmit={create}>
      <label class="field">
        Class name
        <input bind:value={name} placeholder="Period 1 · Math" />
      </label>
      <div class="row">
        <button class="btn btn-primary" disabled={!name.trim()}><Icon name="plus" size={16} />Create class</button>
      </div>
    </form>

    <p class="muted small">
      Is this the tablet or Chromebook by the door? <a href="/door">Make this device the kiosk</a>.
    </p>
  </div>
{:else}
  <div class="page">
    <header class="page-head">
      <div>
        <p class="eyebrow">Home</p>
        <h1>{activeClassLabel()}</h1>
        <p class="muted">
          {#if period && live}
            {live.name} · {formatRange(period)}
          {:else if next}
            {next}
          {:else if !live}
            Off schedule. You choose the class on the kiosk.
          {/if}
        </p>
      </div>
      <div class="row">
        {#if classId && !noPass}
          <button class="btn" onclick={startNoPassTime} title="Stop students starting passes until you open them again">
            <Icon name="ban" size={16} />No passes now
          </button>
        {/if}
        {#if account.kiosk?.kind === 'this-computer'}
          <button class="btn btn-primary" onclick={openDoor} disabled={!account.activeClass}>
            <Icon name="lock" size={16} />Open kiosk screen
          </button>
        {/if}
      </div>
    </header>

    {#if noPass}
      <div class="notice-bar" role="status" style="align-items:center">
        <Icon name="ban" />
        {#if noPass.end}
          <span>No-pass time until {formatClock(noPass.end)}, from your schedule.</span>
        {:else}
          <span>No-pass time since {formatClock(noPass.start)}. Students can't start passes until you open them.</span>
          <button class="btn btn-small" onclick={endNoPassTime}>Open passes</button>
        {/if}
      </div>
    {/if}

    <section class="card today" data-tip="tip-switch" aria-label="Today">
      <label class="field">
        Schedule
        <select value={live?.id ?? ''} onchange={(event) => chooseSchedule(event.currentTarget.value)}>
          {#each account.schedules as schedule (schedule.id)}
            <option value={schedule.id} disabled={!schedule.periods.length}>{schedule.name}</option>
          {/each}
          <option value="">No schedule: I'll choose the class</option>
        </select>
      </label>
      <label class="field">
        Class on the kiosk
        <select value={classId ?? ''} onchange={(event) => chooseClass(event.currentTarget.value)}>
          {#if !classId}<option value="" disabled>{activeClassLabel()}</option>{/if}
          {#each account.classes as cls (cls.id)}<option value={cls.id}>{cls.name}</option>{/each}
        </select>
      </label>
      <div class="today-status">
        {#if !live && currentSchedule()?.periods.length}
          <button class="btn" onclick={() => useSchedule(currentSchedule()!.id)}>
            <Icon name="calendar" size={16} />Back to {currentSchedule()!.name}
          </button>
        {:else if !account.schedules.length}
          <a class="muted small" href="/schedule">Set up a schedule to switch classes by itself</a>
        {/if}
        <span class="kiosk-state"><span class="status-dot {kiosk.dot}" aria-hidden="true"></span>{kiosk.text}</span>
      </div>
    </section>

    {#if !account.kiosk}
      <a class="card setup-kiosk" href="/kiosk">
        <span class="icon-tile"><Icon name="tablet" /></span>
        <span>
          <strong>Set up your kiosk</strong>
          <span class="muted small">Students sign out on a tablet or Chromebook by the door, or on this computer.</span>
        </span>
        <Icon name="arrow-right" />
      </a>
    {/if}

    {#if account.kiosk?.kind === 'device'}
      <section class="card" data-tip="tip-requests">
        <div>
          <p class="eyebrow">Requests</p>
          <h2>{requests.length ? `${requests.length} waiting for you` : 'No requests'}</h2>
        </div>
        {#if !canAnswer() && requests.length}
          <div class="notice-bar" role="status">
            <Icon name="alert-triangle" />
            {link.status === 'taken'
              ? 'Happy Hallways is open in another tab, so answer there.'
              : 'The kiosk is offline, so it can’t hear your answer. Let students go at the kiosk with your PIN.'}
          </div>
        {/if}
        {#if requests.length}
          <ul class="requests">
            {#each requests as request (request.id)}
              <li>
                <div class="request-who">
                  <strong>{request.studentName}</strong>
                  <span class="destination-chip"><DestinationIcon label={request.destination} size={22} />{request.destination}</span>
                  <span class="muted small">{minutesAgo(request.askedAt)}</span>
                </div>
                <div class="row" style="gap:6px;flex-wrap:wrap">
                  {#each request.blocks as block (block)}<span class="badge warn">{blockText[block](request)}</span>{/each}
                </div>
                <div class="row request-answer">
                  <button class="btn btn-small" disabled={!canAnswer()} onclick={() => answerRequest(request, false)}>Deny</button>
                  <button class="btn btn-small btn-primary" disabled={!canAnswer()} onclick={() => answerRequest(request, true)}>
                    <Icon name="check" size={14} />Approve
                  </button>
                </div>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="muted small">When something stops a student at the kiosk, they can ask you, and it shows up here.</p>
        {/if}
      </section>
    {/if}

    {#if classId}
      <section class="card">
        <div class="card-head">
          <div>
            <p class="eyebrow">Right now</p>
            <h2>
              {out.length ? `${out.length} out` : "Everyone's in class"}{waiting.length ? ` · ${waiting.length} in line` : ''}
            </h2>
          </div>
          <a class="btn btn-quiet" href="/history">{today.length} {today.length === 1 ? 'pass' : 'passes'} today<Icon name="arrow-right" size={16} /></a>
        </div>
        {#if out.length}
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>Student</th><th>Where</th><th>Left</th><th class="num">Minutes</th><th></th></tr>
              </thead>
              <tbody>
                {#each out as pass (pass.id)}
                  <tr>
                    <td><strong>{pass.studentName}</strong> <PassMarks {pass} /></td>
                    <td><span class="destination-chip"><DestinationIcon label={pass.destination} size={24} />{pass.destination}</span></td>
                    <td>{time(pass.outAt)}</td>
                    <td class="num">
                      {#if isOverdue(pass, clock)}<span class="badge warn">Overdue</span>{/if}
                      {duration(pass, clock)}{pass.minutes ? ` of ${pass.minutes}` : ''}
                    </td>
                    <td class="num">
                      <button class="btn btn-small" onclick={() => markReturned(pass.id)}>
                        <Icon name="check" size={14} />Mark back
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
        {#each lines as each (each.destination)}
          <div class="stack" style="gap:8px">
            <p class="eyebrow">In line for {each.destination} ({each.spots.length})</p>
            <ol class="line-list">
              {#each each.spots as spot, index (spot.studentId)}
                <li>
                  <span class="line-position">{index + 1}</span>
                  <strong>{spot.studentName}</strong>
                  <span class="muted small">since {time(spot.joinedAt)}</span>
                </li>
              {/each}
            </ol>
          </div>
        {/each}
      </section>
    {/if}
  </div>
{/if}

{#if confirming}
  {@const change = confirming}
  <ConfirmDialog
    title={change.title}
    message={change.message}
    confirmLabel={change.label}
    onConfirm={() => {
      change.run();
      confirming = null;
    }}
    onCancel={() => (confirming = null)}
  />
{/if}

<style>
  .today {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: end;
    gap: 14px 18px;
  }

  .today-status {
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px 18px;
  }

  .kiosk-state {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
    color: var(--muted);
    font-size: 14px;
    font-weight: 600;
  }

  .setup-kiosk {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 14px;
    color: var(--text);
    text-decoration: none;
  }

  .setup-kiosk > span:nth-child(2) {
    display: grid;
    flex: 1;
  }

  .requests {
    display: grid;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .requests li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 14px;
    padding: 10px 0;
    border-top: 1px solid var(--border);
  }

  .request-who {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 12px;
  }

  @media (max-width: 720px) {
    .today,
    .requests li {
      grid-template-columns: 1fr;
    }
  }
</style>
