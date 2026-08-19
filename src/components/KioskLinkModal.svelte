<script lang="ts">
  import { app } from '../lib/store.svelte';

  let { url, label }: { url: string; label: string } = $props();

  let copied = $state(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
    } catch {
      copied = false;
    }
  }
</script>

<div class="modal-backdrop">
  <section class="modal export-modal">
    <button class="modal-close" onclick={() => (app.modal = null)} aria-label="Close">×</button>
    <p class="eyebrow">KIOSK LINK · {label.toUpperCase()}</p>
    <h2>Send this link to the device by the door</h2>
    <p>
      Open it once on that device and it stays a kiosk. The link lets that screen
      read your class list and sign students out and in — nothing else.
    </p>
    <label class="link-field">
      <span class="visually-hidden">Kiosk link</span>
      <input value={url} readonly onfocus={(event) => event.currentTarget.select()} />
    </label>
    <button class="button primary full" onclick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
    <div class="warning-box">
      This link is shown once. Anyone with it can sign your students out, so send it
      straight to the classroom device and revoke it if the device leaves the room.
    </div>
  </section>
</div>
