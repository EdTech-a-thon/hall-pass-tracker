<script lang="ts">
  import { app, requestPass, signBackIn } from '../lib/store.svelte';
  import type { Student } from '../lib/types';

  let { student }: { student: Student } = $props();

  const destinations = ['Restroom', 'Water', 'Main office', 'Counselor'];
  let destination = $state(destinations[0]);
  let minutes = $state(8);

  function submit(event: SubmitEvent) {
    event.preventDefault();
    void requestPass(student, destination, minutes);
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
          {#each destinations as option (option)}
            <label class="choice">
              <input type="radio" name="destination" value={option} bind:group={destination} />
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
    <!-- The kiosk cannot look up whether this student is already out, so coming
         back is a choice they make rather than something the screen knows. -->
    <button class="button outline full return-button" onclick={() => signBackIn(student)}>
      I am back in class
    </button>
  </div>
</div>
