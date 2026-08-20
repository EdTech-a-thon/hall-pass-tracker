<script lang="ts">
  import { app, saveDestinations } from '../lib/store.svelte';

  let label = $state('');
  let minutes = $state(8);
  let busy = $state(false);
  let error = $state('');

  async function commit(next: { label: string; minutes: number }[]) {
    busy = true;
    await saveDestinations(next);
    busy = false;
  }

  async function add(event: SubmitEvent) {
    event.preventDefault();
    const name = label.trim();
    if (!name || busy) return;
    if (app.destinations.some((item) => item.label.toLowerCase() === name.toLowerCase())) {
      error = 'You already have a destination with that name.';
      return;
    }
    error = '';
    await commit([...app.destinations, { label: name, minutes }]);
    label = '';
    minutes = 8;
  }

  async function setMinutes(target: string, value: number) {
    // Only trips taken from now on are judged by the new number; the minutes on
    // a Pass are frozen when the student leaves.
    await commit(app.destinations.map((item) => (item.label === target ? { ...item, minutes: value } : item)));
  }

  async function remove(target: string) {
    await commit(app.destinations.filter((item) => item.label !== target));
  }

  async function move(target: string, direction: -1 | 1) {
    const next = [...app.destinations];
    const from = next.findIndex((item) => item.label === target);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= next.length) return;
    [next[from], next[to]] = [next[to], next[from]];
    await commit(next);
  }
</script>

<article class="panel">
  <p class="eyebrow">WHERE STUDENTS MAY GO</p>
  <h2>Destinations</h2>
  <p class="muted">
    Students choose from this list. The minutes you set here are what a trip is expected to
    take, and a student who goes over is flagged on your dashboard — never on the door screen.
  </p>

  <form class="destination-add" onsubmit={add}>
    <label>
      Name of the new destination
      <input bind:value={label} maxlength="40" placeholder="Nurse" required />
    </label>
    <label class="minutes-field">
      Expected minutes
      <input type="number" bind:value={minutes} min="1" max="120" required />
    </label>
    <button class="button primary" type="submit" disabled={busy}>Add destination</button>
  </form>
  {#if error}<p class="form-error" role="alert">{error}</p>{/if}

  <div class="class-list">
    {#each app.destinations as option, index (option.label)}
      <article>
        <div class="class-identity"><h3>{option.label}</h3></div>
        <div class="class-actions">
          <label class="minutes-field inline">
            Minutes for {option.label}
            <input
              type="number"
              min="1"
              max="120"
              value={option.minutes}
              onchange={(event) => setMinutes(option.label, Number(event.currentTarget.value))}
            />
          </label>
          <button class="button small outline" onclick={() => move(option.label, -1)} disabled={index === 0} aria-label="Move {option.label} earlier">↑</button>
          <button class="button small outline" onclick={() => move(option.label, 1)} disabled={index === app.destinations.length - 1} aria-label="Move {option.label} later">↓</button>
          <button class="button small outline" onclick={() => remove(option.label)}>Remove {option.label}</button>
        </div>
      </article>
    {:else}
      <div class="empty-state">No destinations yet. Students cannot sign out until you add one.</div>
    {/each}
  </div>
</article>
