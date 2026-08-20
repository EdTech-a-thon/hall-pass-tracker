<script lang="ts">
  import { dayKey, duration, hasRealDuration, isOverdue, time } from '../lib/passes';
  import { correctionsBetween, downloadCsv } from '../lib/store.svelte';
  import type { PassEvent } from '../lib/types';
  import { app } from '../lib/store.svelte';

  const rows = $derived([...app.activeClass.passes].reverse());

  const weekdays = ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa'];

  /** The last five days of real history. Empty on day one, which is honest. */
  const week = $derived.by(() => {
    const counts = [];
    for (let back = 4; back >= 0; back -= 1) {
      const when = new Date();
      when.setDate(when.getDate() - back);
      const key = new Date(when.getTime() - when.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
      counts.push({
        day: weekdays[when.getDay()],
        key,
        count: app.activeClass.passes.filter((pass) => dayKey(pass.outAt) === key).length,
      });
    }
    const most = Math.max(1, ...counts.map((entry) => entry.count));
    return counts.map((entry) => ({ ...entry, height: Math.round((entry.count / most) * 100) }));
  });
  const weekTotal = $derived(week.reduce((sum, entry) => sum + entry.count, 0));
  const dots = ['blue-dot', 'green-dot', 'amber-dot', 'gray-dot'];

  const today = new Date().toISOString().slice(0, 10);
  let from = $state(today);
  let to = $state(today);
  let corrections = $state([] as PassEvent[]);
  let reviewed = $state(false);

  async function review() {
    corrections = await correctionsBetween(from, to);
    reviewed = true;
  }

  /** Where this Class actually goes, rather than a fixed list that would soon
      contradict whatever the teacher has configured. */
  const destinations = $derived.by(() => {
    const trips = app.activeClass.passes.filter((pass) => pass.destination);
    const counts = new Map<string, number>();
    for (const pass of trips) counts.set(pass.destination, (counts.get(pass.destination) ?? 0) + 1);
    return [...counts.entries()]
      .sort((first, second) => second[1] - first[1])
      .map(([label, count], index) => ({
        label,
        dot: dots[index % dots.length],
        share: `${Math.round((count / trips.length) * 100)}%`,
      }));
  });
</script>

<section class="workspace-head">
  <div>
    <p class="eyebrow">PASS INSIGHTS</p>
    <h1>Hall pass analytics</h1>
    <p>Review patterns and verify how each student returned.</p>
  </div>
  <button class="button outline" onclick={downloadCsv}>Download CSV</button>
</section>

<section class="analytics-layout">
  <article class="panel chart-card">
    <div class="panel-head">
      <div>
        <p class="eyebrow">THIS WEEK</p>
        <h2>Passes by day</h2>
      </div>
      <strong>{weekTotal} total</strong>
    </div>
    {#if weekTotal}
      <div class="bar-chart" aria-label={`Passes by day: ${week.map((bar) => `${bar.day} ${bar.count}`).join(', ')}`}>
        {#each week as bar (bar.key)}
          <div><span style:height="{bar.height}%"></span><small>{bar.day}</small></div>
        {/each}
      </div>
    {:else}
      <!-- Better to say so than to draw a flat line a teacher might read as a trend. -->
      <div class="empty-state">Not enough history yet. Trips will appear here as they are recorded.</div>
    {/if}
  </article>

  <article class="panel destinations">
    <p class="eyebrow">TOP DESTINATIONS</p>
    <h2>Where students go</h2>
    {#each destinations as destination (destination.label)}
      <div><span><i class="dot {destination.dot}"></i>{destination.label}</span><strong>{destination.share}</strong></div>
    {:else}
      <div class="empty-state">No trips recorded yet.</div>
    {/each}
  </article>
</section>

<section class="panel history">
  <div class="panel-head">
    <div>
      <p class="eyebrow">RECENT ACTIVITY</p>
      <h2>Pass history</h2>
    </div>
    <span class="privacy-pill">Teacher view only · kiosks cannot read this</span>
  </div>
  <div class="table-wrap">
    <table>
      <thead>
        <tr><th>Student</th><th>Destination</th><th>Out</th><th>Duration</th><th>Return verification</th><th>Correct</th></tr>
      </thead>
      <tbody>
        {#each rows as pass (pass.id)}
          <tr>
            <td><strong>{pass.studentName}</strong></td>
            <td>{pass.destination}</td>
            <td>{time(pass.outAt)}</td>
            <td>
              {#if hasRealDuration(pass)}
                {duration(pass)} min
                {#if isOverdue(pass)}<span class="overdue-flag">Overdue</span>{/if}
              {:else}
                <span class="muted">return time unknown</span>
              {/if}
            </td>
            <td>
              {#if pass.corrected}<span class="overdue-flag">Corrected</span>{/if}
              {#if !pass.inAt}
                <span class="out-status">Still out</span>
              {:else if pass.endedBy === 'switch'}
                <span class="flag">Ended by class change</span>
              {:else if pass.endedBy === 'cancelled'}
                <span class="flag">Cancelled at the door</span>
              {:else if pass.signedInBy}
                <span class="flag">Signed in by {pass.signedInBy}</span>
              {:else}
                <span class="verified">Self check-in</span>
              {/if}
            </td>
            <td>
              <button class="button small outline" onclick={() => (app.modal = { kind: 'correct', pass })}>
                Correct {pass.studentName}
              </button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>

<section class="panel">
  <div class="panel-head">
    <div>
      <p class="eyebrow">WHAT HAS BEEN CHANGED</p>
      <h2>Corrections</h2>
    </div>
  </div>
  <!-- The log of edits and the log itself are the same thing, which is why this
       needs no separate audit table to fall out of step. See docs/adr/0004. -->
  <div class="destination-add">
    <label>From<input type="date" bind:value={from} /></label>
    <label>To<input type="date" bind:value={to} /></label>
    <button class="button outline" onclick={review}>Show corrections</button>
  </div>
  {#if reviewed}
    <div class="class-list">
      {#each corrections as fix (fix.id)}
        <article>
          <div class="class-identity">
            <h3>{fix.studentName}</h3>
            <span class="current">
              {fix.newStudent ? 'reassigned' : 'time adjusted'} by {fix.signedInBy || 'the teacher'} · {time(fix.at)}
            </span>
          </div>
        </article>
      {:else}
        <div class="empty-state">No corrections in that period.</div>
      {/each}
    </div>
  {/if}
</section>
