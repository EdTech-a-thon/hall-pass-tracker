<script lang="ts">
  import { duration } from '../lib/passes';
  import { app, markReturned, out, setLimit } from '../lib/store.svelte';

  const averageTrip = $derived(
    Math.round(app.classroom.passes.reduce((sum, pass) => sum + duration(pass), 0) / app.classroom.passes.length),
  );
</script>

<section class="workspace-head">
  <div>
    <p class="eyebrow">TUESDAY · PERIOD 3</p>
    <h1>Good morning, Ms. Rivera.</h1>
    <p>Here is what is happening in Room 214.</p>
  </div>
  <button class="button outline" onclick={() => (app.modal = { kind: 'export' })}>Export to Google Sheets</button>
</section>

<section class="stat-grid">
  <article>
    <span class="stat-icon green">↗</span>
    <p>Students out now</p>
    <strong>{out().length}<small> of {app.classroom.limit} allowed</small></strong>
  </article>
  <article>
    <span class="stat-icon amber">◷</span>
    <p>Passes today</p>
    <strong>{app.classroom.passes.length}<small> total trips</small></strong>
  </article>
  <article>
    <span class="stat-icon blue">≈</span>
    <p>Average trip</p>
    <strong>{averageTrip}<small> minutes</small></strong>
  </article>
</section>

<section class="panel">
  <div class="panel-head">
    <div>
      <p class="eyebrow">RIGHT NOW</p>
      <h2>Students in the hallway</h2>
    </div>
    <label class="limit-control">
      Maximum out at once
      <select value={app.classroom.limit} onchange={(event) => setLimit(Number(event.currentTarget.value))}>
        {#each [1, 2, 3, 4, 5] as number (number)}
          <option value={number}>{number}</option>
        {/each}
      </select>
    </label>
  </div>
  <div class="student-cards">
    {#each out() as pass (pass.id)}
      <article>
        <div class="avatar">{pass.studentName.charAt(0)}</div>
        <div>
          <h3>{pass.studentName}</h3>
          <p>{pass.reason} · out {duration(pass)} min</p>
        </div>
        <button class="button small" onclick={() => markReturned(pass.id)}>Mark returned</button>
      </article>
    {:else}
      <div class="empty-state">Everyone is back in class.</div>
    {/each}
  </div>
</section>
