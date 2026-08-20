<script lang="ts">
  import { app, enterKiosk, saveKioskPin, verifyKioskPin } from '../lib/store.svelte';

  let { purpose }: { purpose: 'setup' | 'exit' | 'change' | 'switch' } = $props();
  let pin = $state('');
  let confirmPin = $state('');
  let error = $state('');
  let saving = $state(false);

  const heading = $derived(
    purpose === 'exit'
      ? 'Enter your kiosk PIN'
      : purpose === 'switch'
        ? 'Enter your PIN to change class'
        : purpose === 'change'
          ? 'Set a new kiosk PIN'
          : 'Create your kiosk PIN',
  );
  const verifying = $derived(purpose === 'exit' || purpose === 'switch');

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (saving) return;
    if (!/^\d{6}$/.test(pin)) {
      error = 'Enter exactly six numbers.';
      return;
    }
    if (!verifying && pin !== confirmPin) {
      error = 'The PINs do not match.';
      return;
    }
    saving = true;
    const submittedPurpose = purpose;
    const result = verifying ? await verifyKioskPin(pin, submittedPurpose as 'exit' | 'switch') : await saveKioskPin(pin);
    saving = false;
    if (result) {
      error = result;
    } else if (submittedPurpose === 'setup') {
      enterKiosk();
    } else if (submittedPurpose === 'change') {
      app.modal = null;
    }
  }
</script>

<div class="modal-backdrop">
  <div class="modal pin-modal" role="dialog" aria-modal="true" aria-labelledby="pin-title">
    <button class="modal-close" onclick={() => (app.modal = null)} aria-label="Close">×</button>
    <p class="eyebrow">KIOSK SECURITY</p>
    <h2 id="pin-title">{heading}</h2>
    <p class="muted">
      {verifying
        ? 'Only a teacher should use this PIN.'
        : 'Use six numbers you can remember. You will need them to exit kiosk mode.'}
    </p>
    <form onsubmit={submit}>
      <label>
        Six-digit PIN
        <input bind:value={pin} name="pin" type="password" inputmode="numeric" pattern={'[0-9]{6}'} minlength="6" maxlength="6" autocomplete="off" required />
      </label>
      {#if !verifying}
        <label>
          Confirm PIN
          <input bind:value={confirmPin} name="confirmPin" type="password" inputmode="numeric" pattern={'[0-9]{6}'} minlength="6" maxlength="6" autocomplete="off" required />
        </label>
      {/if}
      <p class="form-error" role="alert">{error}</p>
      <button class="button primary full" type="submit" disabled={saving}>
        {purpose === 'exit' ? 'Exit kiosk mode' : purpose === 'switch' ? 'Choose a class' : purpose === 'change' ? 'Save new PIN' : 'Save PIN and enter kiosk mode'}
      </button>
    </form>
  </div>
</div>
