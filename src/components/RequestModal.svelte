<script lang="ts">
  import { app, requestPass, signBackIn } from '../lib/store.svelte';
  import type { Student } from '../lib/types';

  let { student }: { student: Student } = $props();

  let destination = $state(app.destinations[0]?.label ?? '');

  function submit(event: SubmitEvent) {
    event.preventDefault();
    void requestPass(student, destination);
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
          {#each app.destinations as option (option.label)}
            <label class="choice">
              <input type="radio" name="destination" value={option.label} bind:group={destination} />
              <span>{option.label}</span>
            </label>
          {/each}
        </div>
      </fieldset>
      <button class="button primary full" type="submit">Request hall pass</button>
    </form>
    <!-- The kiosk cannot look up whether this student is already out, so coming
         back is a choice they make rather than something the screen knows. -->
    <button class="button outline full return-button" onclick={() => signBackIn(student)}>
      I am back in class
    </button>
  </div>
</div>
