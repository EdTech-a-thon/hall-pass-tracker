<script lang="ts">
  import { duration, time } from '../lib/passes';
  import { app } from '../lib/store.svelte';

  const rows = $derived([...app.activeClass.passes].reverse());

  /** Static sample week, since the prototype has no multi-day history yet. */
  const week = [
    { day: 'M', height: 40 },
    { day: 'T', height: 76 },
    { day: 'W', height: 54 },
    { day: 'T', height: 64 },
    { day: 'F', height: 24 },
  ];
  const dots = ['blue-dot', 'green-dot', 'amber-dot', 'gray-dot'];

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
  <button class="button outline" onclick={() => (app.modal = { kind: 'export' })}>Export to Google Sheets</button>
</section>

<section class="analytics-layout">
  <article class="panel chart-card">
    <div class="panel-head">
      <div>
        <p class="eyebrow">THIS WEEK</p>
        <h2>Passes by day</h2>
      </div>
      <strong>24 total</strong>
    </div>
    <div class="bar-chart" aria-label="Passes by day: Monday 4, Tuesday 7, Wednesday 5, Thursday 6, Friday 2">
      {#each week as bar, index (index)}
        <div><span style:height="{bar.height}%"></span><small>{bar.day}</small></div>
      {/each}
    </div>
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
        <tr><th>Student</th><th>Destination</th><th>Out</th><th>Duration</th><th>Return verification</th></tr>
      </thead>
      <tbody>
        {#each rows as pass (pass.id)}
          <tr>
            <td><strong>{pass.studentName}</strong></td>
            <td>{pass.destination}</td>
            <td>{time(pass.outAt)}</td>
            <td>{duration(pass)} min</td>
            <td>
              {#if !pass.inAt}
                <span class="out-status">Still out</span>
              {:else if pass.signedInBy}
                <span class="flag">Signed in by {pass.signedInBy}</span>
              {:else}
                <span class="verified">Self check-in</span>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>
