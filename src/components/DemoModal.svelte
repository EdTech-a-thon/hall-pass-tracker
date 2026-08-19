<script lang="ts">
  import { app } from '../lib/store.svelte';

  function close() {
    app.modal = null;
  }
</script>

<div class="modal-backdrop">
  <section class="modal export-modal">
    <button class="modal-close" onclick={close} aria-label="Close">×</button>
    <div class="google-mark">G</div>
    <p class="eyebrow">DEMO GOOGLE WORKSPACE</p>
    <h2>Hallway analytics exported</h2>
    <p>A Google Sheet with this class's pass analytics has been created in <strong>your Drive</strong>.</p>
    <div class="fake-sheet">
      <span></span>
      <strong>Hall Passes · This term</strong>
      <small>Google Sheets · Demo connection</small>
    </div>
    <button class="button primary full" onclick={close}>Return to analytics</button>
  </section>
</div>
