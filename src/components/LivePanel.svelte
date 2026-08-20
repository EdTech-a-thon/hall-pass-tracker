<script lang="ts">
  import { duration, isOverdue } from '../lib/passes';
  import { app, browseClass, markReturned, out, setLimit, teacherName } from '../lib/store.svelte';

  const finished = $derived(app.activeClass.passes.filter((pass) => pass.inAt));
  const overdueNow = $derived(out().filter(isOverdue).length);
  const averageTrip = $derived(
    finished.length ? Math.round(finished.reduce((sum, pass) => sum + duration(pass), 0) / finished.length) : 0,
  );
</script>

<section class="workspace-head">
  <div>
    <p class="eyebrow">TODAY</p>
    <h1>Good morning, {teacherName()}.</h1>
    <p>Here is what is happening in your classroom.</p>
  </div>
  <div class="head-actions">
    <label class="limit-control">
      Class
      <select aria-label="Class" value={app.viewingClassId} onchange={(event) => browseClass(event.currentTarget.value)}>
        {#each app.classes as room (room.id)}
          <option value={room.id}>{room.name}</option>
        {/each}
      </select>
    </label>
    <!-- Browsing above does not move the door screen. This does, deliberately. -->
    <button
      class="button outline"
      disabled={app.viewingClassId === app.activeClassId}
      onclick={() => (app.modal = { kind: 'class-switch' })}
    >
      {app.viewingClassId === app.activeClassId ? 'Showing on the door screen' : 'Show this class on the door'}
    </button>
    <button class="button outline" onclick={() => (app.modal = { kind: 'export' })}>Export to Google Sheets</button>
  </div>
</section>

<section class="stat-grid">
  <article>
    <span class="stat-icon green">↗</span>
    <p>Students out now</p>
    <strong>{out().length}<small> of {app.activeClass.limit} allowed</small></strong>
  </article>
  <article>
    <span class="stat-icon amber">◷</span>
    <p>Overdue right now</p>
    <strong>{overdueNow}<small> past their time</small></strong>
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
      <select aria-label="Maximum out at once" value={app.activeClass.limit} onchange={(event) => setLimit(Number(event.currentTarget.value))}>
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
          <p>
            {pass.destination} · out {duration(pass)} min
            {#if isOverdue(pass)}
              <span class="overdue-flag">Overdue · expected {pass.minutes} min</span>
            {/if}
          </p>
        </div>
        <button class="button small" onclick={() => markReturned(pass.id)}>Mark returned</button>
      </article>
    {:else}
      <div class="empty-state">Everyone is back in class.</div>
    {/each}
  </div>
</section>
