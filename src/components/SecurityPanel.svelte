<script lang="ts">
  import { time } from '../lib/passes';
  import { app, createKioskLink, revokeKioskLink } from '../lib/store.svelte';

  let label = $state('Classroom door');

  function create(event: SubmitEvent) {
    event.preventDefault();
    void createKioskLink(label.trim() || 'Classroom door');
  }

  function revoke(id: string, name: string) {
    if (!window.confirm(`Revoke "${name}"? That device will stop working immediately.`)) return;
    void revokeKioskLink(id);
  }
</script>

<section class="workspace-head">
  <div>
    <p class="eyebrow">ACCOUNT & DEVICES</p>
    <h1>Security</h1>
    <p>The device by the door can do far less than you can.</p>
  </div>
</section>

<section class="security-grid">
  <article class="panel">
    <span class="stat-icon green">✓</span>
    <h2>What a kiosk link allows</h2>
    <p>
      A kiosk link lets the device by the door read your class list — so it can greet
      students by name — and add exits and returns to the hall pass log. That is all.
      It cannot read the log, change or delete an entry, see another teacher's class,
      or reach your account.
    </p>
    <p class="danger-copy">
      <strong>Anyone holding the link can sign your students out.</strong> Send it only to
      the classroom device, and revoke it if that device leaves the room.
    </p>
  </article>

  <article class="panel">
    <p class="eyebrow">KIOSK LINKS</p>
    <h2>Classroom devices</h2>
    {#each app.kioskLinks as link (link.id)}
      <div class="device">
        <div>
          <strong>{link.label}</strong>
          <span>{link.active ? `Active · created ${time(link.at)}` : 'Revoked'}</span>
        </div>
        {#if link.active}
          <button class="button small" onclick={() => revoke(link.id, link.label)}>Revoke</button>
        {/if}
      </div>
    {:else}
      <div class="device">
        <div>
          <strong>No kiosk links yet</strong>
          <span>Create one, then open it on the device by the door.</span>
        </div>
      </div>
    {/each}

    <form onsubmit={create}>
      <label>
        Name this device
        <input bind:value={label} maxlength="80" placeholder="Classroom door" required />
      </label>
      <button class="button outline full pair-button" type="submit">Create a kiosk link</button>
    </form>
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
