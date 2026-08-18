<script lang="ts">
  import { app, requestLinkCode } from '../lib/store.svelte';
</script>

<section class="workspace-head">
  <div>
    <p class="eyebrow">ACCOUNT & DEVICES</p>
    <h1>Security</h1>
    <p>Teacher and kiosk access are isolated from one another.</p>
  </div>
</section>

<section class="security-grid">
  <article class="panel">
    <span class="stat-icon green">✓</span>
    <h2>Encryption is active</h2>
    <p>
      Student records are encrypted in this browser with libsodium secretbox and an Argon2id
      password-derived key. PocketBase receives ciphertext only.
    </p>
    <button class="button outline" onclick={() => (app.modal = { kind: 'recovery' })}>
      Send recovery key to Google Drive
    </button>
    <p class="danger-copy">
      <strong>If you lose both your password and recovery key, your student records cannot be recovered.</strong>
    </p>
  </article>

  <article class="panel">
    <p class="eyebrow">ACTIVE DEVICES</p>
    <h2>Signed-in sessions</h2>
    <div class="device">
      <div><strong>This teacher workspace</strong><span>Held in memory · ends on refresh</span></div>
      <span class="current">Current</span>
    </div>
    <div class="device">
      <div>
        <strong>{app.kioskDeviceId ? 'Linked kiosk' : 'No linked kiosk'}</strong>
        <span>
          {app.kioskDeviceId
            ? 'Separate restricted device identity · refreshable'
            : 'Create a one-time code to link a classroom device.'}
        </span>
      </div>
    </div>
    <button class="button outline full pair-button" onclick={requestLinkCode}>Link a new kiosk</button>
  </article>
</section>
