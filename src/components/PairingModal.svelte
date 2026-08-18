<script lang="ts">
  import { app } from '../lib/store.svelte';

  let { code }: { code: string } = $props();
</script>

<div class="modal-backdrop">
  <section class="modal export-modal">
    <button class="modal-close" onclick={() => (app.modal = null)} aria-label="Close">×</button>
    <p class="eyebrow">ONE-TIME KIOSK LINK</p>
    <h2 class="pairing-code">{code}</h2>
    <p>Enter this code on the kiosk. It expires in 5 minutes and can be used once.</p>
    <div class="warning-box">
      Do not enter your teacher password or verification code on a classroom kiosk.
    </div>
  </section>
</div>
