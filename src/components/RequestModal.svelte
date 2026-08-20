<script lang="ts">
  import { app, requestPass } from '../lib/store.svelte';
  import type { Student } from '../lib/types';

  let { student }: { student: Student } = $props();
</script>

<div class="modal-backdrop">
  <div class="modal destination-modal" role="dialog" aria-modal="true" aria-labelledby="request-title">
    <button class="modal-close" onclick={() => (app.modal = null)} aria-label="Close">×</button>
    <p class="eyebrow">PASS FOR</p>
    <h2 id="request-title">{student.name}</h2>
    <fieldset>
      <legend>Where are you going?</legend>
      <!-- One tap, not a choice plus a confirm: picking the place is the whole
           second step. How long the trip should take is the teacher's setting. -->
      <div class="choice-grid">
        {#each app.destinations as option (option.label)}
          <button class="choice-button" onclick={() => requestPass(student, option.label)}>
            {option.label}
          </button>
        {/each}
      </div>
    </fieldset>
    {#if !app.destinations.length}
      <p class="muted">Your teacher has not set up any destinations yet.</p>
    {/if}
  </div>
</div>
