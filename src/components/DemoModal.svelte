<script lang="ts">
  import { app } from '../lib/store.svelte';

  let { kind }: { kind: 'export' | 'recovery' } = $props();

  function close() {
    app.modal = null;
  }
</script>

<div class="modal-backdrop">
  <section class="modal export-modal">
    <button class="modal-close" onclick={close} aria-label="Close">×</button>
    <div class="google-mark">G</div>
    {#if kind === 'export'}
      <p class="eyebrow">DEMO GOOGLE WORKSPACE</p>
      <h2>Hallway analytics exported</h2>
      <p>
        A Google Sheet with encrypted-source pass analytics has been created in
        <strong>Ms. Rivera's Drive</strong>.
      </p>
      <div class="fake-sheet">
        <span></span>
        <strong>Room 214 Hall Passes · July 2026</strong>
        <small>Google Sheets · Demo connection</small>
      </div>
      <button class="button primary full" onclick={close}>Return to analytics</button>
    {:else}
      <p class="eyebrow">DEMO GOOGLE DRIVE</p>
      <h2>Recovery key saved</h2>
      <p>
        The recovery key was sent directly to a private Google Drive folder. This prototype does not
        download it to this device.
      </p>
      <div class="warning-box">
        <strong>Critical:</strong> If you lose both your password and this recovery key, you cannot regain
        access to student records.
      </div>
      <button class="button primary full" onclick={close}>I understand</button>
    {/if}
  </section>
</div>
