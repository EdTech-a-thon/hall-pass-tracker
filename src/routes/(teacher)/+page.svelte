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
    passStatus,
    passStatusText,
    setActiveClass,
    setDoorLocked,
    startNoPassTime,
    stopFollowingSchedule,
    useSchedule,
    useWarning,
    waitingRequests,
  } from '#lib/account.svelte.ts';
  import { clock } from '#lib/clock.svelte.ts';
  import ConfirmDialog from '#lib/ConfirmDialog.svelte';
  import DestinationIcon from '#lib/DestinationIcon.svelte';
  import Icon from '#lib/Icon.svelte';
  import { answerRequest, canAnswer, link } from '#lib/link.svelte.ts';
  import PassMarks from '#lib/PassMarks.svelte';
  import { duration, hasRealDuration, isOverdue, now, time } from '#lib/passes.ts';
  import { nextClassPeriod, periodAt, toMinutes } from '#lib/schedule.ts';
  import { minutesOut } from '#lib/stats.ts';
  import type { Block, PassRequest } from '#lib/types.ts';

  /**
   * Home: the one page a teacher keeps open all day. The day and whether
   * students may leave come first; then the class on the kiosk, what's
   * happening in it, and students' Requests down the side. See CONTEXT.md.
   */
  let name = $state('');

  const at = $derived(clock.now);
  const classId = $derived(account.activeClass?.id ?? null);
  const live = $derived(liveSchedule());
  const status = $derived(passStatus(at));
  const noPass = $derived(classId ? noPassNow(classId, at) : null);
  const tone = $derived({ open: 'ok', 'no-pass': 'warn', between: '', 'no-class': '' }[status]);

  /** "22 min", or "1 hr 5 min", until a clock time today. */
  function until(clockTime: string) {
    const nowDate = new Date(at);
    const minutes = Math.max(1, toMinutes(clockTime) - (nowDate.getHours() * 60 + nowDate.getMinutes()));
    return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} hr${minutes % 60 ? ` ${minutes % 60} min` : ''}`;
  }

  /** The second line: when this changes next, in words. */
  const timing = $derived.by(() => {
    if (status === 'between') {
      const upcoming = nextClassPeriod(live, at);
      const cls = findClass(upcoming?.classId);
      return upcoming && cls ? `${cls.name} starts in ${until(upcoming.start)}` : 'No more classes today';
    }
    if (status === 'no-class') return 'Choose a class to put on the kiosk';
    if (noPass) return noPass.end ? `Passes open in ${until(noPass.end)}` : 'Passes stay closed until you open them';
    const period = live ? periodAt(live, at) : null;
    return period ? `Ends in ${until(period.end)}` : 'Off schedule';
  });

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

  /** "This class" starts when it came on the kiosk, or this morning if that was before today. */
  const since = $derived.by(() => {
    const changed = account.activeClass?.changedAt;
    const midnight = new Date(at);
    midnight.setHours(0, 0, 0, 0);
    return changed && changed > midnight.toISOString() ? changed : midnight.toISOString();
  });
  const thisClass = $derived(
    account.passes.filter((pass) => pass.classId === classId && pass.outAt >= since && pass.endedBy !== 'cancelled'),
  );

  type Activity = { id: string; at: string; text: string; pass?: (typeof account.passes)[number]; denied?: boolean };
  /** What has happened in this class so far, newest first. */
  const activity = $derived.by(() => {
    const events: Activity[] = [];
    for (const pass of thisClass) {
      events.push({ id: `${pass.id}-out`, at: pass.outAt, text: `${pass.studentName} left for ${pass.destination}`, pass });
      if (pass.inAt && pass.endedBy === 'student') {
        const minutes = hasRealDuration(pass) ? ` after ${duration(pass)} min` : '';
        events.push({ id: `${pass.id}-in`, at: pass.inAt, text: `${pass.studentName} came back${minutes}` });
      }
      if (pass.inAt && pass.endedBy === 'teacher') {
        events.push({ id: `${pass.id}-in`, at: pass.inAt, text: `You marked ${pass.studentName} back` });
      }
    }
    for (const request of account.deniedRequests) {
      if (request.classId !== classId || request.deniedAt < since) continue;
      events.push({
        id: request.id,
        at: request.deniedAt,
        text: `You said no to ${request.studentName} (${request.destination})`,
        denied: true,
      });
    }
    return events.sort((a, b) => b.at.localeCompare(a.at));
  });

  /** A change that needs the teacher's OK first: taking the kiosk off schedule, or ending passes. */
  let confirming = $state(null as null | { title: string; message: string; label: string; run: () => void });

  /**
   * The menus show what's true, not what was picked: until the teacher
   * confirms, they snap back, and once it changes they follow.
   */
  function chooseClass(menu: HTMLSelectElement) {
    const id = menu.value;
    menu.value = classId ?? '';
    if (id === classId) return;
    const cls = findClass(id);
    const move = () => setActiveClass({ id, changedAt: now() });
    const warning = moveWarning(id);
    if (!warning) return move();
    confirming = {
      title: live ? `You're on ${live.name}. Switch to ${cls?.name} by hand?` : `Switch the kiosk to ${cls?.name}?`,
      message: warning,
      label: 'Switch class',
      run: move,
    };
  }

  function chooseSchedule(menu: HTMLSelectElement) {
    const id = menu.value;
    menu.value = live?.id ?? '';
    if (!id) return stopFollowingSchedule();
    const warning = useWarning(id);
    if (!warning) return useSchedule(id);
    confirming = { title: `Use ${findSchedule(id)?.name}?`, message: warning, label: 'Use this schedule', run: () => useSchedule(id) };
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

  function ago(when: string) {
    const minutes = Math.floor((at - new Date(when).getTime()) / 60_000);
    return minutes < 1 ? 'just now' : `${minutes} min ago`;
  }

  const today = $derived(
    new Intl.DateTimeFormat([], { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(at)),
  );
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
  <div class="home">
    <div class="home-main">
      <header class="home-head">
        <div class="title-row">
          <h1>{today}</h1>
          <span class="badge status-badge {tone}" role="status"><span class="dot"></span>{passStatusText[status]}</span>
          <div class="head-actions">
            {#if noPass && !noPass.end}
              <button class="btn" onclick={endNoPassTime}><Icon name="check" size={16} />Open passes</button>
            {:else if status === 'open'}
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
        </div>

        <div class="context-row" data-tip="tip-switch">
          <span class="picker class-picker">
            <select
              aria-label="Class on the kiosk"
              value={classId ?? ''}
              onchange={(event) => chooseClass(event.currentTarget)}
            >
              {#if !classId}<option value="" disabled>{activeClassLabel()}</option>{/if}
              {#each account.classes as cls (cls.id)}<option value={cls.id}>{cls.name}</option>{/each}
            </select>
            <Icon name="chevron-down" size={18} />
          </span>
          <span class="timing">· {timing}</span>
          <span class="picker schedule-picker">
            <Icon name="calendar" size={16} />
            <select aria-label="Schedule" value={live?.id ?? ''} onchange={(event) => chooseSchedule(event.currentTarget)}>
              {#each account.schedules as schedule (schedule.id)}
                <option value={schedule.id} disabled={!schedule.periods.length}>{schedule.name}</option>
              {/each}
              <option value="">{account.schedules.length ? 'Off schedule' : 'No schedule'}</option>
            </select>
            <Icon name="chevron-down" size={16} />
          </span>
        </div>
        {#if !live && currentSchedule()?.periods.length && account.activeClass}
          <p class="muted small">
            Off schedule, so the class won't change by itself.
            <button class="link-button" onclick={() => useSchedule(currentSchedule()!.id)}>Back to {currentSchedule()!.name}</button>
          </p>
        {:else if !account.schedules.length}
          <p class="muted small"><a href="/schedule">Set up a schedule</a> and the class changes by itself as each period starts.</p>
        {/if}
      </header>

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

      {#if classId}
        <section class="stats this-class" aria-label="This class">
          <div class="stat"><strong>{out.length}</strong><span>Out of class now</span></div>
          <div class="stat"><strong>{waiting.length}</strong><span>Waiting in line</span></div>
          <div class="stat"><strong>{thisClass.length}</strong><span>Passes this class</span></div>
          <div class="stat"><strong>{minutesOut(thisClass)}</strong><span>Minutes out this class</span></div>
        </section>

        <section class="card">
          <div>
            <p class="eyebrow">Right now</p>
            <h2>{out.length ? `${out.length} out` : "Everyone's in class"}</h2>
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
                        {#if isOverdue(pass, at)}<span class="badge warn">Overdue</span>{/if}
                        {duration(pass, at)}{pass.minutes ? ` of ${pass.minutes}` : ''}
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

        <section class="card">
          <div class="card-head">
            <div>
              <p class="eyebrow">This class</p>
              <h2>What's happened so far</h2>
            </div>
            <a class="btn btn-quiet" href="/history">All history<Icon name="arrow-right" size={16} /></a>
          </div>
          {#if activity.length}
            <ol class="activity">
              {#each activity as event (event.id)}
                <li class:denied={event.denied}>
                  <span class="when">{time(event.at)}</span>
                  <span>{event.text}</span>
                  {#if event.pass}<PassMarks pass={event.pass} />{/if}
                </li>
              {/each}
            </ol>
          {:else}
            <p class="muted small">Nothing yet. Passes and your answers to requests show up here as they happen.</p>
          {/if}
        </section>
      {/if}
    </div>

    <aside class="requests-panel" aria-labelledby="requests-title" data-tip="tip-requests">
      <div class="panel-head">
        <h2 id="requests-title"><Icon name="hand" size={18} />Requests</h2>
        {#if requests.length}<span class="count">{requests.length}</span>{/if}
      </div>
      {#if account.kiosk?.kind !== 'device'}
        <p class="muted small">
          Students can ask you from a paired kiosk, like a tablet or Chromebook by the door. When this computer is the
          kiosk, let them go with your PIN there.
        </p>
      {:else}
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
                  <span class="muted small">{ago(request.askedAt)}</span>
                </div>
                <span class="destination-chip"><DestinationIcon label={request.destination} size={22} />{request.destination}</span>
                <div class="row" style="gap:6px;flex-wrap:wrap">
                  {#each request.blocks as block (block)}<span class="badge warn">{blockText[block](request)}</span>{/each}
                </div>
                <div class="request-answer">
                  <button class="btn btn-small" disabled={!canAnswer()} onclick={() => answerRequest(request, false)}>Deny</button>
                  <button class="btn btn-small btn-primary" disabled={!canAnswer()} onclick={() => answerRequest(request, true)}>
                    <Icon name="check" size={14} />Approve
                  </button>
                </div>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="muted small">
            No requests right now. When something stops a student at the kiosk, they can ask you, and it shows up here.
          </p>
        {/if}
      {/if}
    </aside>
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
  .home {
    flex: 1;
    display: grid;
    margin-bottom: 48px;
    grid-template-columns: minmax(0, 1fr) 320px;
    align-items: start;
    gap: 24px;
    max-width: 1320px;
  }

  .home-main {
    display: grid;
    align-content: start;
    gap: 22px;
  }

  .home-head {
    display: grid;
    gap: 8px;
  }

  .title-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 14px;
  }

  .title-row h1 {
    font-size: 30px;
  }

  .status-badge {
    padding: 3px 12px;
    font-size: 13.5px;
  }

  .status-badge .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: currentColor;
  }

  .head-actions {
    display: flex;
    gap: 8px;
    margin-left: auto;
  }

  .context-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 10px;
    font-size: 17px;
  }

  .timing {
    color: var(--muted);
    font-weight: 600;
  }

  /* A menu that reads as part of the sentence until it's clicked. */
  .picker {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 2px 8px;
    border-radius: 8px;
    color: var(--text);
  }

  .picker:hover,
  .picker:focus-within {
    background: var(--surface-sunk);
  }

  .picker select {
    width: auto;
    padding: 0 22px 0 0;
    margin-right: -22px;
    border: 0;
    background: transparent;
    font-weight: 800;
    appearance: none;
    cursor: pointer;
  }

  .picker select:focus {
    outline: none;
    box-shadow: none;
  }

  .picker :global(svg) {
    pointer-events: none;
  }

  .class-picker {
    margin-left: -8px;
    font-size: 19px;
  }

  .schedule-picker {
    margin-left: auto;
    color: var(--muted);
    font-size: 15px;
  }

  .this-class {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  @media (max-width: 760px) {
    .this-class {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  .link-button {
    padding: 0;
    border: 0;
    background: none;
    color: var(--accent);
    font: inherit;
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
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

  .activity {
    display: grid;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .activity li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 12px;
    padding: 9px 0;
    border-top: 1px solid var(--border);
    font-size: 14.5px;
  }

  .activity li:first-child {
    border-top: 0;
  }

  .activity .when {
    width: 72px;
    color: var(--muted);
    font-size: 13px;
    font-weight: 700;
  }

  .activity li.denied {
    color: var(--danger);
  }

  .requests-panel {
    position: sticky;
    top: 24px;
    display: grid;
    align-content: start;
    gap: 14px;
    min-height: calc(100vh - 48px);
    max-height: calc(100vh - 48px);
    padding: 18px;
    overflow-y: auto;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
  }

  .panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .panel-head h2 {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .count {
    display: grid;
    place-items: center;
    min-width: 26px;
    height: 26px;
    padding: 0 8px;
    border-radius: 999px;
    background: #6a4cbb;
    color: #fff;
    font-size: 13px;
    font-weight: 800;
  }

  .requests {
    display: grid;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .requests li {
    display: grid;
    gap: 8px;
    padding: 12px;
    border: 1px solid #d9c6ef;
    border-radius: var(--radius);
    background: #faf7fe;
  }

  .request-who {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
  }

  .request-answer {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  @media (max-width: 1100px) {
    .home {
      grid-template-columns: 1fr;
    }

    .requests-panel {
      position: static;
      min-height: 0;
      max-height: none;
      grid-row: 2;
    }
  }
</style>
