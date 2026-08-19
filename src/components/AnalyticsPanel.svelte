<script lang="ts">
  import { duration, time } from '../lib/passes';
  import { app } from '../lib/store.svelte';

  const rows = $derived([...app.classroom.passes].reverse());

  /** Static sample week, since the prototype has no multi-day history yet. */
  const week = [
    { day: 'M', height: 40 },
    { day: 'T', height: 76 },
    { day: 'W', height: 54 },
    { day: 'T', height: 64 },
    { day: 'F', height: 24 },
  ];
  const destinations = [
    { label: 'Restroom', dot: 'blue-dot', share: '42%' },
    { label: 'Water', dot: 'green-dot', share: '29%' },
    { label: 'Main office', dot: 'amber-dot', share: '17%' },
    { label: 'Counselor', dot: 'gray-dot', share: '12%' },
  ];
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

  <article class="panel reasons">
    <p class="eyebrow">TOP DESTINATIONS</p>
    <h2>Where students go</h2>
    {#each destinations as destination (destination.label)}
      <div><span><i class="dot {destination.dot}"></i>{destination.label}</span><strong>{destination.share}</strong></div>
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
            <td>{pass.reason}</td>
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
