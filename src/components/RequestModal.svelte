<script lang="ts">
  import { app, requestPass } from '../lib/store.svelte';
  import type { Student } from '../lib/types';

  let { student }: { student: Student } = $props();

  const reasons = ['Restroom', 'Water', 'Main office', 'Counselor'];
  let reason = $state(reasons[0]);
  let minutes = $state(8);

  function submit(event: SubmitEvent) {
    event.preventDefault();
    void requestPass(student, reason, minutes);
  }
</script>

<div class="modal-backdrop">
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="request-title">
    <button class="modal-close" onclick={() => (app.modal = null)} aria-label="Close">×</button>
    <p class="eyebrow">PASS FOR</p>
    <h2 id="request-title">{student.name}</h2>
    <form onsubmit={submit}>
      <fieldset>
        <legend>Where are you going?</legend>
        <div class="choice-grid">
          {#each reasons as option (option)}
            <label class="choice">
              <input type="radio" name="reason" value={option} bind:group={reason} />
              <span>{option}</span>
            </label>
          {/each}
        </div>
      </fieldset>
      <label>
        How long do you expect to be gone?
        <select name="minutes" bind:value={minutes}>
          <option value={5}>5 minutes</option>
          <option value={8}>8 minutes</option>
          <option value={10}>10 minutes</option>
          <option value={15}>15 minutes</option>
        </select>
      </label>
      <button class="button primary full" type="submit">Request hall pass</button>
    </form>
  </div>
</div>
