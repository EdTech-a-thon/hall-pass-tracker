<script lang="ts">
  import { app, beginKioskMode, teacherName } from '../lib/store.svelte';
  import DestinationsPanel from './DestinationsPanel.svelte';
</script>

<section class="workspace-head">
  <div>
    <p class="eyebrow">ACCOUNT & SECURITY</p>
    <h1>Profile</h1>
    <p>Manage your teacher account and kiosk access.</p>
  </div>
</section>

<DestinationsPanel />

<section class="security-grid">
  <article class="panel">
    <span class="stat-icon green">✓</span>
    <h2>{teacherName()}</h2>
    <p>
      Your teacher workspace can review live passes and analytics. Kiosk mode only
      shows the student check-out and return screen.
    </p>
    <p class="danger-copy">
      <strong>Keep your kiosk PIN private.</strong> Students need a teacher's six-digit PIN
      to leave kiosk mode and return to this workspace.
    </p>
  </article>

  <article class="panel">
    <p class="eyebrow">KIOSK PIN</p>
    <h2>Classroom kiosk</h2>
    <p>Your PIN is remembered for future kiosk sessions. For safety, it is never displayed.</p>
    <button class="button outline full" onclick={() => (app.modal = { kind: 'kiosk-pin', purpose: 'change' })}>Set a new PIN</button>
    <button class="button primary full pair-button" onclick={() => void beginKioskMode()}>Enter kiosk mode</button>
  </article>

  <article class="panel">
    <span class="stat-icon blue">▣</span>
    <h2>Your own session</h2>
    <div class="device">
      <div><strong>This teacher workspace</strong><span>Held in memory · ends on refresh</span></div>
      <span class="current">Current</span>
    </div>
  </article>
</section>
