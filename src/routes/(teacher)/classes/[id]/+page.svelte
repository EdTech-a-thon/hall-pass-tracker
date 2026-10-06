<script lang="ts">
  import { page } from '$app/state';
  import {
    account,
    classPasses,
    endNoPassTime,
    findClass,
    markReturned,
    noPassNow,
    startNoPassTime,
  } from '#lib/account.svelte.ts';
  import CorrectionDialog from '#lib/CorrectionDialog.svelte';
  import DestinationIcon from '#lib/DestinationIcon.svelte';
  import { download, passesToCsv } from '#lib/csv.ts';
  import Icon from '#lib/Icon.svelte';
  import LetStudentGoDialog from '#lib/LetStudentGoDialog.svelte';
  import PassMarks from '#lib/PassMarks.svelte';
  import { dayKey, duration, hasRealDuration, isOverdue, shortDate, time } from '#lib/passes.ts';
  import { formatClock } from '#lib/schedule.ts';
  import { destinationShares, minutesOut, passesByDay, startOfWeek } from '#lib/stats.ts';
  import type { Pass } from '#lib/types.ts';

  const cls = $derived(findClass(page.params.id ?? '')!);
  const passes = $derived(classPasses(cls.id).filter((pass) => pass.endedBy !== 'cancelled'));

  // Re-read the clock every 30 seconds so "minutes out" and Overdue stay current.
  let clock = $state(Date.now());
  $effect(() => {
    const timer = setInterval(() => (clock = Date.now()), 30_000);
    return () => clearInterval(timer);
  });

  const onKiosk = $derived(!!account.kiosk && account.activeClass?.id === cls.id);
  const noPass = $derived(noPassNow(cls.id, clock));

  const waiting = $derived(account.line.filter((spot) => spot.classId === cls.id));
  /** Each destination has its own line. */
  const lines = $derived(
    [...new Set(waiting.map((spot) => spot.destination))].map((destination) => ({
      destination,
      spots: waiting.filter((spot) => spot.destination === destination),
    })),
  );
  const out = $derived(passes.filter((pass) => !pass.inAt).sort((a, b) => a.outAt.localeCompare(b.outAt)));
  const today = $derived(passes.filter((pass) => dayKey(pass.outAt) === dayKey(new Date())));
  const week = $derived(passes.filter((pass) => pass.outAt >= startOfWeek().toISOString()));
  const days = $derived(passesByDay(passes));
  const shares = $derived(destinationShares(passes));
  const history = $derived([...passes].sort((a, b) => b.outAt.localeCompare(a.outAt)));

  let showAll = $state(false);
  let lettingGo = $state(false);
  let correcting = $state(null as Pass | null);

  function ending(pass: Pass) {
    if (!pass.inAt) return { text: 'Still out', tone: 'warn' };
    if (pass.endedBy === 'switch') return { text: 'Class changed', tone: '' };
    if (pass.endedBy === 'removed') return { text: 'Left the roster', tone: '' };
    if (pass.endedBy === 'teacher') return { text: 'Marked back by you', tone: '' };
    return { text: 'Signed back in', tone: 'ok' };
  }

  function exportCsv() {
    download(`${cls.name} passes ${dayKey(new Date())}.csv`, passesToCsv(passes), 'text/csv');
  }
</script>

<section class="card">
  <div class="card-head">
    <div>
      <p class="eyebrow">Right now</p>
      <h2>
        {out.length ? `${out.length} out` : "Everyone's in class"}{waiting.length ? ` · ${waiting.length} in line` : ''}
      </h2>
    </div>
    <div class="row">
      {#if onKiosk && !noPass}
        <button class="btn" onclick={startNoPassTime} title="Stop students starting passes until you open them again">
          <Icon name="ban" size={16} />No passes now
        </button>
      {/if}
      <button class="btn" onclick={() => (lettingGo = true)}><Icon name="unlock" size={16} />Let a student go</button>
    </div>
  </div>
  {#if noPass}
    <div class="notice-bar" role="status" style="align-items:center">
      <Icon name="ban" />
      {#if noPass.end}
        <span>No-pass time until {formatClock(noPass.end)}, from your <a href="/schedule">schedule</a>.</span>
      {:else}
        <span>No-pass time since {formatClock(noPass.start)}. Students can't start passes until you open them.</span>
        <button class="btn btn-small" onclick={endNoPassTime}>Open passes</button>
      {/if}
    </div>
  {/if}
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
            <span class="destination-chip muted"><DestinationIcon label={spot.destination} size={22} />{spot.destination}</span>
            <span class="muted small">since {time(spot.joinedAt)}</span>
          </li>
        {/each}
      </ol>
    </div>
  {/each}
</section>

<section class="stats" aria-label="Summary">
  <div class="stat"><strong>{today.length}</strong><span>Passes today</span></div>
  <div class="stat"><strong>{week.length}</strong><span>Passes this week</span></div>
  <div class="stat"><strong>{minutesOut(week)}</strong><span>Minutes out this week</span></div>
  <div class="stat">
    <strong>{week.filter((pass) => pass.inAt && isOverdue(pass)).length}</strong><span>Overdue this week</span>
  </div>
</section>

<div class="grid-2">
  <section class="card">
    <div>
      <p class="eyebrow">Last 7 days</p>
      <h2>Passes by day</h2>
    </div>
    {#if days.some((day) => day.count)}
      <div class="bars" role="img" aria-label="Passes by day: {days.map((day) => `${day.label} ${day.count}`).join(', ')}">
        {#each days as day, index (day.key)}
          <div class:today={index === days.length - 1}>
            <span>{day.count || ''}</span>
            <div class="bar-slot"><span class="bar" style:height="{day.height}%"></span></div>
            <span>{day.label}</span>
          </div>
        {/each}
      </div>
    {:else}
      <div class="empty">No passes in the last week yet.</div>
    {/if}
  </section>

  <section class="card">
    <div>
      <p class="eyebrow">All time</p>
      <h2>Where students go</h2>
    </div>
    {#each shares as share (share.label)}
      <div class="share">
        <div class="share-row">
          <span class="destination-chip"><DestinationIcon label={share.label} size={22} />{share.label}</span>
          <span>{share.share}% · {share.count}</span>
        </div>
        <div class="share-track"><span style:width="{share.share}%"></span></div>
      </div>
    {:else}
      <div class="empty">No trips recorded yet.</div>
    {/each}
  </section>
</div>

<section class="card">
  <div class="card-head">
    <div>
      <p class="eyebrow">Every trip</p>
      <h2>Pass history</h2>
    </div>
    <button class="btn" onclick={exportCsv} disabled={!passes.length}><Icon name="download" size={16} />Download CSV</button>
  </div>
  {#if history.length}
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>When</th><th>Student</th><th>Where</th><th class="num">Minutes</th><th>How it ended</th><th></th></tr>
        </thead>
        <tbody>
          {#each showAll ? history : history.slice(0, 25) as pass (pass.id)}
            {@const end = ending(pass)}
            <tr>
              <td>{shortDate(pass.outAt)}, {time(pass.outAt)}</td>
              <td><strong>{pass.studentName}</strong> <PassMarks {pass} /></td>
              <td><span class="destination-chip"><DestinationIcon label={pass.destination} size={22} />{pass.destination}</span></td>
              <td class="num">
                {#if !pass.inAt}
                  …
                {:else if hasRealDuration(pass)}
                  {#if isOverdue(pass)}<span class="badge warn">Overdue</span>{/if}
                  {duration(pass)}
                {:else}
                  <span class="muted">unknown</span>
                {/if}
              </td>
              <td>
                <span class="badge {end.tone}">{end.text}</span>
                {#if pass.corrected}<span class="badge">Corrected</span>{/if}
              </td>
              <td class="num">
                <button class="btn btn-small btn-quiet" onclick={() => (correcting = pass)} aria-label="Correct this pass">
                  <Icon name="pencil" size={14} />
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    {#if history.length > 25}
      <button class="btn btn-quiet" onclick={() => (showAll = !showAll)}>
        {showAll ? 'Show fewer' : `Show all ${history.length}`}
      </button>
    {/if}
  {:else}
    <div class="empty">
      <span class="icon-tile"><Icon name="clock" /></span>
      Trips will appear here as students sign out at the kiosk.
    </div>
  {/if}
</section>

{#if lettingGo}
  <LetStudentGoDialog {cls} onClose={() => (lettingGo = false)} />
{/if}

{#if correcting}
  <CorrectionDialog pass={correcting} students={cls.students} onClose={() => (correcting = null)} />
{/if}
